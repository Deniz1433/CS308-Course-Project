<<<<<<< Updated upstream
import React, { useState, useEffect } from 'react';
=======
import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
>>>>>>> Stashed changes
import './App.css';
<<<<<<< Updated upstream
=======
import Login from './pages/Login';
import Register from './pages/Register';
import ProductListing from './components/ProductListing'; // your listing + search bar
import { SessionProvider } from './middleware/SessionManager';

<<<<<<< Updated upstream
function Header({ onSearch }) {
  const { user, logout } = useContext(SessionContext);
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    onSearch(e.target.value); // Trigger search
  };

  return (
    <header className="App-header">
      <div className="header-container">
        <h1>Product Listings</h1>
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="search-input"
        />
        {user ? (
          <div>
            <span>Welcome, {user.name}!</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        ) : (
          <Link to="/login">
            <button className="login-btn">Login</button>
          </Link>
        )}
      </div>
    </header>
  );
}
>>>>>>> Stashed changes

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

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = (query = "") => {
    setLoading(true);
    const url = query
      ? `/api/search-products?query=${encodeURIComponent(query)}`
      : "/api/products";

    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching products:", err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProducts(); // Fetch all products initially
  }, []);

  return (
    <div className="App">
<<<<<<< Updated upstream
      <header className="App-header">
        <h1>Product Listings</h1>
        <div className="product-list">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </header>
=======
      <Header onSearch={fetchProducts} />
      {loading ? <p>Loading...</p> : error ? <p>Error: {error}</p> : (
        <div className="product-list">
          {products.length > 0 ? (
            products.map(product => <ProductCard key={product.id} product={product} />)
          ) : (
            <p>No products found</p>
          )}
        </div>
      )}
>>>>>>> Stashed changes
    </div>
  );
}

<<<<<<< Updated upstream
export default App;
=======

=======
// ----- CART CONTEXT AND PROVIDER -----
export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    const storedCart = localStorage.getItem('cart');
    return storedCart ? JSON.parse(storedCart) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prevCart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image_path: product.image_path,
          quantity,
          stock: product.stock,
        },
      ];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateCartQuantity = (productId, newQuantity) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateCartQuantity }}>
      {children}
    </CartContext.Provider>
  );
};

// ----- APP COMPONENT -----
>>>>>>> Stashed changes
function App() {
  return (
    <SessionProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ProductListing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
}

export default App;
>>>>>>> Stashed changes
