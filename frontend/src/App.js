import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';

function ProductCard({ product }) {
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
    if (value === "") {
      setQuantity("");
      return;
    }
    if (!isNaN(value) && value >= 1 && value <= product.stock) {
      setQuantity(Number(value));
    }
  };

  const handleBlur = (e) => {
    if (e.target.value === "") {
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

function ProductListing() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      {/* Header Container for Proper Alignment */}
      <header className="App-header">
        <div className="header-container">
          <h1>Product Listings</h1>
          <Link to="/login">
            <button className="login-btn">Login</button>
          </Link>
        </div>
      </header>

      {/* Product List */}
      <div className="product-list">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProductListing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}

export default App;
