// server.js
require('dotenv').config();
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const backendSession = require('./sessionmanager');
const { google } = require('googleapis');
const React = require('react');
const { InvoiceDocument, pdf } = require('./InvoiceDocServer');

const app = express();
const port = process.env.PORT || 5000;

// ——— Database pool ———
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "ecommerce",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ——— OAuth2 & Gmail setup ———
const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

// ——— Helpers for building & sending the PDF email ———
function makeRawMessage(toEmail, subject, text, buffer, filename) {
  const boundary = '----=_Boundary_' + Date.now();
  const nl = '\r\n';
  const parts = [
    `From: ${process.env.GMAIL_FROM}`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    buffer.toString('base64'),
    '',
    `--${boundary}--`,
    ''
  ];
  return Buffer.from(parts.join(nl))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendInvoiceEmail(orderId, userEmail, userName) {
  // 1) load order + items
  const [[order]] = await pool.promise().query(
    'SELECT * FROM orders WHERE id = ?', [orderId]
  );
  const [items] = await pool.promise().query(
    `SELECT oi.product_id,p.name,oi.quantity,oi.price_at_time
       FROM order_items oi
       JOIN products p ON oi.product_id=p.id
       WHERE oi.order_id = ?`, [orderId]
  );

  // 2) render PDF
  const doc = React.createElement(InvoiceDocument, {
    order: {
      order_id: order.id,
      order_date: order.order_date,
      name: userName
    },
    items
  });
  const pdfInstance = pdf([]);
  pdfInstance.updateContainer(doc);
  const buffer = await pdfInstance.toBuffer();

  // 3) send via Gmail API
  const raw = makeRawMessage(
    userEmail,
    `Your Invoice #${orderId}`,
    'Thank you for your purchase! Attached is your invoice.',
    buffer,
    `invoice_${orderId}.pdf`
  );
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw }
  });
}

// ——— Middleware ———
app.use('/product_images', express.static('product_images'));
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(backendSession);

/** PRODUCTS **/
app.get('/api/products', (req, res) => {
  pool.query('SELECT * FROM products', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});
app.get('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  pool.query('SELECT * FROM products WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!results.length) return res.status(404).json({ error: 'Not found' });
    res.json(results[0]);
  });
});

/** AUTH **/
app.post("/api/register", async (req, res) => {
  const { name, email, password, home_address = null } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    const [exists] = await pool.promise().query("SELECT id FROM users WHERE email = ?", [email]);
    if (exists.length) return res.status(400).json({ error: "Email taken" });
    const hash = bcrypt.hashSync(password, 10);
    await pool.promise().query(
      "INSERT INTO users (name,email,home_address,password) VALUES (?,?,?,?)",
      [name, email, home_address, hash]
    );
    res.status(201).json({ message: "Registered" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    const [rows] = await pool.promise().query("SELECT * FROM users WHERE email = ?", [email]);
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });
    const u = rows[0];
    if (!bcrypt.compareSync(password, u.password)) return res.status(401).json({ error: "Invalid credentials" });
    req.session.user = { id: u.id, name: u.name, email: u.email };
    res.json({ message: "Login successful", user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

app.get('/api/session', (req, res) => {
  if (req.session.user) return res.json({ user: req.session.user });
  res.status(401).json({ error: 'Not logged in' });
});

app.post('/api/payment', async (req, res) => {
  // 1) Ensure user is logged in
  const userSession = req.session.user;
  if (!userSession?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = userSession.id;

  // 2) Extract payment info + cart
  const { cardNumber, expiry, cvv, cart } = req.body;
  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Invalid cart data' });
  }
  if (cardNumber === '0000000000000000') {
    return res.status(400).json({ message: 'Declined' });
  }

  const conn = await pool.promise().getConnection();
  try {
    await conn.beginTransaction();

    // 3) Create the order row
    const [orderResult] = await conn.query(
      'INSERT INTO orders (user_id) VALUES (?)',
      [userId]
    );
    const orderId = orderResult.insertId;

    // 4) For each cart item, update stock and insert into order_items
    for (let item of cart) {
      // pick the right field for product ID
      const productId = item.productId ?? item.id;
      const [[p]] = await conn.query(
        'SELECT stock,price FROM products WHERE id = ?',
        [productId]
      );
      if (!p) throw new Error(`Product missing (id=${productId})`);
      if (p.stock < item.quantity) throw new Error(`Out of stock (id=${productId})`);

      // decrement stock
      await conn.query(
        'UPDATE products SET stock = ? WHERE id = ?',
        [p.stock - item.quantity, productId]
      );

      // record the line item
      await conn.query(
        `INSERT INTO order_items
           (order_id, product_id, quantity, price_at_time)
         VALUES (?,?,?,?)`,
        [orderId, productId, item.quantity, p.price]
      );
    }

    await conn.commit();

    // 5) Send the invoice email
    try {
      await sendInvoiceEmail(orderId, userSession.email, userSession.name);
    } catch (emailErr) {
      console.error('Invoice email failed:', emailErr);
      // we continue—order succeeded even if email failed
    }

    // 6) Respond to client
    res.json({ message: 'Order placed & invoice emailed', orderId });

  } catch (e) {
    await conn.rollback();
    console.error('Payment error:', e);
    res.status(500).json({ error: 'Failed to place order' });
  } finally {
    conn.release();
  }
});

/** FETCH ORDERS **/
app.get('/api/orders', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [orders] = await pool.promise().query(
      'SELECT * FROM orders WHERE user_id=? ORDER BY order_date DESC',
      [req.session.user.id]
    );
    const detailed = await Promise.all(orders.map(async o => {
      const [items] = await pool.promise().query(
        `SELECT oi.product_id,p.name,oi.quantity,oi.price_at_time
         FROM order_items oi
         JOIN products p ON oi.product_id=p.id
         WHERE oi.order_id=?`,
        [o.id]
      );
      return { order_id: o.id, order_date: o.order_date, status: o.status, items };
    }));
    res.json(detailed);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/** SEARCH **/
app.get('/api/search', (req, res) => {
  const q = req.query.q?.toLowerCase();
  if (!q) return res.status(400).json({ error: 'Missing query' });
  const like = `%${q}%`;
  pool.query(
    `SELECT * FROM products WHERE
       LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(description) LIKE ?`,
    [like, like, like],
    (e, results) => {
      if (e) return res.status(500).json({ error: 'DB error' });
      if (!results.length) return res.status(404).json({ message: 'No results' });
      res.json(results);
    }
  );
});

/** USER PROFILE **/
app.get('/api/user/profile', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [rows] = await pool.promise().query(
      'SELECT id,name,email,home_address FROM users WHERE id=?',
      [req.session.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});
app.put('/api/user/profile', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const { name, home_address, password } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const fields = ['name=?'], params = [name];
    fields.push('home_address=?'); params.push(home_address || null);
    if (password) {
      fields.push('password=?');
      params.push(bcrypt.hashSync(password, 10));
    }
    params.push(req.session.user.id);
    await pool.promise().query(`UPDATE users SET ${fields.join(',')} WHERE id=?`, params);
    res.json({ message: 'Profile updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

/** MANUAL EMAIL-INVOICE ROUTE (optional) **/
app.post('/api/email-invoice/:orderId', async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) return res.status(400).json({ error: 'Invalid orderId' });

    await sendInvoiceEmail(
      orderId,
      req.session.user.email,
      req.session.user.name
    );

    res.json({ message: 'Invoice emailed via Gmail API' });
  } catch (err) {
    console.error('Gmail send error:', err);
    res.status(500).json({ error: 'Failed to send invoice via Gmail' });
  }
});

// ——— Start server ———
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
