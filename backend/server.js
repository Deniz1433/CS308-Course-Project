const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const app = express();
const port = 5000;

const corsOptions = {
  origin: 'http://localhost:3000', // or your production origin
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Serve static files from the product_images folder
app.use('/product_images', express.static('product_images'));


if (!process.env.DB_PASSWORD) {
  throw new Error("Missing DB_PASSWORD environment variable. Please set it in your environment or .env file.");
}

// Create a connection pool using environment variables.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD, // Must be provided
  database: process.env.DB_NAME || 'ecommerce',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Products API
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

// Images API: returns a list of image URLs
app.get('/api/images', (req, res) => {
  const imagesDir = path.join(__dirname, 'product_images');
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      console.error('Error reading images directory:', err);
      return res.status(500).json({ error: 'Unable to scan images folder' });
    }
    const imageUrls = files.map(file => {
      // Build a relative URL that will work with the reverse proxy.
      return `/product_images/${file}`;
    });
    res.json(imageUrls);
  });
});


// 🟢 Search Products by Name or Description
app.get("/api/search-products", (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "Search query is required" });
  }

  const searchQuery = `
    SELECT * FROM products 
    WHERE LOWER(name) LIKE LOWER(?) 
       OR LOWER(description) LIKE LOWER(?)
  `;

  const searchTerm = `%${query}%`; // Wildcard search

  pool.query(searchQuery, [searchTerm, searchTerm], (error, results) => {
    if (error) {
      console.error("Error searching products:", error);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
