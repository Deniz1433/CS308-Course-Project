// server.js
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const backendSession = require('./sessionmanager'); // Adjust path as needed
require("dotenv").config();

const app = express();
const port = 5000;

app.use('/product_images', express.static('product_images'));
app.use(cors({
  origin: 'http://localhost:3000', // frontend origin
  credentials: true
}));
app.use(express.json());
app.use(backendSession);

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "ecommerce",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Get all products
app.get('/api/products', (req, res) => {
  const query = 'SELECT * FROM products';
  pool.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
  const productId = req.params.id;
  if (isNaN(productId)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }
  const query = 'SELECT * FROM products WHERE id = ?';
  pool.query(query, [productId], (error, results) => {
    if (error) {
      console.error('Error fetching product:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(results[0]);
  });
});

// Register
app.post("/api/register", async (req, res) => {
  const { name, email, password, home_address = null } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, Email, and Password are required" });
  }
  try {
    const [existingUser] = await pool.promise().query("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email is already registered" });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    await pool.promise().query(
      "INSERT INTO users (name, email, home_address, password) VALUES (?, ?, ?, ?)",
      [name, email, home_address, hashedPassword]
    );
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    const [user] = await pool.promise().query("SELECT * FROM users WHERE email = ?", [email]);
    if (user.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const isValidPassword = bcrypt.compareSync(password, user[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    req.session.user = { id: user[0].id, name: user[0].name, email: user[0].email };
    res.status(200).json({ message: "Login successful", user: req.session.user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Payment Endpoint with stock deduction and order creation
app.post('/api/payment', async (req, res) => {
  const { cardNumber, expiry, cvv, cart, userId } = req.body;

  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: "Cart is empty or invalid." });
  }

  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }

  try {
    // Simulate payment check
    if (cardNumber === '0000000000000000') {
      return res.status(400).json({ message: 'Payment declined: Invalid card.' });
    }

    // Start transaction
    const connection = await pool.promise().getConnection();
    try {
      await connection.beginTransaction();

      // Create order
      const [orderResult] = await connection.query(
        "INSERT INTO orders (user_id) VALUES (?)",
        [userId]
      );
      const orderId = orderResult.insertId;

      // Insert order items and update stock
      for (const item of cart) {
        const [productRows] = await connection.query(
          "SELECT stock, price FROM products WHERE id = ?",
          [item.productId]
        );

        const product = productRows[0];
        if (!product) throw new Error(`Product ID ${item.productId} not found.`);
        if (product.stock < item.quantity) throw new Error(`Not enough stock for product ID ${item.productId}.`);

        const newStock = product.stock - item.quantity;

        // Update stock
        await connection.query(
          "UPDATE products SET stock = ? WHERE id = ?",
          [newStock, item.productId]
        );

        // Add to order_items
        await connection.query(
          "INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)",
          [orderId, item.productId, item.quantity, product.price]
        );
      }

      await connection.commit();
      connection.release();

      res.status(200).json({ message: "Order placed successfully", orderId });
    } catch (err) {
      await connection.rollback();
      connection.release();
      console.error("Order creation error:", err);
      res.status(500).json({ error: "Failed to place order." });
    }
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ error: "Server error" });
  }
});



// Place order
app.post('/api/place-order', async (req, res) => {
  const { userId, cartItems } = req.body;
  if (!userId || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: "Invalid order data" });
  }
  const connection = await pool.promise().getConnection();
  try {
    await connection.beginTransaction();
    const [orderResult] = await connection.query("INSERT INTO orders (user_id) VALUES (?)", [userId]);
    const orderId = orderResult.insertId;
    for (const item of cartItems) {
      await connection.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)",
        [orderId, item.productId, item.quantity, item.price]
      );
    }
    await connection.commit();
    res.status(200).json({ message: "Order placed successfully", orderId });
  } catch (error) {
    await connection.rollback();
    console.error("Order placement failed:", error);
    res.status(500).json({ error: "Failed to place order" });
  } finally {
    connection.release();
  }
});

// Get orders for a user
// Add this to your server.js (after session setup)
app.get('/api/orders', async (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = req.session.user.id;

  try {
    const [orders] = await pool.promise().query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC',
      [userId]
    );

    const detailedOrders = await Promise.all(
      orders.map(async (order) => {
        const [items] = await pool.promise().query(
          `SELECT oi.product_id, p.name, oi.quantity, oi.price_at_time 
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?`,
          [order.id]
        );

        return {
          order_id: order.id,
          order_date: order.order_date,
          status: order.status,
          items,
        };
      })
    );

    res.json(detailedOrders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});


// Search products
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing search query" });
  const searchQuery = `%${q.toLowerCase()}%`;
  const sql = `
    SELECT * FROM products 
    WHERE LOWER(name) LIKE ? 
      OR LOWER(category) LIKE ? 
      OR LOWER(description) LIKE ?
  `;
  pool.query(sql, [searchQuery, searchQuery, searchQuery], (error, results) => {
    if (error) return res.status(500).json({ error: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "No products found for your search." });
    res.json(results);
  });
});

app.get('/api/session', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
