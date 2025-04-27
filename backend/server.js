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

// ----- PRODUCT ROUTES -----

app.get("/api/products", (req, res) => {
  pool.query("SELECT * FROM products WHERE is_active = TRUE", (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(results);
  });
});

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
  pool.query("SELECT * FROM categories", (err, results) => {
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

app.get("/api/session", (req, res) => {
  if (req.session.user) return res.json({ user: req.session.user });
  res.status(401).json({ error: "Not logged in" });
});



app.post("/api/payment", async (req, res) => {
  const { cardNumber, expiry, cvv, cart } = req.body;
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Not logged in." });
  if (!Array.isArray(cart) || !cart.length) {
    return res.status(400).json({ error: "Cart is empty or invalid." });
  }
  if (cardNumber === "0000000000000000") {
    return res.status(400).json({ message: "Payment declined: Invalid card." });
  }

  let orderId;
  try {
    const conn = await pool.promise().getConnection();
    await conn.beginTransaction();

    const [orderRes] = await conn.query("INSERT INTO orders (user_id) VALUES (?)", [userId]);
    orderId = orderRes.insertId;

    for (const item of cart) {
      const [[prod]] = await conn.query("SELECT stock,price FROM products WHERE id = ?", [item.id]);
      if (!prod || prod.stock < item.quantity) {
        throw new Error(`Invalid stock for product ${item.id}`);
      }
      await conn.query("UPDATE products SET stock = ? WHERE id = ?", [prod.stock - item.quantity, item.id]);
      await conn.query(
        "INSERT INTO order_items (order_id,product_id,quantity,price_at_time) VALUES (?,?,?,?)",
        [orderId, item.id, item.quantity, prod.price]
      );
    }

    await conn.commit();
    conn.release();
  } catch (err) {
    console.error("Order/payment error:", err);
    return res.status(500).json({ error: "Failed to place order." });
  }

  // Respond immediately
  res.json({ message: "Order placed successfully", orderId });

  // Fire-and-forget invoice + email
  (async () => {
    try {
      const invoiceItems = cart.map(i => ({ name: i.name, qty: Number(i.quantity), price: Number(i.price) }));
      const totalAmount = invoiceItems.reduce((sum, i) => sum + i.qty * i.price, 0);
      const invoicePath = path.join(invoicesDir, `invoice_${orderId}.pdf`);

      await generateInvoice(
        { id: orderId, customerName: req.session.user.name, items: invoiceItems, total: totalAmount },
        invoicePath
      );

      const pdfBuffer = fs.readFileSync(invoicePath);
      const data = {
        from:       process.env.EMAIL_FROM,
        to:         req.session.user.email,
        subject:    `Your Invoice #${orderId}`,
        text:       "Thank you for your purchase! Your invoice is attached.",
        attachment: pdfBuffer
      };

      mg.messages().send(data, (err, body) => {
        if (err) console.error("Mailgun error:", err);
        else console.log("Invoice emailed via Mailgun:", body.id);
      });
    } catch (e) {
      console.error("Invoice/email background error:", e);
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
           oi.price_at_time
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

app.get("/api/user/profile", async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [rows] = await pool.promise().query(
      "SELECT id, name, email, home_address FROM users WHERE id = ?",
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

app.put("/api/user/profile", async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { name, home_address, password } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const fields = ["name = ?"];
    const params = [name];
    fields.push("home_address = ?");
    params.push(home_address || null);
    if (password) {
      const h = bcrypt.hashSync(password, 10);
      fields.push("password = ?");
      params.push(h);
    }
    params.push(userId);
    const sql = `UPDATE users SET ${fields.join(",")} WHERE id = ?`;
    await pool.promise().query(sql, params);
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to save profile" });
  }
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
  const { name, description, category, price, stock = 0, popularity = 0, image_path = null } = req.body;

  if (!name || !category === undefined) {
    return res.status(400).json({ error: 'Name, category, and price are required' });
  }

  try {
    // Query to get category ID based on category name
    const [categoryResult] = await pool.promise().query(
      `SELECT id FROM categories WHERE name = ?`, [category]
    );

    if (categoryResult.length === 0) {
      return res.status(400).json({ error: 'Category not found' });
    }

    const categoryId = categoryResult[0].id;

    const [result] = await pool.promise().query(
      `INSERT INTO products (name, description, category_id, price, stock, popularity, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description, categoryId, price, stock, popularity, image_path]
    );

    res.json({ message: 'Product added successfully', productId: result.insertId });
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
    const [orders] = await pool.promise().query(
      `SELECT o.id AS order_id, o.order_date, o.status, 
              oi.product_id, p.name AS product_name, oi.quantity, oi.price_at_time 
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id`
    );

    // Group order items by order_id
    const detailedOrders = orders.reduce((acc, order) => {
      const { order_id, order_date, status, product_id, product_name, quantity, price_at_time } = order;

      if (!acc[order_id]) {
        acc[order_id] = {
          order_id,
          order_date,
          status,
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
