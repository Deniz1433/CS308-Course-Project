-- Create the ecommerce database and tables

CREATE DATABASE IF NOT EXISTS ecommerce;
USE ecommerce;

-- Create the categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;


-- Create the products table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  model VARCHAR(100),
  serial_number VARCHAR(100) UNIQUE,
  description TEXT,
  category_id INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT DEFAULT 0,
  warranty_status VARCHAR(50) DEFAULT 'No Warranty',
  distributor_info TEXT,
  popularity INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  image_path VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;



-- Create the users table
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)     NOT NULL,
  email         VARCHAR(150)     NOT NULL UNIQUE,
  home_address  VARCHAR(255)     DEFAULT NULL,
  tax_id        BIGINT           NOT NULL DEFAULT 0,
  password      VARCHAR(255)     NOT NULL,
  created_at    TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('customer', 'product_manager', 'sales_manager') UNIQUE NOT NULL
) ENGINE=InnoDB;

-- Associate each user with a role
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Create delivery table for product managers
CREATE TABLE IF NOT EXISTS deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  delivery_address VARCHAR(255) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;


-- Create discounts table for sales managers
CREATE TABLE IF NOT EXISTS discounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  discount_rate DECIMAL(5,2) NOT NULL, -- as percentage e.g. 15.00 for 15%
  new_price DECIMAL(10,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE DEFAULT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;



-- Create the orders table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  order_address VARCHAR(255) DEFAULT NULL,
  status ENUM('processing', 'delivered', 'cancelled', 'refunded', 'in-transit') DEFAULT 'processing',
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Create the order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price_at_time DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- Create the comments table
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Create the ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  rating TINYINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_rating (product_id, user_id)
) ENGINE=InnoDB;

-- Create the wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS refund_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_refund (user_id, order_id, product_id)
) ENGINE=InnoDB;

ALTER TABLE products MODIFY price DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE products ADD final_price DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE products ADD discount_rate DECIMAL(5, 2) DEFAULT 0;

-- Add a column for cost (for profit/loss calculations)
ALTER TABLE products
ADD COLUMN cost DECIMAL(10,2) DEFAULT NULL;

-- Add a column to check if a product is approved by sales manager
ALTER TABLE products
ADD COLUMN price_approved BOOLEAN DEFAULT FALSE;


-- Add comment approval column for product managers
ALTER TABLE comments
ADD COLUMN approved BOOLEAN DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE categories
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Link users and their roles
ALTER TABLE users ADD COLUMN role_id INT DEFAULT NULL, ADD FOREIGN KEY (role_id) REFERENCES roles(id);

INSERT INTO roles (name) VALUES 
('customer'),
('product_manager'),
('sales_manager');

INSERT INTO categories (name) VALUES
  ('Electronics'),
  ('Wearables'),
  ('Home Appliances');


INSERT INTO products (name, model, serial_number, description, category_id, price, stock, warranty_status, distributor_info, image_path, popularity)
VALUES 
  -- Electronics
  ('Laptop Pro', 'LP-2025', 'SN-LP-001', 'A powerful laptop for professionals', 1, 1299.99, 50, '2 Years', 'Distributor Co. - distributor@example.com', 'product_images/laptop_pro.jpg', 6),
  ('Wireless Headphones', 'WH-NoiseX', 'SN-WH-002', 'Noise-cancelling over-ear headphones', 1, 199.99, 100, '1 Year', 'Sound Distributor - sound@example.com', 'product_images/headphones.jpg', 7),
  ('Limited Edition Drone', 'Drone-Lite', 'SN-DR-003', 'Ultra-light drone for hobbyists', 1, 899.99, 1, '6 Months', 'FlyHigh Corp - fly@example.com', 'product_images/drone.jpg', 8),

  -- Wearables
  ('Smartwatch X', 'SW-X2025', 'SN-SW-004', 'Feature-packed smartwatch with health tracking', 2, 299.99, 75, '1 Year', 'WearTech Ltd - wear@example.com', 'product_images/smartwatch_x.jpg', 5),
  ('Smart Glasses', 'SG-VR', 'SN-SG-005', 'Augmented reality smart glasses', 2, 499.99, 0, '1 Year', 'VisionTech - vision@example.com', 'product_images/smart_glasses.jpg', 4),

  -- Home Appliances (NEW Category)
  ('Robot Vacuum Cleaner', 'RVC-1000', 'SN-RVC-006', 'Automatic smart vacuum cleaner', 3, 399.99, 30, '2 Years', 'CleanMaster - clean@example.com', 'product_images/robot_vacuum.jpg', 6),
  ('Air Purifier Max', 'APM-500', 'SN-AP-007', 'HEPA-certified air purifier for clean indoor air', 3, 249.99, 25, '2 Years', 'AirHealth - air@example.com', 'product_images/air_purifier.jpg', 5);




INSERT INTO users (name, email, home_address, password)
VALUES 
('Alice Customer', 'customer@gmail.com', '123 Elm Street', '$2a$10$PxQGXXccLlv7gLT5NmMKRO9LlaJvRWHvghsBTnSZgdxhJq4uRLHZa'),
('Bob Manager', 'productmanager@gmail.com', '456 Oak Avenue', '$2a$10$PxQGXXccLlv7gLT5NmMKRO9LlaJvRWHvghsBTnSZgdxhJq4uRLHZa'),
('Charlie Sales', 'salesmanager@gmail.com', '789 Pine Road', '$2a$10$PxQGXXccLlv7gLT5NmMKRO9LlaJvRWHvghsBTnSZgdxhJq4uRLHZa');

INSERT INTO user_roles (user_id, role_id)
VALUES
(1, 1),  -- Alice is a customer
(2, 2),  -- Bob is a product_manager
(3, 3);  -- Charlie is a sales_manager

ALTER TABLE refund_requests
  ADD COLUMN processed_at DATETIME NULL AFTER status;

UPDATE comments SET approved = TRUE WHERE approved IS NULL;


-- Comments for Laptop Pro (product_id = 1)
INSERT INTO comments (product_id, user_id, comment_text, approved)
VALUES
  (1, 1, 'This laptop is a beast! Handles all my dev tools with ease.', TRUE),
  (1, 2, 'Really good build quality, but a bit heavy.', TRUE);

-- Comments for Wireless Headphones (product_id = 2)
INSERT INTO comments (product_id, user_id, comment_text, approved)
VALUES
  (2, 1, 'Fantastic noise cancellation. Great for flights.', TRUE),
  (2, 3, 'Bass is solid and battery life is more than enough.', TRUE);

-- Comments for Smartwatch X (product_id = 4)
INSERT INTO comments (product_id, user_id, comment_text, approved)
VALUES
  (4, 2, 'Nice health tracking features, very accurate.', TRUE),
  (4, 3, 'Love the sleek design and vibrant screen!', TRUE);

-- Comments for Robot Vacuum Cleaner (product_id = 6)
INSERT INTO comments (product_id, user_id, comment_text, approved)
VALUES
  (6, 1, 'Makes cleaning the house effortless. I love the smart mapping.', TRUE);

-- Comments for Air Purifier Max (product_id = 7)
INSERT INTO comments (product_id, user_id, comment_text, approved)
VALUES
  (7, 2, 'Noticeable improvement in air quality. Highly recommended.', TRUE);

-- Ratings for Laptop Pro (product_id = 1)
INSERT INTO ratings (product_id, user_id, rating)
VALUES
  (1, 1, 5),  -- Alice
  (1, 2, 4);  -- Bob

-- Ratings for Wireless Headphones (product_id = 2)
INSERT INTO ratings (product_id, user_id, rating)
VALUES
  (2, 1, 5),  -- Alice
  (2, 3, 4);  -- Charlie

-- Ratings for Smartwatch X (product_id = 4)
INSERT INTO ratings (product_id, user_id, rating)
VALUES
  (4, 2, 5),  -- Bob
  (4, 3, 5);  -- Charlie

-- Ratings for Robot Vacuum Cleaner (product_id = 6)
INSERT INTO ratings (product_id, user_id, rating)
VALUES
  (6, 1, 5);

-- Ratings for Air Purifier Max (product_id = 7)
INSERT INTO ratings (product_id, user_id, rating)
VALUES
  (7, 2, 4);

UPDATE products
SET cost = CASE
  WHEN name = 'Laptop Pro'           THEN 850.00
  WHEN name = 'Wireless Headphones'  THEN 120.00
  WHEN name = 'Limited Edition Drone' THEN 600.00
  WHEN name = 'Smartwatch X'         THEN 180.00
  WHEN name = 'Smart Glasses'        THEN 300.00
  WHEN name = 'Robot Vacuum Cleaner' THEN 250.00
  WHEN name = 'Air Purifier Max'     THEN 150.00
  ELSE cost


END;

INSERT INTO users (name, email, home_address, password)
VALUES
('Deniz Yavuzgil', 'deniz.yavuzgil@sabanciuniv.edu', 'Dummy Address', '$2a$10$PxQGXXccLlv7gLT5NmMKRO9LlaJvRWHvghsBTnSZgdxhJq4uRLHZa');
SET @deniz_id = LAST_INSERT_ID();
INSERT INTO user_roles (user_id, role_id)
VALUES (@deniz_id, 1);

SELECT id INTO @deniz_id
  FROM users
 WHERE email = 'deniz.yavuzgil@sabanciuniv.edu';
 
 -- 2) Old delivered order (> 1 month ago), 2×Product 1 (“E”)
INSERT INTO orders (user_id, order_address, order_date, status)
VALUES (@deniz_id, '123 Fake St', DATE_SUB(NOW(), INTERVAL 45 DAY), 'delivered');
SET @o1 = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity, price_at_time)
VALUES 
  (@o1, 1, 2, (SELECT COALESCE(final_price, price) FROM products WHERE id=1));

-- 3) Recent delivered (< 1 month ago), 1×Product 4 (“F”)
INSERT INTO orders (user_id, order_address, order_date, status)
VALUES (@deniz_id, '123 Fake St', DATE_SUB(NOW(), INTERVAL 10 DAY), 'delivered');
SET @o2 = LAST_INSERT_ID();
INSERT INTO order_items (order_id, product_id, quantity, price_at_time)
VALUES
  (@o2, 4, 1, (SELECT COALESCE(final_price, price) FROM products WHERE id=4));
-- 4) Processing now, 1×Product 6 (“G”)
INSERT INTO orders (user_id, order_address, order_date, status)
VALUES (@deniz_id, '123 Fake St', NOW(), 'processing');
SET @o3 = LAST_INSERT_ID();

INSERT INTO order_items (order_id, product_id, quantity, price_at_time)
VALUES
  (@o3, 6, 1, (SELECT COALESCE(final_price, price) FROM products WHERE id=6));

-- 5) In-transit now, 1×Product 7 (“H”)
INSERT INTO orders (user_id, order_address, order_date, status)
VALUES (@deniz_id, '123 Fake St', NOW(), 'in-transit');
SET @o4 = LAST_INSERT_ID();

INSERT INTO order_items (order_id, product_id, quantity, price_at_time)
VALUES
  (@o4, 7, 1, (SELECT COALESCE(final_price, price) FROM products WHERE id=7));