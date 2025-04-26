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
  CircularProgress
} from '@mui/material';

export default function Payment() {
  const { cart, clearCart } = useContext(CartContext);
  const { user, loading: sessionLoading } = useContext(SessionContext);
  const navigate = useNavigate();

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!sessionLoading && !user) {
      navigate('/login', { replace: true, state: { from: '/payment' } });
    }
  }, [sessionLoading, user, navigate]);

  // show a spinner while we're checking login
  if (sessionLoading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    if (!cardNumber || !expiry || !cvv) {
      setMessage('Please fill in all payment fields.');
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch('/api/payment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber, expiry, cvv, cart })
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

  return (
    <Container maxWidth="sm" sx={{ mt: 6 }}>
      <Paper
        elevation={4}
        sx={{
          p: 4,
          backgroundColor: '#1e1e1e',
          color: '#fff',
          borderRadius: 2
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ color: '#d17b00' }}>
          Payment
        </Typography>

        {message && (
          <Alert severity="error" sx={{ mb: 2, backgroundColor: '#2e1f1f' }}>
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
            variant="filled"
            value={cardNumber}
            onChange={e => setCardNumber(e.target.value)}
            InputProps={{ sx: { color: '#fff' } }}
            InputLabelProps={{ sx: { color: '#aaa' } }}
            sx={{ backgroundColor: '#2a2a2a', borderRadius: 1 }}
            inputProps={{ maxLength: 16 }}
          />

          <TextField
            label="Expiry (MM/YY)"
            variant="filled"
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
            InputProps={{ sx: { color: '#fff' } }}
            InputLabelProps={{ sx: { color: '#aaa' } }}
            sx={{ backgroundColor: '#2a2a2a', borderRadius: 1 }}
            placeholder="04/26"
          />

          <TextField
            label="CVV"
            variant="filled"
            type="password"
            value={cvv}
            onChange={e => setCvv(e.target.value)}
            InputProps={{ sx: { color: '#fff' } }}
            InputLabelProps={{ sx: { color: '#aaa' } }}
            sx={{ backgroundColor: '#2a2a2a', borderRadius: 1 }}
            inputProps={{ maxLength: 4 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{
              mt: 2,
              backgroundColor: '#d17b00',
              '&:hover': { backgroundColor: '#bf6900' }
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
