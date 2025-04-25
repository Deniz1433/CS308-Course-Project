import React, { useContext, createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './middleware/ProtectedRoute';
import { SessionProvider, SessionContext } from './middleware/SessionManager';

import Login from './pages/Login';
import Register from './pages/Register';
import Payment from './pages/Payment';
import ProductPage from './pages/ProductPage';
import Orders from './pages/Orders';
import ProfilePage from './pages/Profile';
import InvoicePage from './pages/InvoicePage';

import {
  Header,
  ProductCardItem,
  CartDrawer,
  MainContainer,
  ProductGrid,
  SearchInput,
  SortButton,
  CategoryButton,
  VisualsProvider,
} from './Visuals';

import {
  Box,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Typography,
  Button,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Grid,
  IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

// ——— Cart context ———
export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    const s = localStorage.getItem('cart');
    return s ? JSON.parse(s) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) {
        return prev.map(i =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = id => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateCartQuantity = (id, quantity) => {
    setCart(prev =>
      prev.map(i => (i.id === id ? { ...i, quantity } : i))
    );
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateCartQuantity }}>
      {children}
    </CartContext.Provider>
  );
};

// ——— Product listing ———
function ProductListing() {
  const { cart, addToCart, removeFromCart, updateCartQuantity } = useContext(CartContext);
  const { user, logout } = useContext(SessionContext);
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(null);
  const [sortOption, setSortOption] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [sortVisible, setSortVisible] = useState(false);
  const [quantityMap, setQuantityMap] = useState({});
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    fetch('/api/products', { credentials: 'include' })
      .then(r => r.json())
      .then(setProducts)
      .catch(console.error);
  }, []);

  const categories = [...new Set(products.map(p => p.category))];

  const handleQuantityChange = (id, val, stock) => {
    const q = Number(val) || 1;
    setQuantityMap(prev => ({
      ...prev,
      [id]: Math.max(1, Math.min(q, stock))
    }));
  };

  const handleIncrement = (id, stock) =>
    setQuantityMap(prev => ({
      ...prev,
      [id]: Math.min((prev[id] || 1) + 1, stock)
    }));

  const handleDecrement = id =>
    setQuantityMap(prev => ({
      ...prev,
      [id]: Math.max((prev[id] || 1) - 1, 1)
    }));

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return (
      (!category || p.category === category) &&
      (p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortOption) return 0;
    const va = sortOption === 'price' ? Number(a.price) : a.popularity;
    const vb = sortOption === 'price' ? Number(b.price) : b.popularity;
    return sortOrder === 'asc' ? va - vb : vb - va;
  });

  const total = cart.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);

  const handleProceed = () => {
    setCartOpen(false);
    if (!user) navigate('/login', { state: { from: '/payment' } });
    else navigate('/payment');
  };

  return (
    <>
      <Header
        user={user}
        onLogout={logout}
        onOpenCart={() => setCartOpen(true)}
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
      />

      <MainContainer>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SearchInput
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <SortButton onClick={() => setSortVisible(v => !v)}>Sort by</SortButton>
          {sortVisible && (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
              <FormControl component="fieldset">
                <RadioGroup
                  row
                  value={sortOption}
                  onChange={e => setSortOption(e.target.value)}
                >
                  <FormControlLabel
                    value="price"
                    control={<Radio />}
                    label="Price"
                  />
                  <FormControlLabel
                    value="popularity"
                    control={<Radio />}
                    label="Popularity"
                  />
                </RadioGroup>
              </FormControl>
              <SortButton onClick={() => setSortOrder('asc')}>Asc</SortButton>
              <SortButton onClick={() => setSortOrder('desc')}>Desc</SortButton>
            </Box>
          )}
        </Box>

        <Box sx={{ mb: 2 }}>
          <CategoryButton onClick={() => setCategory(null)}>
            All Products
          </CategoryButton>
          {categories.map(cat => (
            <CategoryButton key={cat} onClick={() => setCategory(cat)}>
              {cat}
            </CategoryButton>
          ))}
        </Box>

        <ProductGrid container spacing={2}>
          {sorted.map(p => (
            <Grid item key={p.id} xs={12} sm={6} md={4} lg={3}>
              <ProductCardItem
                product={p}
                quantity={quantityMap[p.id] || 1}
                onIncrement={() => handleIncrement(p.id, p.stock)}
                onDecrement={() => handleDecrement(p.id)}
                onQuantityChange={val => handleQuantityChange(p.id, val, p.stock)}
                onAdd={addToCart}
                onView={() => navigate(`/product-page/${p.id}`)}
              />
            </Grid>
          ))}
        </ProductGrid>
      </MainContainer>

      <CartDrawer
        anchor="right"
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      >
        <Typography variant="h5" gutterBottom>
          Your Cart
        </Typography>
        <Divider />
        <List>
          {cart.map(item => (
            <ListItem
              key={item.id}
              secondaryAction={
                <IconButton onClick={() => removeFromCart(item.id)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemAvatar>
                <Avatar src={item.image_path} />
              </ListItemAvatar>
              <ListItemText
                primary={item.name}
                secondary={`$${Number(item.price).toFixed(2)} × ${item.quantity}`}
              />
            </ListItem>
          ))}
        </List>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">Total: ${total.toFixed(2)}</Typography>
          <Button
            variant="contained"
            fullWidth
            onClick={handleProceed}
            sx={{ mt: 1 }}
          >
            Proceed to Payment
          </Button>
        </Box>
      </CartDrawer>
    </>
  );
}

// ——— App wrapper ———
function App() {
  return (
    <VisualsProvider>
      <SessionProvider>
        <CartProvider>
          <Router>
            <Routes>
              <Route path="/" element={<ProductListing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/payment" element={<Payment />} />
              <Route
                path="/product-page/:id"
                element={<ProductPage />}
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <Orders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Invoice route */}
              <Route
                path="/invoice/:orderId"
                element={
                  <ProtectedRoute>
                    <InvoicePage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
        </CartProvider>
      </SessionProvider>
    </VisualsProvider>
  );
}

export default App;
