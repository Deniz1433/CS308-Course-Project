// src/App.js
import React, { useState, useEffect, useContext, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Payment from './pages/Payment';
import ProductPage from './pages/ProductPage';
import { SessionProvider, SessionContext } from './middleware/SessionManager';

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

// ----- HEADER COMPONENT -----
function Header() {
  const { user, logout } = useContext(SessionContext);

  return (
    <header className="App-header">
      <div className="header-container">
        <h1>Product Listings</h1>
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

// ----- PRODUCT CARD COMPONENT -----
function ProductCard({ product }) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useContext(CartContext);
  const navigate = useNavigate();

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

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  const handleCardClick = (e) => {
    // Only navigate if the click wasn't on an interactive element
    if (!e.target.closest('.no-navigate')) {
      navigate(`/product-page/${product.id}`);
    }
  };


  return (
    <div className="product-card" onClick={handleCardClick}>
      <div className="product-image-container">
        <img
          src={product.image_path}
          alt={product.name}
          className="product-image scale-image"
        />
      </div>
      <div className="product-info">
        <h2 className="product-name">{product.name}</h2>
        <p className="product-description">{product.description}</p>
        <p className="product-category">Category: {product.category}</p>
        <p className="product-price">Price: ${product.price}</p>
        <p className="product-stock">Stock: {product.stock}</p>
        <div className="quantity-selector no-navigate">
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
        <button onClick={handleAddToCart} className="add-to-cart-btn no-navigate">Add to Cart</button>
      </div>
    </div>
  );
}

// ----- CART COMPONENT -----
function Cart() {
  const { cart, removeFromCart, updateCartQuantity } = useContext(CartContext);
  const { user } = useContext(SessionContext);
  const navigate = useNavigate();

  if (cart.length === 0) return null;

  // Compute total price from cart items
  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <div className="cart-container">
      <div className="cart tall-rectangular-cart">
        <h2>Your Cart</h2>
        {cart.map(item => {
          const handleIncrement = () => {
            if (item.quantity < item.stock) {
              updateCartQuantity(item.id, item.quantity + 1);
            }
          };

          const handleDecrement = () => {
            if (item.quantity > 1) {
              updateCartQuantity(item.id, item.quantity - 1);
            }
          };

          const handleManualChange = (e) => {
            const value = e.target.value;
            if (value === "") {
              updateCartQuantity(item.id, "");
              return;
            }
            if (!isNaN(value) && value >= 1 && value <= item.stock) {
              updateCartQuantity(item.id, Number(value));
            }
          };

          const handleBlur = (e) => {
            if (e.target.value === "") {
              updateCartQuantity(item.id, 1);
            }
          };

          return (
            <div key={item.id} className="cart-item">
              <img
                src={item.image_path}
                alt={item.name}
                className="cart-item-image scale-image"
              />
              <div className="cart-item-details">
                <p>{item.name}</p>
                <p>Price: ${item.price}</p>
                <div className="quantity-selector">
                  <button
                    onClick={handleDecrement}
                    className={`quantity-btn ${item.quantity === 1 ? 'disabled' : ''}`}
                    disabled={item.quantity === 1}
                  >
                    –
                  </button>
                  <input
                    type="text"
                    value={item.quantity}
                    onChange={handleManualChange}
                    onBlur={handleBlur}
                    className="quantity-input"
                  />
                  <button
                    onClick={handleIncrement}
                    className={`quantity-btn ${item.quantity === item.stock ? 'disabled' : ''}`}
                    disabled={item.quantity === item.stock}
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {/* Display the total amount */}
        <div className="cart-total">
          <p>Total: ${total.toFixed(2)}</p>
        </div>
        <button
          className="proceed-btn"
          onClick={() => {
            // If not logged in, redirect to login with a redirect state
            if (!user) {
              navigate('/login', { state: { from: '/payment' } });
            } else {
              navigate('/payment');
            }
          }}
        >
          Proceed to Payment
        </button>
      </div>
    </div>
  );
}

// ----- PRODUCT LISTING COMPONENT -----
function ProductListing() {
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sortOption, setSortOption] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // New state for search query

  useEffect(() => {
      fetch('/api/products')
          .then(response => response.json())
          .then(data => setProducts(data))
          .catch(error => console.error('Error fetching data:', error));
  }, []);

  const categories = [...new Set(products.map(p => p.category))];

  // Filter products by category and search query
  const filteredProducts = products.filter(product => {
      const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
      const matchesSearchQuery = product.name.toLowerCase().includes(searchQuery.toLowerCase())
          || product.category.toLowerCase().includes(searchQuery.toLowerCase())
          || product.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearchQuery;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
      if (!sortOption) return 0;
      const valueA = sortOption === 'price' ? a.price : a.popularity;
      const valueB = sortOption === 'price' ? b.price : b.popularity;
      return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
  });

  return (
      <div className="App">
          <Header />

          {/* SEARCH BAR */}
          <div className="search-bar-container">
              <input
                  type="text"
                  placeholder="Search by name, category, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-bar"
              />
          </div>

          {/* SORT BUTTON */}
          <div className="sort-container">
              <button onClick={() => setSortMenuVisible(!sortMenuVisible)} className="sort-button">
                  Sort
              </button>
              {sortMenuVisible && (
                  <div className="sort-menu">
                      <label>
                          <input
                              type="radio"
                              name="sortOption"
                              value="price"
                              onChange={() => setSortOption('price')}
                          />
                          Price
                      </label>
                      <label>
                          <input
                              type="radio"
                              name="sortOption"
                              value="popularity"
                              onChange={() => setSortOption('popularity')}
                          />
                          Popularity
                      </label>
                      <button onClick={() => setSortOrder('asc')} className="sort-order-btn">Ascending</button>
                      <button onClick={() => setSortOrder('desc')} className="sort-order-btn">Descending</button>
                  </div>
              )}
          </div>

          {/* CATEGORY SELECTOR */}
          <div className="category-selector">
              <button onClick={() => setSelectedCategory(null)} className={!selectedCategory ? 'active' : ''}>
                  All Products
              </button>
              {categories.map(category => (
                  <button key={category} onClick={() => setSelectedCategory(category)} className={selectedCategory === category ? 'active' : ''}>
                      {category}
                  </button>
              ))}
          </div>

          {/* PRODUCT LIST */}
          <div className="product-list">
              {sortedProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
              ))}
          </div>
          {/* Render the cart in the bottom right */}
          <Cart />
      </div>
  );
}


// ----- APP COMPONENT -----
function App() {
  return (
    <SessionProvider>
      <CartProvider>
        <Router>
          <Routes>
            <Route path="/" element={<ProductListing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/product-page/:id" element={<ProductPage />} />
          </Routes>
        </Router>
      </CartProvider>
    </SessionProvider>
  );
}

export default App;
