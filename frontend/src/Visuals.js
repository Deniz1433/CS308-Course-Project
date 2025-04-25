// src/Visuals.js
import React, { useState } from 'react';
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
import { Add, Remove, ShoppingCart, ArrowDropDown } from '@mui/icons-material';

// 1. Theme configuration
export const theme = createTheme({
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

// 2. Styled layout containers
export const MainContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
}));

export const HeaderBar = styled(AppBar)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

export const SearchInput = styled(InputBase)(({ theme }) => ({
  backgroundColor: '#fff',
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
  width: 300,
  marginLeft: theme.spacing(2),
  boxShadow: theme.shadows[1],
}));

export const SortButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  margin: theme.spacing(0, 1),
}));

export const CategoryButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  margin: theme.spacing(0, 1, 1, 0),
}));

export const ProductGrid = styled(Grid)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

export const ProductCard = styled(Card)(({ theme }) => ({
  width: 345,
  '&:hover': { boxShadow: theme.shadows[6] },
}));

export const CartDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: 320,
    padding: theme.spacing(2),
  }
}));

// 3. High-level wrapper component to apply theme
export function VisualsProvider({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

// 4. Reusable UI pieces
export function Header({ user, onLogout, onOpenCart, cartCount }) {
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
        <SearchInput placeholder="Search..." />
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
            <Button
              color="inherit"
              onClick={handleMenuOpen}
              endIcon={<ArrowDropDown />}
            >
              {user.name}
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
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
          <Button color="inherit" component="a" href="/login" sx={{ ml: 2 }}>
            Login
          </Button>
        )}
      </Toolbar>
    </HeaderBar>
  );
}

export function ProductCardItem({
  product,
  onAdd,
  onView,
  quantity,
  onIncrement,
  onDecrement,
  onQuantityChange,
  commentCount = 0,
  averageRating = 0,
  totalRatings = 0
}) {
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {averageRating > 0
            ? `★ ${averageRating} (${totalRatings} ratings)`
            : 'No ratings yet'}
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
