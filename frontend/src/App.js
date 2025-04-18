// src/App.js
import ProtectedRoute from './middleware/ProtectedRoute'; 
import Orders from './pages/Orders';
import React, { useState, useEffect, useContext, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Payment from './pages/Payment';
import ProductPage from './pages/ProductPage';
import { SessionProvider, SessionContext } from './middleware/SessionManager';
import {
    Card,
    CardMedia,
    CardContent,
    Typography,
    IconButton,
    Button,
    TextField,
    Box,
    Collapse
} from "@mui/material";
import { Add, Remove } from "@mui/icons-material";
import { ExpandLess, ExpandMore } from '@mui/icons-material';

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
        <div className="user-controls">
        {user ? (
            <>
            <span className="welcome-msg">Welcome, {user.name}!</span>
            <Link to="/orders">
                <button className="orders-btn">Orders</button>
            </Link>
            <button onClick={logout} className="logout-btn">Logout</button>
            </>
        ) : (
            <Link to="/login">
            <button className="login-btn">Login</button>
            </Link>
        )}
        </div>
        <h1>Product Listings</h1>
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
            setQuantity((q) => q + 1);
        }
    };

    const handleDecrement = () => {
        if (quantity > 1) {
            setQuantity((q) => q - 1);
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
        <Card
            onClick={handleCardClick}
            sx={{
                display: "flex",
                flexDirection: "column",
                maxWidth: 350,
                backgroundColor: "#1e1e1e",
                color: "#fff",
                borderRadius: 3,
                overflow: "hidden",
                boxShadow: 6,
            }}
        >
            <CardMedia
                component="img"
                height="200"
                image={product.image_path}
                alt={product.name}
                sx={{ objectFit: "cover" }}
            />
            <CardContent sx={{ px: 3, pb: 2 }}>
                <Typography variant="h6" gutterBottom>
                    {product.name}
                </Typography>
                <Typography variant="body2" color="gray" gutterBottom>
                    {product.description}
                </Typography>
                <Typography variant="body2" color="gray">
                    Category: {product.category}
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                    Price: ${product.price}
                </Typography>
                <Typography variant="body2" color="gray">
                    Stock: {product.stock}
                </Typography>

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        mt: 2,
                        mb: 1,
                        gap: 1,
                    }}
                    className="no-navigate"
                >
                    <IconButton
                        onClick={handleDecrement}
                        disabled={quantity === 1}
                        sx={{ color: "white", border: "1px solid gray" }}
                    >
                        <Remove />
                    </IconButton>
                    <TextField
                        value={quantity}
                        onChange={handleManualChange}
                        onBlur={handleBlur}
                        inputProps={{
                            style: {
                                textAlign: "center",
                                width: "40px",
                                padding: "6px",
                                color: "white",
                            },
                        }}
                        sx={{
                            "& .MuiInputBase-root": {
                                backgroundColor: "#2b2b2b",
                            },
                            "& input": {
                                textAlign: "center",
                            },
                            width: "60px",
                        }}
                    />
                    <IconButton
                        onClick={handleIncrement}
                        disabled={quantity === product.stock}
                        sx={{ color: "white", border: "1px solid gray" }}
                    >
                        <Add />
                    </IconButton>
                </Box>

                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    sx={{
                        mt: 1,
                        bgcolor: "#1976d2",
                        "&:hover": {
                            bgcolor: "#1565c0",
                        },
                    }}
                    onClick={handleAddToCart}
                    className="no-navigate"
                >
                    Add to Cart
                </Button>
            </CardContent>
        </Card>
    );

}

// ----- CART COMPONENT -----

function Cart() {
    const { cart, removeFromCart, updateCartQuantity } = useContext(CartContext);
    const { user } = useContext(SessionContext);
    const navigate = useNavigate();
    const [showCart, setShowCart] = useState(true);

    if (cart.length === 0) return null;

    const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

    return (
        <Box
            sx={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
            }}
        >
            <Button
			  variant="contained"
			  startIcon={showCart ? <ExpandMore /> : <ExpandLess />}
			  onClick={() => setShowCart(prev => !prev)}
			  sx={{ mb: 1 }}
			>
			  {showCart ? 'Hide Cart' : 'Show Cart'}
			</Button>

            <Collapse in={showCart}>
                <Box
					  className="cart tall-rectangular-cart"
					  sx={{
						maxWidth: '21vw',                          // → never wider than 90% of viewport
						width: { xs: '100%', sm: 400, md: 500 },   // → full‑width on mobile, 400px on small screens, 500px on medium+
						overflowY: 'auto',
						overflowX: 'hidden',                       // → hide any horizontal overflow
						p: 2,
						border: '1px solid #ccc',
						borderRadius: 2,
						backgroundColor: '#fff',
						boxShadow: 3,
					  }}
					>

                    <Typography variant="h5" gutterBottom>Your Cart</Typography>
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
                            <Box key={item.id} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                <img
                                    src={item.image_path}
                                    alt={item.name}
                                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }}
                                />
                                <Box>
                                    <Typography>{item.name}</Typography>
                                    <Typography variant="body2">Price: ${item.price}</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                        <Button variant="outlined" size="small" onClick={handleDecrement} disabled={item.quantity === 1}>–</Button>
                                        <input
                                            type="text"
                                            value={item.quantity}
                                            onChange={handleManualChange}
                                            onBlur={handleBlur}
                                            style={{
                                                width: 40,
                                                textAlign: 'center',
                                                margin: '0 8px',
                                                padding: '4px',
                                                border: '1px solid #ccc',
                                                borderRadius: 4
                                            }}
                                        />
                                        <Button variant="outlined" size="small" onClick={handleIncrement} disabled={item.quantity === item.stock}>+</Button>
                                        <Button
                                            onClick={() => removeFromCart(item.id)}
                                            variant="text"
                                            color="error"
                                            sx={{ ml: 2 }}
                                        >
                                            Remove
                                        </Button>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="h6">Total: ${total.toFixed(2)}</Typography>
                    </Box>
                    <Button
                        variant="contained"
                        color="primary"
                        sx={{ mt: 2 }}
                        onClick={() => {
                            if (!user) {
                                navigate('/login', { state: { from: '/payment' } });
                            } else {
                                navigate('/payment');
                            }
                        }}
                    >
                        Proceed to Payment
                    </Button>
                </Box>
            </Collapse>
        </Box>
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
              <Route
                  path="/orders"
                  element={
                    <ProtectedRoute>
                        <Orders />
                    </ProtectedRoute>
                  }
            />
            </Routes>
          </Router>
        </CartProvider>
      </SessionProvider>
    );
  }

export default App;
