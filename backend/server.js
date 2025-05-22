// server.js
require("dotenv").config();
const express     = require("express");
const mysql       = require("mysql2");
const bcrypt      = require("bcryptjs");
const cors        = require("cors");
const fs          = require("fs");
const path        = require("path");
const Mailgun     = require("mailgun-js");
const generateInvoice = require("./generateInvoice");
const backendSession   = require("./sessionmanager");

const app = express();
const port = 5000;

// Mailgun client setup
const mg = Mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN
});

// Ensure invoices directory exists
const invoicesDir = path.join(__dirname, "invoices");
if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir);

app.use("/product_images", express.static("product_images"));
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(backendSession);

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "ecommerce",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

function requireSalesManager(req, res, next) {
    const user = req.session.user;
    if (!user || !user.roles || !user.roles.includes("sales_manager")) {
        return res.status(403).json({ error: "Access denied" });
    }
    next();
}

const requireAuth = (req, res, next) => {
    // TEMP: allow all requests through for now
    next();
};

app.get("/api/products", requireAuth, (req, res) => {
  const { unpricedOnly } = req.query;

  // 1. Explicitly list every column you want back
  let sql = `
    SELECT
      id,
      name,
      description,
      price,
      final_price,
      cost,
      stock,
      category_id,
      model,
      serial_number,
      warranty_status,
      distributor_info,
      image_path,
      popularity
    FROM products
    WHERE is_active = TRUE
  `;

  const params = [];

  // 2. If they only want the "unpriced" ones, narrow it further
  if (unpricedOnly === "true") {
    sql += " AND (price IS NULL OR price = 0)";
  }

  // 3. Run it
  pool.query(sql, params, (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});


app.get('/api/unpriced-products', requireSalesManager, async (req, res) => {
  try {
    const [rows] = await pool.promise().query(
      `SELECT * FROM products WHERE price IS NULL`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching unpriced products:', err);
    res.status(500).json({ error: 'Failed to fetch unpriced products' });
  }
});

app.put("/api/set-price/:id", requireSalesManager, async (req, res) => {
    const id = Number(req.params.id);
    const { price } = req.body;

    if (isNaN(id) || price == null || isNaN(price) || price <= 0) {
        return res.status(400).json({ error: "Invalid product ID or price" });
    }

    try {
        // First check if a discount already exists
        const [rows] = await pool.promise().query(
            "SELECT discount_rate FROM products WHERE id = ? AND is_active = TRUE",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Product not found or inactive" });
        }

        let finalPrice = price;

        // Update both price and final_price
        await pool.promise().query(
            "UPDATE products SET price = ?, final_price = ? WHERE id = ? AND is_active = TRUE",
            [price, finalPrice, id]
        );

        res.json({ message: "Price and final price updated successfully" });
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: "Database error" });
    }
});


app.put('/api/apply-discount/:id', requireSalesManager, async (req, res) => {
  const productId    = Number(req.params.id);
  const discountRate = Number(req.body.discountRate);
  if (isNaN(productId) || isNaN(discountRate) || discountRate <= 0 || discountRate >= 100) {
    return res.status(400).json({ error: 'Invalid product ID or discount rate' });
  }

  const conn = await pool.promise().getConnection();
  try {
    // 1) fetch original price & name
    const [[prod]] = await conn.query(
      `SELECT name, price, final_price
         FROM products
        WHERE id = ? AND is_active = TRUE`,
      [productId]
    );

    if (!prod || prod.price == null) {
      conn.release();
      return res.status(404).json({ error: 'Product not found or price not set' });
    }

    const basePrice = Number(prod.price);
    const newFinal  = Number((basePrice * (1 - discountRate / 100)).toFixed(2));

    // 2) update product
    await conn.query(
      `UPDATE products
          SET final_price  = ?, 
              discount_rate = ?
        WHERE id = ? AND is_active = TRUE`,
      [newFinal, discountRate, productId]
    );

    // 3) find wishlist owners
    const [wishers] = await conn.query(
      `SELECT u.email, u.name
         FROM wishlists w
         JOIN users u
           ON u.id = w.user_id
        WHERE w.product_id = ?`,
      [productId]
    );

    conn.release();

    // 4) email each wisher
    wishers.forEach(({ email, name }) => {
      mg.messages().send({
        from:    process.env.EMAIL_FROM,
        to:      email,
        subject: `Good news — “${prod.name}” is ${discountRate}% off!`,
        text:    `Hi ${name},\n\nYour wishlist item “${prod.name}” just dropped from $${basePrice.toFixed(2)} to $${newFinal.toFixed(2)}!\n\nGrab it before it’s gone!\n\nCheers,\nThe Team`
      }, (err, body) => {
        if (err) console.error('Mailgun wishlist-discount error:', err);
      });
    });

    return res.json({
      message:     'Discount applied and wishlisters notified',
      final_price: newFinal
    });
  } catch (err) {
    conn.release();
    console.error('Error applying discount:', err);
    return res.status(500).json({ error: 'Failed to apply discount' });
  }
});

app.put("/api/cancel-discount/:id", requireSalesManager, async (req, res) => {
    const productId = Number(req.params.id);

    if (isNaN(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
    }

    try {
        // Get base price
        const [rows] = await pool.promise().query(
            "SELECT price FROM products WHERE id = ? AND is_active = TRUE",
            [productId]
        );

        if (rows.length === 0 || !rows[0].price) {
            return res.status(404).json({ error: "Product not found or base price not set" });
        }

        const basePrice = rows[0].price;

        await pool.promise().query(
            "UPDATE products SET price = ?, final_price = ? WHERE id = ? AND is_active = TRUE",
            [basePrice, basePrice, productId]
        );

        res.json({ message: "Discount canceled", restoredPrice: basePrice });
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// ----- PRODUCT ROUTES -----

app.get("/api/products/:id", (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });
  pool.query("SELECT * FROM products WHERE id = ? AND is_active = TRUE", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (results.length === 0) return res.status(404).json({ error: "Product not found" });
    res.json(results[0]);
  });
});

app.get("/api/categories", (req, res) => {
  pool.query("SELECT * FROM categories where is_active = TRUE", (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(results);
  });
});


app.get("/api/search", (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing search query" });
  const like = `%${q.toLowerCase()}%`;
  const sql = `
    SELECT * FROM products
     WHERE LOWER(name) LIKE ?
       OR LOWER(category) LIKE ?
       OR LOWER(description) LIKE ?
  `;
  pool.query(sql, [like, like, like], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "No products found" });
    res.json(results);
  });
});

// ----- AUTH ROUTES -----

app.post("/api/register", async (req, res) => {
  const { name, email, password, home_address = null } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, Email, and Password are required" });
  }
  try {
    const [existing] = await pool.promise().query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(400).json({ error: "Email already registered" });

    const hashed = bcrypt.hashSync(password, 10);
    const [result] = await pool
      .promise()
      .query("INSERT INTO users (name,email,home_address,password) VALUES (?,?,?,?)",
             [name, email, home_address, hashed]);
    const userId = result.insertId;

    const [[{ id: roleId }]] = await pool
      .promise()
      .query("SELECT id FROM roles WHERE name = 'customer'");
    await pool
      .promise()
      .query("INSERT INTO user_roles (user_id,role_id) VALUES (?,?)", [userId, roleId]);

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "All fields are required" });

  try {
    const [users] = await pool.promise().query("SELECT * FROM users WHERE email = ?", [email]);
    if (!users.length || !bcrypt.compareSync(password, users[0].password)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const user = users[0];
    const [roles] = await pool
      .promise()
      .query(
        `SELECT r.name FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = ?`,
        [user.id]
      );

    req.session.user = {
      id:    user.id,
      name:  user.name,
      email: user.email,
      home_address: user.home_address,
      roles: roles.map(r => r.name),
    };
    res.json({ message: "Login successful", user: req.session.user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});



app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).end();
    res.clearCookie("sid").sendStatus(200);
  });
});

const multer = require('multer');

// Use an absolute path for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'product_images'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, .png images are allowed'));
  }
};

const upload = multer({ storage, fileFilter });

app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
  }
  res.json({ filePath: path.posix.join('/product_images', req.file.filename) });
});


app.get("/api/session", (req, res) => {
  if (req.session.user) return res.json({ user: req.session.user });
  res.status(401).json({ error: "Not logged in" });
});



app.post("/api/payment", async (req, res) => {
  const { cardNumber, expiry, cvv, cart, address } = req.body;
  const userId = req.session.user?.id;

  // ─── Authentication & basic presence ───────────────────────────────────────
  if (!userId) {
    return res.status(401).json({ error: "Not logged in." });
  }
  if (!Array.isArray(cart) || !cart.length) {
    return res.status(400).json({ error: "Cart is empty or invalid." });
  }
  if (!address || !cardNumber || !expiry || !cvv) {
    return res.status(400).json({ error: "All payment fields and address are required." });
  }

  // ─── Card number must be exactly 16 digits ─────────────────────────────────
  if (!/^\d{16}$/.test(cardNumber)) {
    return res.status(400).json({ error: "Card number must be 16 digits." });
  }

  // ─── CVV must be exactly 3 digits ──────────────────────────────────────────
  if (!/^\d{3}$/.test(cvv)) {
    return res.status(400).json({ error: "CVV must be 3 digits." });
  }

  // ─── Expiry date format & range check: MM/YY ────────────────────────────────
  const parts = expiry.split("/");
  if (parts.length !== 2) {
    return res.status(400).json({ error: "Invalid expiry format. Use MM/YY." });
  }
  const month = parseInt(parts[0], 10);
  const year2 = parseInt(parts[1], 10);
  if (
    isNaN(month) || isNaN(year2) ||
    month < 1 || month > 12 ||
    parts[1].length !== 2
  ) {
    return res.status(400).json({ error: "Invalid expiry. Month must be 01–12 and year two digits." });
  }
  const fullYear  = 2000 + year2;
  const now       = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  if (fullYear < thisYear || (fullYear === thisYear && month < thisMonth)) {
    return res.status(400).json({ error: "Card has expired." });
  }

  // ─── (Optional) test‐card decline ─────────────────────────────────────────────
  if (cardNumber === "0000000000000000") {
    return res.status(400).json({ message: "Payment declined: Invalid card." });
  }

  // ─── Create order & deduct stock ─────────────────────────────────────────────
  let orderId;
  try {
    const conn = await pool.promise().getConnection();
    await conn.beginTransaction();

    const [orderRes] = await conn.query(
      "INSERT INTO orders (user_id, order_address) VALUES (?, ?)",
      [userId, address]
    );
    orderId = orderRes.insertId;

    for (const item of cart) {
      const [[prod]] = await conn.query(
        "SELECT stock, price, final_price FROM products WHERE id = ?",
        [item.id]
      );
        const unitPrice = (prod.final_price != null && prod.final_price > 0)
                  ? prod.final_price
                  : prod.price;

      if (!prod || prod.stock < item.quantity) {
        throw new Error(`Invalid stock for product ${item.id}`);
      }
      await conn.query(
        "UPDATE products SET stock = ? WHERE id = ?",
        [prod.stock - item.quantity, item.id]
      );
      await conn.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?,?,?,?)",
        [orderId, item.id, item.quantity, unitPrice]
      );
    }

    await conn.commit();
    conn.release();
  } catch (err) {
    console.error("Order/payment error:", err);
    return res.status(500).json({ error: "Failed to place order." });
  }

  // ─── Synchronously generate the invoice PDF ─────────────────────────────────
  try {
    // Build invoice items
    const invoiceItems = await Promise.all(
      cart.map(async i => {
        const [[prod]] = await pool
          .promise()
          .query(
            "SELECT model, serial_number, distributor_info FROM products WHERE id = ?",
            [i.id]
          );
        return {
          name:         i.name,
          distributor:  prod.distributor_info,
          model:        prod.model,
          serialNumber: prod.serial_number,
          qty:          Number(i.quantity),
          price:        Number(i.price),
          total:        Number(i.quantity) * Number(i.price),
        };
      })
    );

    const totalAmount = invoiceItems.reduce((sum, it) => sum + it.total, 0);
    const invoicePath = path.join(invoicesDir, `invoice_${orderId}.pdf`);

    // Wait for PDF to be written before responding
    await generateInvoice(
      {
        id:           orderId,
        customerName: req.session.user.name,
        address:      address,
        brand:        process.env.BRAND_NAME || "My Shop",
        serialNumber: `INV-${orderId}`,
        items:        invoiceItems,
        total:        totalAmount,
      },
      invoicePath
    );
  } catch (err) {
    console.error("Invoice generation error:", err);
    // proceed—user gets orderId even if invoice fails
  }

  // ─── Respond immediately with orderId ────────────────────────────────────────
  res.json({ message: "Order placed successfully", orderId });

  // ─── Fire‐and‐forget: read PDF & email ────────────────────────────────────────
  (async () => {
    try {
      const invoicePath = path.join(invoicesDir, `invoice_${orderId}.pdf`);
      const pdfBuffer   = fs.readFileSync(invoicePath);

      mg.messages().send({
        from:       process.env.EMAIL_FROM,
        to:         req.session.user.email,
        subject:    `Your Invoice #${orderId}`,
        text:       "Thank you for your purchase! Your invoice is attached.",
        attachment: pdfBuffer
      }, (err, body) => {
        if (err) console.error("Mailgun error:", err);
        else    console.log("Invoice emailed via Mailgun:", body.id);
      });
    } catch (err) {
      console.error("Invoice/email background error:", err);
    }
  })();
});



app.get("/api/orders", async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  try {
    // 1) Select the real date and status
    const [orders] = await pool.promise().query(
      `SELECT
         o.id          AS order_id,
         o.order_date  AS order_date,
         o.status      AS status
       FROM orders o
       WHERE o.user_id = ?
       ORDER BY o.order_date DESC`,
      [userId]
    );

    // 2) Fetch items for each order
    for (let order of orders) {
      const [items] = await pool.promise().query(
        `SELECT
          oi.product_id,
          p.name,
          oi.quantity,
          oi.price_at_time,
          (SELECT status FROM refund_requests rr
            WHERE rr.order_id = oi.order_id AND rr.product_id = oi.product_id
            LIMIT 1) AS refund_status
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?`,
        [order.order_id]
      );
      order.items = items;
    }

    res.json(orders);
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});
app.get("/api/invoice", requireSalesManager, async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "start and end dates are required" });
  }

  try {
    // Sum up each order’s total = price_at_time * qty
    const [rows] = await pool.promise().query(
      `SELECT
         o.id                     AS id,
         o.order_date             AS date,     -- full DATETIME now
         u.name                   AS customer,
         SUM(oi.price_at_time * oi.quantity) AS total
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN users u         ON u.id = o.user_id
       WHERE DATE(o.order_date) BETWEEN ? AND ?
       GROUP BY o.id, u.name, DATE(o.order_date)
       ORDER BY o.order_date DESC`,
      [start, end]
    );

    res.json(
      rows.map(r => ({
        id:       r.id,
        date:     r.date,                // "2025-05-20"
        customer: r.customer,
        total:    Number(r.total)        // float
      }))
    );
  } catch (err) {
    console.error("Error fetching invoices:", err);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});
app.get("/api/report", requireSalesManager, async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "start and end dates are required" });
  }

  try {
    const [rows] = await pool.promise().query(
      `
      SELECT
        DATE(o.order_date) AS day,

        -- Net revenue = sold revenue minus refunded revenue
        SUM(
          oi.price_at_time * oi.quantity
          - IF(rr.id IS NOT NULL, oi.price_at_time * oi.quantity, 0)
        ) AS revenue,

        -- Net profit = (price−cost)×qty minus refunded profit
        SUM(
          (oi.price_at_time - p.cost) * oi.quantity
          - IF(rr.id IS NOT NULL, (oi.price_at_time - p.cost) * oi.quantity, 0)
        ) AS profit

      FROM orders o
      JOIN order_items oi
        ON oi.order_id   = o.id
      JOIN products p
        ON p.id          = oi.product_id

      -- join in any approved refund for that order/item
      LEFT JOIN refund_requests rr
        ON rr.order_id     = o.id
       AND rr.product_id   = oi.product_id
       AND rr.status       = 'approved'

      WHERE DATE(o.order_date) BETWEEN ? AND ?
      GROUP BY DATE(o.order_date)
      ORDER BY DATE(o.order_date) ASC
      `,
      [start, end]
    );

    res.json(
      rows.map(r => ({
        day:     r.day,
        revenue: Number(r.revenue),
        profit:  Number(r.profit)
      }))
    );
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

app.get("/api/invoice/:orderId", (req, res) => {
  const file = path.join(invoicesDir, `invoice_${req.params.orderId}.pdf`);
  res.sendFile(file, err => {
    if (err) res.status(404).json({ error: "Invoice not found" });
  });
});
app.post('/api/invoice/:orderId/email', async (req, res) => {
  const orderId = req.params.orderId;
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const invoicePath = path.join(invoicesDir, `invoice_${orderId}.pdf`);
  if (!fs.existsSync(invoicePath)) {
    return res.status(404).json({ error: 'Invoice file not found' });
  }

  try {
    const pdfBuffer = fs.readFileSync(invoicePath);
    const data = {
      from:       process.env.EMAIL_FROM,
      to:         user.email,
      subject:    `Your Invoice #${orderId}`,
      text:       'Here is your invoice again. Thank you for your purchase!',
      attachment: pdfBuffer
    };

    mg.messages().send(data, (err, body) => {
      if (err) {
        console.error('Mailgun resend error:', err);
        return res.status(500).json({ error: 'Failed to send email' });
      }
      console.log('Invoice re-emailed via Mailgun:', body.id);
      return res.json({ message: 'Invoice emailed successfully' });
    });
  } catch (e) {
    console.error('Resend background error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user's wishlist
 app.get('/api/wishlist', async (req, res) => {
   if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });
   const userId = req.session.user.id;
   try {
     const [rows] = await pool.promise().query(
       `SELECT p.*
          FROM wishlists w
          JOIN products p ON w.product_id = p.id
         WHERE w.user_id = ?`,
       [userId]
     );
     res.json(rows);
   } catch (err) {
     console.error('Error fetching wishlist:', err);
     res.status(500).json({ error: 'Failed to fetch wishlist' });
   }
 });
 
 // Add a product to wishlist
 app.post('/api/wishlist', async (req, res) => {
   if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });
   const userId = req.session.user.id;
   const { productId } = req.body;
   if (!productId) return res.status(400).json({ error: 'Product ID required' });
   try {
     await pool.promise().query(
       `INSERT IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)`,
       [userId, productId]
     );
     res.json({ message: 'Added to wishlist' });
   } catch (err) {
     console.error('Error adding to wishlist:', err);
     res.status(500).json({ error: 'Failed to add to wishlist' });
   }
 });
 
 // Remove a product from wishlist
 app.delete('/api/wishlist/:productId', async (req, res) => {
   if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });
   const userId = req.session.user.id;
   const productId = req.params.productId;
   try {
     await pool.promise().query(
       `DELETE FROM wishlists WHERE user_id = ? AND product_id = ?`,
       [userId, productId]
     );
     res.json({ message: 'Removed from wishlist' });
   } catch (err) {
     console.error('Error removing from wishlist:', err);
     res.status(500).json({ error: 'Failed to remove from wishlist' });
   }
 });


// ----- COMMENT & RATING ROUTES -----

// 2) Fetch approved comments (with rating)
app.get("/api/comments/:productId", async (req, res) => {
  const productId = req.params.productId;
  try {
    const [rows] = await pool.promise().query(
      `SELECT
         c.id           AS comment_id,
         c.user_id,
         c.comment_text,
         c.created_at,
         u.name,
         r.rating
       FROM comments c
       JOIN users u
         ON u.id = c.user_id
       LEFT JOIN ratings r
         ON r.user_id = c.user_id
        AND r.product_id = c.product_id
       WHERE c.product_id = ?
         AND c.approved = TRUE
       ORDER BY c.created_at DESC`,
      [productId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Comments fetch error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});


// 3) Fetch the single pending comment (with rating)
app.get("/api/pending-comment/:productId", async (req, res) => {
  const productId = req.params.productId;
  const userId    = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [rows] = await pool.promise().query(
      `SELECT
         c.id           AS comment_id,
         c.comment_text,
         c.created_at,
         r.rating
       FROM comments c
       LEFT JOIN ratings r
         ON r.user_id = c.user_id
        AND r.product_id = c.product_id
       WHERE c.product_id = ?
         AND c.user_id    = ?
         AND c.approved   = FALSE
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [productId, userId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error("Pending comment error:", err);
    res.status(500).json({ error: "Failed to fetch pending comment" });
  }
});


app.delete("/api/delete-comment/:commentId", async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [[c]] = await pool.promise().query(
      "SELECT product_id FROM comments WHERE id = ? AND user_id = ?",
      [req.params.commentId, userId]
    );
    if (!c) return res.status(404).json({ error: "Comment not found or not authorized." });

    await pool.promise().query("DELETE FROM comments WHERE id = ? AND user_id = ?", [
      req.params.commentId, userId
    ]);
    await pool.promise().query("DELETE FROM ratings WHERE product_id = ? AND user_id = ?", [
      c.product_id, userId
    ]);
    res.json({ message: "Comment and rating deleted successfully." });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment and rating." });
  }
});

app.get("/api/ratings/:productId", async (req, res) => {
  try {
    const [row] = await pool.promise().query(
      `SELECT AVG(rating) AS average_rating, COUNT(*) AS total_ratings
       FROM ratings WHERE product_id = ?`,
      [req.params.productId]
    );
    res.json(row[0] || row);
  } catch (err) {
    console.error("Ratings fetch error:", err);
    res.status(500).json({ error: "Failed to fetch rating" });
  }
});

app.get("/api/can-review/:productId", async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [rows] = await pool.promise().query(
      `SELECT 1 FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.product_id = ?`,
      [userId, req.params.productId]
    );
    res.json({ canReview: rows.length > 0 });
  } catch (err) {
    console.error("Can-review error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/ratings", async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { productId, rating } = req.body;
  if (!productId || rating == null) {
    return res.status(400).json({ error: "Product ID and rating required." });
  }

  try {
    const [exist] = await pool.promise().query(
      "SELECT 1 FROM ratings WHERE user_id = ? AND product_id = ?",
      [userId, productId]
    );

    if (exist.length) {
      // Rating already exists: UPDATE it
      await pool.promise().query(
        "UPDATE ratings SET rating = ? WHERE user_id = ? AND product_id = ?",
        [rating, userId, productId]
      );
    } else {
      // No existing rating: INSERT new one
      await pool.promise().query(
        "INSERT INTO ratings (user_id, product_id, rating) VALUES (?,?,?)",
        [userId, productId, rating]
      );
    }

    res.json({ message: "Rating submitted successfully." });
  } catch (err) {
    console.error("Post rating error:", err);
    res.status(500).json({ error: "Failed to submit rating." });
  }
});


app.post("/api/comments", async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { productId, comment_text } = req.body;
  if (!productId || !comment_text) {
    return res.status(400).json({ error: "Product ID and comment required." });
  }
  try {
    const [rated] = await pool.promise().query(
      "SELECT 1 FROM ratings WHERE user_id = ? AND product_id = ?",
      [userId, productId]
    );
    if (!rated.length) {
      return res.status(403).json({ error: "You must rate before commenting." });
    }
    const [pending] = await pool.promise().query(
      `SELECT 1 FROM comments
       WHERE user_id = ? AND product_id = ? AND approved = FALSE`,
      [userId, productId]
    );
    if (pending.length) {
      return res.status(400).json({ error: "You already have a pending comment." });
    }
    await pool.promise().query(
      `INSERT INTO comments (user_id, product_id, comment_text, approved, created_at)
       VALUES (?,?,?,FALSE,NOW())`,
      [userId, productId, comment_text]
    );
    res.json({ message: "Comment submitted for review." });
  } catch (err) {
    console.error("Post comment error:", err);
    res.status(500).json({ error: "Failed to post comment." });
  }
});

// ----- PROFILE ROUTES -----

// GET /api/user/profile
app.get("/api/user/profile", async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const [rows] = await pool
      .promise()
      .query(
        "SELECT id, name, email, home_address, tax_id FROM users WHERE id = ?",
        [userId]
      );
    if (!rows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /api/user/profile
app.put("/api/user/profile", async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name, home_address, password, tax_id } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  try {
    // build dynamic SET clause
    const fields = ["name = ?", "home_address = ?", "tax_id = ?"];
    const params = [name, home_address || null, tax_id];

    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      fields.push("password = ?");
      params.push(hashed);
    }

    params.push(userId);
    const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
    await pool.promise().query(sql, params);

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

app.get("/api/invoice/:orderId/pdf", requireSalesManager, (req, res) => {
  const file = path.join(invoicesDir, `invoice_${req.params.orderId}.pdf`);
  res.sendFile(file, err => {
    if (err) return res.status(404).json({ error: "Invoice not found" });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// product manager
// Get all unapproved comments for a specific product
app.get('/api/pending-comments-pm/:productId', async (req, res) => {

  const { productId } = req.params;

  try {
    const [rows] = await pool.promise().query(
      `SELECT 
        c.id AS comment_id,
        c.user_id,
        c.comment_text,
        c.created_at,
        r.rating
      FROM comments c
      LEFT JOIN ratings r ON r.user_id = c.user_id AND r.product_id = c.product_id
      WHERE c.product_id = ? 
        AND c.approved = FALSE
      ORDER BY c.created_at DESC`,
      [productId]
    );

    if (rows.length > 0) {
      res.json(rows);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error('Error fetching pending comments:', err);
    res.status(500).json({ error: 'Failed to fetch pending comments' });
  }
});

// Approve a specific comment
app.put('/api/approve-comment/:commentId', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { commentId } = req.params;

  try {
    // Update the 'approved' field to true for the specified comment
    const [result] = await pool.promise().query(
      `UPDATE comments 
       SET approved = TRUE 
       WHERE id = ? AND approved = FALSE`,
      [commentId]
    );

    if (result.affectedRows > 0) {
      res.json({ message: 'Comment approved successfully' });
    } else {
      res.status(404).json({ error: 'Comment not found or already approved' });
    }
  } catch (err) {
    console.error('Error approving comment:', err);
    res.status(500).json({ error: 'Failed to approve comment' });
  }
});

app.delete('/api/delete-product/:productId', async (req, res) => {
  const { productId } = req.params;

  try {
    const [result] = await pool.promise().query(
      'UPDATE products SET is_active = FALSE WHERE id = ?',
      [productId]
    );

    if (result.affectedRows > 0) {
      res.json({ message: 'Product deactivated successfully' });
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (err) {
    console.error('Error deactivating product:', err);
    res.status(500).json({ error: 'Failed to deactivate product' });
  }
});

app.post('/api/add-product', async (req, res) => {
  const {
    name,
    description = null,
    category_id,
    price = null,
    cost = 0.00,          // ← default cost
    stock = 0,
    popularity = 0,
    image_path = null,
    model = 'N/A',
    serial_number = 'N/A',
    warranty_status = 'No Warranty',
    distributor_info = 'N/A'
  } = req.body;

  if (!name || !category_id) {
    return res.status(400).json({ error: 'Name and category are required' });
  }

  try {
    const [result] = await pool.promise().query(
      `INSERT INTO products
        (name,description,category_id,price,cost,stock,popularity,image_path,
         model,serial_number,warranty_status,distributor_info)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, description, category_id,
        price, cost,     // ← include cost here
        stock, popularity, image_path,
        model, serial_number,
        warranty_status, distributor_info
      ]
    );

    res.json({
      message: 'Product added successfully',
      productId: result.insertId
    });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});



app.put('/api/update-stock/:productId', async (req, res) => {
  const { productId } = req.params;
  const { stock } = req.body;

  // Validate productId and stock
  if (isNaN(productId) || isNaN(stock) || stock < 0) {
    return res.status(400).json({ error: 'Invalid product ID or stock value' });
  }

  try {
    // Check if the product exists in the database
    const [product] = await pool.promise().query('SELECT * FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update the stock of the product
    await pool.promise().query(
      'UPDATE products SET stock = ? WHERE id = ?',
      [stock, productId]
    );

    res.json({ message: 'Stock updated successfully' });
  } catch (err) {
    console.error('Error updating stock:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

app.get('/api/orders-pm', async (req, res) => {
  try {
    const [orders] = await pool.promise().query(`
  SELECT o.id   AS order_id,
         o.order_date,
         o.status,
         o.order_address,
         o.user_id,
         oi.product_id,
         p.name  AS product_name,
         oi.quantity,
         oi.price_at_time
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p     ON p.id        = oi.product_id
   WHERE o.status NOT IN ('cancelled','refunded')
`);

    // Group order items by order_id
    const detailedOrders = orders.reduce((acc, order) => {
      const { order_id, order_date, status, order_address, user_id, product_id, product_name, quantity, price_at_time } = order;

      if (!acc[order_id]) {
        acc[order_id] = {
          order_id,
          order_date,
          status,
          order_address,
          user_id,
          items: []
        };
      }

      acc[order_id].items.push({ product_id, product_name, quantity, price_at_time });
      
      return acc;
    }, {});

    // Convert to an array of order details
    const result = Object.values(detailedOrders);
    res.json(result);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.put('/api/orders-pm/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;  // Expecting a new status from the request body

  if (!['processing', 'in-transit', 'delivered', 'refunded'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Update the order status in the orders table
    await pool.promise().query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, orderId]
    );
    res.json({ message: 'Order status updated successfully' });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

app.delete("/api/delete-comment-pm/:commentId", async (req, res) => {
  
  try {
    const [[c]] = await pool.promise().query(
      "SELECT product_id FROM comments WHERE id = ?",
      [req.params.commentId]
    );
    if (!c) return res.status(404).json({ error: "Comment not found or not authorized." });

    await pool.promise().query("DELETE FROM comments WHERE id = ?", [
      req.params.commentId
    ]);

    res.json({ message: "Comment deleted successfully." });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment and rating." });
  }
});

// POST /api/orders/:orderId/cancel
app.post('/api/orders/:orderId/cancel', async (req, res) => {
  const orderId = parseInt(req.params.orderId, 10);
  const userId = req.session.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const conn = await pool.promise().getConnection();
  try {
    // Start transaction
    await conn.beginTransaction();

    // Check ownership and current status
    const [orders] = await conn.query(
      'SELECT status FROM orders WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );

    if (orders.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Order not found or not authorized' });
    }

    const { status } = orders[0];

    if (status !== 'processing') {
      await conn.rollback();
      return res.status(400).json({ message: 'Only orders in processing state can be cancelled' });
    }

    // Fetch ordered items
    const [items] = await conn.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [orderId]
    );

    // Restore product stock
    for (const item of items) {
      await conn.query(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // Set order status to cancelled
    await conn.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      ['cancelled', orderId]
    );

    await conn.commit();
    res.json({ message: 'Order cancelled and stock restored successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('Error cancelling order:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    conn.release();
  }
});



app.put('/api/refund-requests/:id/approve', async (req, res) => {
  const refundId = Number(req.params.id);
  if (isNaN(refundId)) {
    return res.status(400).json({ error: 'Invalid refund ID' });
  }

  const conn = await pool.promise().getConnection();
  try {
    await conn.beginTransaction();

    // 1) load refund + quantity + user email/name
    const [[refund]] = await conn.query(
  `SELECT
     rr.user_id,
     rr.order_id,
     rr.product_id,
     oi.quantity,
     p.name    AS product_name,
     u.email   AS user_email,
     u.name    AS user_name
   FROM refund_requests rr
   JOIN order_items oi
     ON oi.order_id   = rr.order_id
    AND oi.product_id = rr.product_id
   JOIN products p
     ON p.id = rr.product_id
   JOIN users u
     ON u.id = rr.user_id
   WHERE rr.id = ?
     AND rr.status = 'pending'`,
  [refundId]
);

    if (!refund) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Refund request not found or already handled' });
    }

    // 2) restore stock
    await conn.query(
      'UPDATE products SET stock = stock + ? WHERE id = ?',
      [refund.quantity, refund.product_id]
    );

    // 3) mark refund approved & stamp processed_at
    await conn.query(
      `UPDATE refund_requests
          SET status       = 'approved',
              processed_at = NOW()
        WHERE id = ?`,
      [refundId]
    );

    await conn.commit();
    conn.release();

    // 4) fire-and-forget email
    mg.messages().send({
      from:    process.env.EMAIL_FROM,
      to:      refund.user_email,
      subject: `Your refund ${refundId} has been approved`,
      text:    `Hi ${refund.user_name},\n\n` +
               `Your refund for product ${refund.product_name} is now approved. ` +
               `You should see your credit in 5–7 business days.\n\nThanks,\nThe Team`
    }, err => {
      if (err) console.error('Mailgun refund-approval error:', err);
    });

    return res.json({ message: 'Refund approved and user emailed.' });

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Approve refund error:', err);
    return res.status(500).json({ error: 'Failed to approve refund' });
  }
});



app.post('/api/refund-requests', async (req, res) => {
  const userId    = req.session.user?.id;
  const { orderId, productId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  if (!orderId || !productId) {
    return res.status(400).json({ error: 'orderId and productId are required' });
  }

  try {
    // Optional: verify that the order belongs to this user
    const [[order]] = await pool.promise().query(
      `SELECT status, order_date
         FROM orders
        WHERE id = ? AND user_id = ?`,
      [orderId, userId]
    );
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Only delivered orders can be refunded' });
    }
    // Optional: enforce 30-day refund window
    const daysSince = Math.floor((Date.now() - new Date(order.order_date)) / (1000*60*60*24));
    if (daysSince > 30) {
      return res.status(400).json({ error: 'Refund window has closed' });
    }

    // Prevent duplicate requests
    const [[existing]] = await pool.promise().query(
      `SELECT 1 FROM refund_requests
        WHERE user_id = ? AND order_id = ? AND product_id = ?`,
      [userId, orderId, productId]
    );
    if (existing) {
      return res.status(400).json({ error: 'Refund already requested for this item' });
    }

    // Insert the pending refund
    await pool.promise().query(
      `INSERT INTO refund_requests
         (user_id, order_id, product_id, status, request_date)
       VALUES (?, ?, ?, 'pending', NOW())`,
      [userId, orderId, productId]
    );

    res.json({ message: 'Refund request submitted' });
  } catch (err) {
    console.error('Create refund error:', err);
    res.status(500).json({ error: 'Failed to request refund' });
  }
});
app.get('/api/refund-requests', async (req, res) => {
  try {
    const [rows] = await pool.promise().query(
      `SELECT
         rr.id,
         rr.order_id,
         rr.product_id,
         oi.quantity,
         p.name   AS product_name,
         u.name   AS customer_name,
         rr.request_date
       FROM refund_requests rr
       JOIN order_items oi
         ON oi.order_id   = rr.order_id
        AND oi.product_id = rr.product_id
       JOIN products p
         ON p.id = rr.product_id
       JOIN users u
         ON u.id = rr.user_id
      WHERE rr.status = 'pending'
      ORDER BY rr.request_date DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching refund requests:', err);
    res.status(500).json({ error: 'Failed to fetch refund requests' });
  }
});

app.post('/api/add-category', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    await pool.promise().query(
      'INSERT INTO categories (name) VALUES (?)',
      [name]
    );

    res.json({ message: 'Category added successfully.' });
  } catch (err) {
    console.error('Error adding category:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Category name must be unique' });
    } else {
      res.status(500).json({ error: 'Failed to add category' });
    }
  }
});

app.delete('/api/delete-category/:categoryId', async (req, res) => {
  const { categoryId } = req.params;

  try {
    // First, deactivate all products in that category
    await pool.promise().query(
      'UPDATE products SET is_active = 0 WHERE category_id = ?',
      [categoryId]
    );

    // Then delete the category
    const [result] = await pool.promise().query(
      'UPDATE categories SET is_active = 0 WHERE id = ?',
      [categoryId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted & all related products deactivated.' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

