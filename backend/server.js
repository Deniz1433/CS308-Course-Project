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
app.use(cors());
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

// Get products endpoint
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

// Get products by id endpoint
app.get('/api/products/:id', (req, res) => {
  const productId = req.params.id;
  
  // Validate the ID is a number
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
    
    res.json(results[0]); // Return the result
  });
});

// Register Endpoint with Password Hashing
app.post("/api/register", async (req, res) => {
  const { name, email, password, home_address = null } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, Email, and Password are required" });
  }

  try {
    const [existingUser] = await pool
      .promise()
      .query("SELECT id FROM users WHERE email = ?", [email]);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    await pool
      .promise()
      .query(
        "INSERT INTO users (name, email, home_address, password) VALUES (?, ?, ?, ?)",
        [name, email, home_address, hashedPassword]
      );

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Login Endpoint with Password Verification
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const [user] = await pool
      .promise()
      .query("SELECT * FROM users WHERE email = ?", [email]);

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

// Payment Endpoint for Simulated Transactions
app.post('/api/payment', (req, res) => {
  const { cardNumber, expiry, cvv, amount } = req.body;

  // Simulate a payment failure for a specific dummy card number.
  if (cardNumber === '0000000000000000') {
    return res.json({ message: 'Payment declined: Invalid card.' });
  }

  // Otherwise, simulate a successful payment.
  res.json({ message: 'Payment successful!' });
});



// 🔍 Search products by name, category, or description (case-insensitive)
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: "Missing search query" });
  }

  const searchQuery = `%${q.toLowerCase()}%`;

  const sql = `
    SELECT * FROM products 
    WHERE LOWER(name) LIKE ? 
      OR LOWER(category) LIKE ? 
      OR LOWER(description) LIKE ?
  `;

  pool.query(sql, [searchQuery, searchQuery, searchQuery], (error, results) => {
    if (error) {
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "No products found for your search." });
    }

    res.json(results);
  });
});



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
