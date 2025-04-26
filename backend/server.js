const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const backendSession = require('./sessionmanager');
require("dotenv").config();

const app = express();
const port = 5000;

app.use('/product_images', express.static('product_images'));
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
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

// Get all products
app.get('/api/products', (req, res) => {
  const query = 'SELECT * FROM products';
  pool.query(query, (error, results) => {
    if (error) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const productId = req.params.id;
  if (isNaN(productId)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }
  const query = 'SELECT * FROM products WHERE id = ?';
  pool.query(query, [productId], (error, results) => {
    if (error) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(results[0]);
  });
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
    if (results.length === 0) return res.status(404).json({ message: "No products found" });
    res.json(results);
  });
});

// ----- AUTH ROUTES -----

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
    const [result] = await pool.promise().query(
      "INSERT INTO users (name, email, home_address, password) VALUES (?, ?, ?, ?)",
      [name, email, home_address, hashedPassword]
    );

    const userId = result.insertId;
    const [[{ id: customerRoleId }]] = await pool.promise().query(
      "SELECT id FROM roles WHERE name = 'customer'"
    );
    await pool.promise().query(
      "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
      [userId, customerRoleId]
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
  if (!email || !password) return res.status(400).json({ error: "All fields are required" });

  try {
    const [users] = await pool.promise().query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(401).json({ error: "Invalid email or password" });

    const user = users[0];
    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) return res.status(401).json({ error: "Invalid email or password" });

    const [roleRows] = await pool.promise().query(
      `SELECT r.name FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [user.id]
    );
    const roles = roleRows.map(r => r.name);

    req.session.user = { id: user.id, name: user.name, email: user.email, roles };

    res.status(200).json({ message: "Login successful", user: req.session.user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Check session
app.get('/api/session', async (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [rows] = await pool.promise().query(
      `SELECT u.id, u.name, u.email, r.name AS role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.session.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Session fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch user session.' });
  }
});


// ----- ORDER ROUTES -----

// Place order
app.post('/api/payment', async (req, res) => {
  const { cardNumber, expiry, cvv, cart, userId } = req.body;
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: "Cart is empty or invalid." });
  }
  if (!userId) {
    return res.status(400).json({ error: "User ID is required." });
  }

  try {
    if (cardNumber === '0000000000000000') {
      return res.status(400).json({ message: 'Payment declined: Invalid card.' });
    }

    const connection = await pool.promise().getConnection();
    try {
      await connection.beginTransaction();

      const [orderResult] = await connection.query(
        "INSERT INTO orders (user_id) VALUES (?)",
        [userId]
      );
      const orderId = orderResult.insertId;

      for (const item of cart) {
        const [productRows] = await connection.query(
          "SELECT stock, price FROM products WHERE id = ?",
          [item.productId]
        );
        const product = productRows[0];
        if (!product) throw new Error(`Product ID ${item.productId} not found.`);
        if (product.stock < item.quantity) throw new Error(`Not enough stock for product ID ${item.productId}.`);

        const newStock = product.stock - item.quantity;

        await connection.query(
          "UPDATE products SET stock = ? WHERE id = ?",
          [newStock, item.productId]
        );

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

// Get user's orders
app.get('/api/orders', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });

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

// ----- COMMENT AND RATING ROUTES -----

// New: Get approved comments
app.get('/api/comments/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const [rows] = await pool.promise().query(
      `SELECT 
	  c.id AS comment_id,
	  c.user_id,
	  c.comment_text,
	  c.created_at,
	  u.name,
	  r.rating
	FROM comments c
	JOIN users u ON c.user_id = u.id
	LEFT JOIN ratings r ON r.user_id = c.user_id AND r.product_id = c.product_id
	WHERE c.product_id = ?
	  AND c.approved = TRUE
	ORDER BY c.created_at DESC`,
      [productId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Get the logged-in user's unapproved comment for a specific product
app.get('/api/pending-comment/:productId', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { productId } = req.params;
  const userId = req.session.user.id;

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
	  AND c.user_id = ?
	  AND c.approved = FALSE
	ORDER BY c.created_at DESC
	LIMIT 1`,
      [productId, userId]
    );

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json(null);
    }
  } catch (err) {
    console.error('Error fetching pending comment:', err);
    res.status(500).json({ error: 'Failed to fetch pending comment' });
  }
});

// Delete a comment (approved or unapproved) by its ID, and delete the associated rating
app.delete('/api/delete-comment/:commentId', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { commentId } = req.params;
  const userId = req.session.user.id;

  try {
    // First find the comment to get product_id
    const [commentRows] = await pool.promise().query(
      `SELECT product_id FROM comments WHERE id = ? AND user_id = ?`,
      [commentId, userId]
    );

    if (commentRows.length === 0) {
      return res.status(404).json({ error: 'Comment not found or not authorized.' });
    }

    const productId = commentRows[0].product_id;

    // Delete the comment
    await pool.promise().query(
      `DELETE FROM comments WHERE id = ? AND user_id = ?`,
      [commentId, userId]
    );

    // Delete the rating for that product and user
    await pool.promise().query(
      `DELETE FROM ratings WHERE product_id = ? AND user_id = ?`,
      [productId, userId]
    );

    res.json({ message: 'Comment and rating deleted successfully.' });
  } catch (err) {
    console.error('Error deleting comment and rating:', err);
    res.status(500).json({ error: 'Failed to delete comment and rating.' });
  }
});




// New: Get average rating
app.get('/api/ratings/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const [rows] = await pool.promise().query(
      `SELECT AVG(rating) AS average_rating, COUNT(*) AS total_ratings
       FROM ratings
       WHERE product_id = ?`,
      [productId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching rating:', err);
    res.status(500).json({ error: 'Failed to fetch rating' });
  }
});

// Can user review a product?
app.get('/api/can-review/:productId', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const userId = req.session.user.id;
  const { productId } = req.params;

  try {
    const [rows] = await pool.promise().query(
      `SELECT 1
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.product_id = ?`,
      [userId, productId]
    );

    res.json({ canReview: rows.length > 0 });
  } catch (err) {
    console.error('Error checking review eligibility:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Post rating
app.post('/api/ratings', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { productId, rating } = req.body;
  const userId = req.session.user.id;

  if (!productId || !rating) return res.status(400).json({ error: 'Product ID and rating required.' });

  try {
    // Check if user already rated
    const [existing] = await pool.promise().query(
      `SELECT * FROM ratings WHERE user_id = ? AND product_id = ?`,
      [userId, productId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'You have already rated this product.' });
    }

    // Insert rating
    await pool.promise().query(
      `INSERT INTO ratings (user_id, product_id, rating) VALUES (?, ?, ?)`,
      [userId, productId, rating]
    );

    res.json({ message: 'Rating added successfully.' });
  } catch (err) {
    console.error('Rating error:', err);
    res.status(500).json({ error: 'Failed to submit rating.' });
  }
});


// Post comment
app.post('/api/comments', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { productId, comment_text } = req.body;
  const userId = req.session.user.id;

  if (!productId || !comment_text) return res.status(400).json({ error: 'Product ID and comment required.' });

  try {
    const [ratingRows] = await pool.promise().query(
      `SELECT * FROM ratings WHERE user_id = ? AND product_id = ?`,
      [userId, productId]
    );

    if (ratingRows.length === 0) {
      return res.status(403).json({ error: 'You must rate before commenting.' });
    }
	
	const [pending] = await pool.promise().query(
	  `SELECT * FROM comments WHERE user_id = ? AND product_id = ? AND approved = FALSE`,
	  [userId, productId]
	);

	if (pending.length > 0) {
	  return res.status(400).json({ error: 'You already have a pending comment for this product.' });
	}


    await pool.promise().query(
      `INSERT INTO comments (user_id, product_id, comment_text, approved, created_at)
       VALUES (?, ?, ?, FALSE, NOW())`,
      [userId, productId, comment_text]
    );

    res.json({ message: 'Comment submitted for review and will appear once approved.' });
  } catch (err) {
    console.error('Comment error:', err);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});


// Profile routes
app.get('/api/user/profile', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const userId = req.session.user.id;
  try {
    const [rows] = await pool.promise().query(
      `SELECT id, name, email, home_address FROM users WHERE id = ?`,
      [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
app.put('/api/user/profile', async (req, res) => {
  if (!req.session.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const userId = req.session.user.id;
  const { name, home_address, password } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const fields = [];
    const params = [];

    fields.push('name = ?');
    params.push(name);

    fields.push('home_address = ?');
    params.push(home_address || null);

    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      fields.push('password = ?');
      params.push(hashed);
    }

    params.push(userId);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await pool.promise().query(sql, params);

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
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


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
