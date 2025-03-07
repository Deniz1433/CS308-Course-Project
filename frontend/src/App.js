import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import Register from './components/Register';

// ProductCard Component
ProductCard({ product }) {
  const [quantity, setQuantity] = useState(1);

  const handleIncrement = () => {
    if (quantity < product.stock) {
      setQuantity(q => q + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  const handleManualChange = (e) => {
    const value = e.target.value;
    // Allow empty input (for deletion)
    if (value === "") {
      setQuantity("");
      return;
    }
    // Ensure the value is a number and within the valid range
    if (!isNaN(value) && value >= 1 && value <= product.stock) {
      setQuantity(Number(value));
    }
  };

  const handleBlur = (e) => {
    const value = e.target.value;
    // Reset to 1 if the input is empty
    if (value === "") {
      setQuantity(1);
    }
  };

  return (
    <div className="product-card">
      <div className="product-image-container">
        <img
          src={product.image_path}
          alt={product.name}
          className="product-image"
        />
      </div>
      <div className="product-info">
        <h2 className="product-name">{product.name}</h2>
        <p className="product-description">{product.description}</p>
        <p className="product-category">Category: {product.category}</p>
        <p className="product-price">Price: ${product.price}</p>
        <p className="product-stock">Stock: {product.stock}</p>
        <div className="quantity-selector">
          <button
            onClick={handleDecrement}
            className={`quantity-btn ${quantity === 1 ? 'disabled' : ''}`}
            disabled={quantity === 1}
          >
            –
          </button>
          <span className="quantity-value">{quantity}</span>
          <button onClick={handleIncrement} className="quantity-btn">
          <input
            type="text"
            value={quantity}
            onChange={handleManualChange}
            onBlur={handleBlur}
            className="quantity-input"
          />
          <button
            onClick={handleIncrement}
            className={`quantity-btn ${quantity === product.stock ? 'disabled' : ''}`}
            disabled={quantity === product.stock}
          >
            +
          </button>
        </div>
        <button className="add-to-cart-btn">Add to Cart</button>
      </div>
    </div>
  );
}

// Products Component that fetches and displays products
function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch products and images on mount
  useEffect(() => {
    fetch('/api/products')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Products API error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="App"><p>Loading...</p></div>;
  }

  if (error) {
    return <div className="App"><p>Error: {error}</p></div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Product Listings</h1>
        <div className="product-list">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </header>
    </div>
  );
}

// Main App Component that handles routing and authentication
function App() {
  // Global authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <Router>
      <Routes>
        {/* Login route: If authenticated, redirect to products */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/products" replace />
            ) : (
              <Login onLogin={() => setIsAuthenticated(true)} />
            )
          }
        />
        {/* Register route */}
        <Route path="/register" element={<Register />} />
        {/* Protected Products route: If not authenticated, redirect to login */}
        <Route
          path="/products"
          element={
            isAuthenticated ? (
              <Products />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        {/* Default route redirects to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;


