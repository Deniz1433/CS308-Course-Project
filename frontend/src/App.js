// src/App.js
import React, { useState, useEffect, useContext, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ProtectedRoute from './middleware/ProtectedRoute';
import { SessionProvider, SessionContext } from './middleware/SessionManager';
import Login from './pages/Login';
import Register from './pages/Register';
import Payment from './pages/Payment';
import ProductPage from './pages/ProductPage';
import Orders from './pages/Orders';
import ProfilePage from './pages/Profile';
import AdminInterface from './pages/AdminInterface'; // adjust path if needed


// MUI & Theming Imports
import { createTheme, ThemeProvider, styled } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Drawer from '@mui/material/Drawer';
import InputBase from '@mui/material/InputBase';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';
import { Add, Remove, ShoppingCart, ArrowDropDown, Delete } from '@mui/icons-material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

// 1. Theme configuration
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#f50057' },
    background: { default: '#f5f5f5' }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h1: { fontSize: '2rem', fontWeight: 500 },
    h2: { fontSize: '1.5rem', fontWeight: 500 },
    body1: { fontSize: '1rem' }
  }
});

// 2. Styled layout containers & UI components
const MainContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
}));

const HeaderBar = styled(AppBar)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const SearchInput = styled(InputBase)(({ theme }) => ({
  backgroundColor: '#fff',
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
  width: 300,
  marginLeft: theme.spacing(2),
  boxShadow: theme.shadows[1],
}));

const SortButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  margin: theme.spacing(0, 1),
}));

const CategoryButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  margin: theme.spacing(0, 1, 1, 0),
}));

const ProductGrid = styled(Grid)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

const ProductCard = styled(Card)(({ theme }) => ({
  width: 345,
  '&:hover': { boxShadow: theme.shadows[6] },
}));

const CartDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: 320,
    padding: theme.spacing(2),
  }
}));

// 3. Contexts
export const CartContext = createContext();

// 4. Header component
function Header({ user, onLogout, onOpenCart, cartCount }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handleMenuOpen = e => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <HeaderBar position="static" color="primary">
      <Toolbar>
        <Typography variant="h2" component="div" sx={{ flexGrow: 1 }}>
          Product Listings
        </Typography>
        <IconButton color="inherit" onClick={onOpenCart} sx={{ ml: 1 }}>
          <ShoppingCart />
          {cartCount > 0 && (
            <Box component="span" sx={{ ml: 0.5, fontSize: '0.9rem' }}>
              {cartCount}
            </Box>
          )}
        </IconButton>
        {user ? (
          <Box sx={{ ml: 2 }}>
            <Button color="inherit" onClick={handleMenuOpen} endIcon={<ArrowDropDown />}> 
              {user.name}
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
			  {(user?.role === 'product_manager' || user?.role === 'sales_manager') && (
			  <MenuItem onClick={() => { handleMenuClose(); window.location.href = '/admin'; }}>
				Admin Interface
			  </MenuItem>
			  )}
              <MenuItem onClick={() => { handleMenuClose(); window.location.href = '/profile'; }}>
                My Profile
              </MenuItem>
              <MenuItem onClick={() => { handleMenuClose(); window.location.href = '/orders'; }}>
                My Orders
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { handleMenuClose(); onLogout(); }}>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        ) : (
          <Button color="inherit" href="/login" sx={{ ml: 2 }}>
            Login
          </Button>
        )}
      </Toolbar>
    </HeaderBar>
  );
}

// 5. ProductCardItem component
function ProductCardItem({ product, onAdd, onView, quantity, onIncrement, onDecrement, onQuantityChange }) {
  return (
    <ProductCard>
      <CardMedia
        component="img"
        image={product.image_path}
        alt={product.name}
        height={140}
        onClick={() => onView(product.id)}
        sx={{ cursor: 'pointer', objectFit: 'contain', backgroundColor: '#fff' }}
      />
      <CardContent>
        <Typography gutterBottom variant="h5">
          {product.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {product.description}
        </Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          Price: ${Number(product.price).toFixed(2)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Stock: {product.stock}
        </Typography>
      </CardContent>
      <CardActions>
        <IconButton size="small" onClick={onDecrement} disabled={quantity <= 1}>
          <Remove />
        </IconButton>
        <InputBase
          type="number"
          value={quantity}
          onChange={e => onQuantityChange(Number(e.target.value))}
          inputProps={{ min: 1, max: product.stock, style: { width: 40, textAlign: 'center' } }}
        />
        <IconButton size="small" onClick={onIncrement} disabled={quantity >= product.stock}>
          <Add />
        </IconButton>
        <Button size="small" variant="contained" onClick={() => onAdd(product, quantity)}>
          Add to Cart
        </Button>
      </CardActions>
    </ProductCard>
  );
}

// 6. CartProvider context
export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    const stored = localStorage.getItem('cart');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };
  const removeFromCart = id => setCart(prev => prev.filter(item => item.id !== id));
  const updateCartQuantity = (id, quantity) => setCart(prev => prev.map(item =>
    item.id === id ? { ...item, quantity } : item
  ));

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateCartQuantity }}>
      {children}
    </CartContext.Provider>
  );
};

// 7. ProductListing page
function ProductListing() {
  const { cart, addToCart, removeFromCart } = useContext(CartContext);
  const { user, logout } = useContext(SessionContext);
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(null);
  const [sortOption, setSortOption] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const [quantityMap, setQuantityMap] = useState({});
  const [cartOpen, setCartOpen] = useState(false);

  const openSortMenu = Boolean(sortAnchorEl);
  const handleSortOpen = e => setSortAnchorEl(e.currentTarget);
  const handleSortClose = () => setSortAnchorEl(null);
  const handleSortSelection = (option, order) => {
    setSortOption(option);
    setSortOrder(order);
    handleSortClose();
  };

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts)
      .catch(console.error);
  }, []);

  const categories = [...new Set(products.map(p => p.category))];

  const handleQuantityChange = (id, val, stock) => {
    const q = Math.max(1, Math.min(Number(val) || 1, stock));
    setQuantityMap(prev => ({ ...prev, [id]: q }));
  };
  const handleIncrement = (id, stock) => {
    setQuantityMap(prev => ({ ...prev, [id]: Math.min((prev[id] || 1) + 1, stock) }));
  };
  const handleDecrement = id => {
    setQuantityMap(prev => ({ ...prev, [id]: Math.max((prev[id] || 1) - 1, 1) }));
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return (!category || p.category === category) &&
      (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortOption) return 0;
    const valA = sortOption === 'price' ? Number(a.price) : a.popularity;
    const valB = sortOption === 'price' ? Number(b.price) : b.popularity;
    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  const handleProceed = () => {
    setCartOpen(false);
    if (!user) navigate('/login', { state: { from: '/payment' } });
    else navigate('/payment');
  };

  return (
    <>
      <Header user={user} onLogout={logout} onOpenCart={() => setCartOpen(true)} cartCount={cart.reduce((acc, i) => acc + i.quantity, 0)} />

      <MainContainer>
		<Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
		  {/* Search Input */}
		  <SearchInput 
			value={search} 
			placeholder="Search..." 
			onChange={e => setSearch(e.target.value)} 
		  />

		  {/* Sort Button with Dropdown */}
		  <Button
			variant="outlined"
			onClick={handleSortOpen}
			endIcon={<ArrowDropDownIcon />}
			sx={{ ml: 2 }} // adds spacing between search and sort
		  >
			Sort by
		  </Button>

		  {/* Sort Menu */}
		  <Menu
			anchorEl={sortAnchorEl}
			open={openSortMenu}
			onClose={handleSortClose}
			anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
			transformOrigin={{ vertical: 'top', horizontal: 'left' }}
		  >
			<MenuItem onClick={() => handleSortSelection('price', 'asc')}>Price Asc.</MenuItem>
			<MenuItem onClick={() => handleSortSelection('price', 'desc')}>Price Desc.</MenuItem>
			<MenuItem onClick={() => handleSortSelection('popularity', 'asc')}>Popularity Asc.</MenuItem>
			<MenuItem onClick={() => handleSortSelection('popularity', 'desc')}>Popularity Desc.</MenuItem>
		  </Menu>
		</Box>
        <Box sx={{ mb: 2 }}>
          <CategoryButton onClick={() => setCategory(null)}>All Products</CategoryButton>
          {categories.map(cat => (<CategoryButton key={cat} onClick={() => setCategory(cat)}>{cat}</CategoryButton>))}
        </Box>
        <ProductGrid container spacing={2}>
          {sorted.map(product => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
              <ProductCardItem
                product={product}
                quantity={quantityMap[product.id] || 1}
                onIncrement={() => handleIncrement(product.id, product.stock)}
                onDecrement={() => handleDecrement(product.id)}
                onQuantityChange={val => handleQuantityChange(product.id, val, product.stock)}
                onAdd={addToCart}
                onView={id => navigate(`/product-page/${id}`)}
              />
            </Grid>
          ))}
        </ProductGrid>
      </MainContainer>

      <CartDrawer anchor="right" open={cartOpen} onClose={() => setCartOpen(false)}>
        <Typography variant="h5" gutterBottom>Your Cart</Typography>
        <Divider />
        <List>
          {cart.map(item => (
            <ListItem key={item.id} secondaryAction={<IconButton edge="end" onClick={() => removeFromCart(item.id)}><Delete /></IconButton>}>
              <ListItemAvatar><Avatar src={item.image_path} /></ListItemAvatar>
              <ListItemText primary={item.name} secondary={`$${Number(item.price).toFixed(2)} × ${item.quantity}`} />
            </ListItem>
          ))}
        </List>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">Total: ${total.toFixed(2)}</Typography>
          <Button fullWidth variant="contained" onClick={handleProceed} sx={{ mt: 1 }}>Proceed to Payment</Button>
        </Box>
      </CartDrawer>
    </>
  );
}

// 8. App root
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SessionProvider>
        <CartProvider>
          <Router>
            <Routes>
              <Route path="/" element={<ProductListing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/product-page/:id" element={<ProductPage />} />
              <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
			  <Route path="/admin" element={<AdminInterface />} />
            </Routes>
          </Router>
        </CartProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

export default App;
