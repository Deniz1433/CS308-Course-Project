const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");

require("dotenv").config();
const app = express();
const port = 5000;

app.use('/product_images', express.static('product_images'));
app.use(cors());
app.use(express.json()); // Enable JSON parsing

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

// 🟢 Register Endpoint with Password Hashing
app.post("/api/register", async (req, res) => {

  const { name, email, password, home_address = null } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, Email, and Password are required" });
  }


  try {
    // Check if the user already exists
    const [existingUser] = await pool
      .promise()
      .query("SELECT id FROM users WHERE email = ?", [email]);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
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

// 🟢 Login Endpoint with Password Verification
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Get user from DB
    const [user] = await pool
      .promise()
      .query("SELECT * FROM users WHERE email = ?", [email]);

    if (user.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(password, user[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.status(200).json({ message: "Login successful", user: { id: user[0].id, name: user[0].name, email: user[0].email } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
