// src/pages/Payment.js
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../App';
import { SessionContext } from '../middleware/SessionManager';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  Paper,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText
} from '@mui/material';
import { InputBase } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function Payment() {
  const { cart, clearCart, updateCartQuantity, removeFromCart } = useContext(CartContext);
  const { user, loading: sessionLoading } = useContext(SessionContext);
  const navigate = useNavigate();

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState('');
  const handleGoBack = () => navigate('/');

  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login', { replace: true, state: { from: '/payment' } });
    }
  }, [sessionLoading, user, navigate]);
  
  useEffect(() => {
	  if (user?.home_address) {
		setAddress(user.home_address);
	  }
	}, [user]);


  if (sessionLoading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    setExpiry(value);
  };

  const isExpiryValid = () => {
    const [month] = expiry.split('/');
    const m = parseInt(month, 10);
    return m >= 1 && m <= 12;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    if (!address || !cardNumber || !expiry || !cvv) {
      setMessage('Please fill in all payment and address fields.');
      setLoading(false);
      return;
    }

    if (!isExpiryValid()) {
      setMessage('Invalid expiry month.');
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch('/api/payment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber, expiry, cvv, cart, address })
      });
      const data = await resp.json();

      if (!resp.ok) {
        setMessage(data.error || data.message || 'Failed to place order');
        setLoading(false);
        return;
      }

      const { orderId } = data;
      clearCart?.();
      navigate(`/invoice/${orderId}`);
    } catch (err) {
      console.error(err);
      setMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleQuantityChange = (id, val, stock) => {
  const quantity = Math.max(1, Math.min(Number(val) || 1, stock));
	  updateCartQuantity(id, quantity);
	};

	const handleIncrement = (id, stock) => {
	  updateCartQuantity(id, itemQuantity(id) + 1 <= stock ? itemQuantity(id) + 1 : stock);
	};

	const handleDecrement = (id) => {
	  updateCartQuantity(id, Math.max(itemQuantity(id) - 1, 1));
	};

	const itemQuantity = (id) => {
	  const item = cart.find(p => p.id === id);
	  return item ? item.quantity : 1;
	};


  const totalPrice = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

  return (
	
    <Container maxWidth="sm" sx={{ mt: 6 }}>
	  <Box sx={{ mb: 3 }}>
		<Button startIcon={<ArrowBackIcon />} onClick={handleGoBack} variant="outlined">
		  Back to Products
		</Button>
	  </Box>
		
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom color="primary">
          Review Your Cart
        </Typography>

        {cart.length === 0 ? (
          <Typography>No items in cart.</Typography>
        ) : (
          <>
            <List>
			  {cart.map((item, idx) => (
				<ListItem key={idx} alignItems="flex-start" sx={{ alignItems: 'center' }}>
				  <ListItemAvatar>
					<Avatar
					  src={`/${item.image_path}`}
					  alt={item.name}
					  variant="rounded"
					  sx={{ width: 56, height: 56, mr: 2 }}
					/>
				  </ListItemAvatar>
				  <ListItemText
					primary={item.name}
					secondary={
					  <>
						{item.quantity > 1 ? (
						  <>
							<Typography component="span" variant="body2" color="text.primary">
							  {item.quantity} × ${Number(item.price).toFixed(2)}
							</Typography>
							{" = "}
							<Typography component="span" variant="body2" color="text.primary">
							  ${Number(item.price * item.quantity).toFixed(2)}
							</Typography>
						  </>
						) : (
						  <Typography component="span" variant="body2" color="text.primary">
							${Number(item.price).toFixed(2)}
						  </Typography>
						)}
						<Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
						  <IconButton
							size="small"
							onClick={() => handleDecrement(item.id)}
							disabled={item.quantity <= 1}
						  >
							<Remove />
						  </IconButton>

						  <InputBase
							type="number"
							value={item.quantity}
							onChange={e => handleQuantityChange(item.id, e.target.value, item.stock)}
							inputProps={{ min: 1, max: item.stock, style: { width: 40, textAlign: 'center' } }}
							sx={{ border: '1px solid #ccc', borderRadius: 1, px: 1, py: 0.5, width: 50, mx: 1 }}
						  />

						  <IconButton
							size="small"
							onClick={() => handleIncrement(item.id, item.stock)}
							disabled={item.quantity >= item.stock}
						  >
							<Add />
						  </IconButton>

						  <Button
							size="small"
							color="error"
							onClick={() => removeFromCart(item.id)}
							sx={{ ml: 2 }}
						  >
							Remove
						  </Button>
						</Box>
					  </>
					}
				  />
				</ListItem>
			  ))}
			</List>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" align="right" sx={{ mb: 2 }}>
              Total: ${totalPrice.toFixed(2)}
            </Typography>
          </>
        )}
		
	  <Typography variant="h4" gutterBottom sx={{ color: '#1976d2' }}>
		Delivery Address
	  </Typography>

	  <TextField
		  label="Delivery Address"
		  variant="filled"
		  value={address}
		  onChange={e => setAddress(e.target.value)}
		  InputProps={{
			sx: {
			  color: '#000',
			  backgroundColor: '#ffffff',
			  borderRadius: 1,
			  '&:before': { borderBottomColor: '#ccc' },
			  '&:hover:before': { borderBottomColor: '#888' },
			  '&:after': { borderBottomColor: '#1976d2' },
			}
		  }}
		  InputLabelProps={{ sx: { color: '#555' } }}
		  sx={{ mt: 2 }}
		  fullWidth
		  required
		/>


        <Typography variant="h4" gutterBottom color="primary" sx={{ mt: 4 }}>
          Payment Information
        </Typography>

        {message && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          noValidate
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label="Card Number"
            variant="outlined"
            value={cardNumber}
            onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').slice(0,16))}
            inputProps={{ maxLength: 16 }}
          />

          <TextField
            label="Expiry (MM/YY)"
            variant="outlined"
            value={expiry}
            onChange={handleExpiryChange}
            placeholder="04/26"
          />
		  

          <TextField
            label="CVV"
            variant="outlined"
            type="password"
            value={cvv}
            onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0,4))}
            inputProps={{ maxLength: 4 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{
              mt: 2,
              backgroundColor: '#1976d2',
              '&:hover': { backgroundColor: '#115293' }
            }}
            disabled={loading || cart.length === 0}
          >
            {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Pay & Email Invoice'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
