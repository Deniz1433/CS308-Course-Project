import React, { useState, useContext, useEffect } from 'react';
import { CartContext } from '../App'; // Adjust path if needed
import { SessionContext } from '../middleware/SessionManager';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  Paper
} from '@mui/material';

const Payment = () => {
  const { cart } = useContext(CartContext);
  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const { user } = useContext(SessionContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/payment' } });
    }
  }, [user, navigate]);

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
    const [message, setMessage] = useState('');
    const [alertSeverity, setAlertSeverity] = useState('success');

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Simple validation
        if (!/^\d{16}$/.test(cardNumber)) {
            setAlertSeverity('error');
            setMessage('Card number must be 16 digits.');
            return;
        }

        if (!/^\d{2}\/\d{2}$/.test(expiry)) {
            setMessage('Expiry must be in MM/YY format.');
            return;
        }

        // Check if expiry is in the future
        const [mm, yy] = expiry.split('/').map(Number);
        const expiryDate = new Date(`20${yy}`, mm); // first day of next month
        const now = new Date();
        if (expiryDate <= now) {
            setMessage('Card has expired.');
            return;
        }

        if (!/^\d{3,4}$/.test(cvv)) {
            setMessage('CVV must be 3 or 4 digits.');
            return;
        }

        const data = { cardNumber, expiry, cvv, amount: total };

        try {
            const response = await fetch('/api/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            setAlertSeverity('success');
            setMessage(result.message);
        } catch (error) {
            setMessage('Payment failed. Please try again.');
        }
    };

  return (
    <Container maxWidth="sm" sx={{ mt: 6 }}>
      <Paper
        elevation={4}
        sx={{
          p: 4,
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
          borderRadius: 2,
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: '#d17b00' }}>
            Payment
        </Typography>

        <Typography variant="subtitle1" gutterBottom>
          Total Amount: ${total.toFixed(2)}
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Card Number"
            variant="filled"
            fullWidth
            required
            margin="normal"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            InputProps={{ sx: { backgroundColor: '#2c2c2c', color: '#fff' } }}
            InputLabelProps={{ sx: { color: '#aaa' } }}
          />
          <TextField
            label="Expiry Date (MM/YY)"
            variant="filled"
            fullWidth
            required
            margin="normal"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            InputProps={{ sx: { backgroundColor: '#2c2c2c', color: '#fff' } }}
            InputLabelProps={{ sx: { color: '#aaa' } }}
          />
          <TextField
            label="CVV"
            variant="filled"
            fullWidth
            required
            margin="normal"
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
            InputProps={{ sx: { backgroundColor: '#2c2c2c', color: '#fff' } }}
            InputLabelProps={{ sx: { color: '#aaa' } }}
          />
          <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{
                mt: 2,
                backgroundColor: '#ff9800',
                '&:hover': {
                  backgroundColor: '#e68900',
                }
              }}
           >
              Pay
           </Button>
        </Box>

            {message && (
                <Alert severity={alertSeverity} sx={{ mt: 3 }}>
                    {message}
                </Alert>
            )}

      </Paper>
    </Container>
  );
};

export default Payment;


