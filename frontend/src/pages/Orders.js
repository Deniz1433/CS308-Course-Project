// frontend/src/pages/Orders.js
import React, { useEffect, useState, useContext } from 'react';
import { SessionContext } from '../middleware/SessionManager';
import { useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Container,
  Typography,
  Button,
  Paper,
  Box,
  Divider,
  CircularProgress
} from '@mui/material';

const Orders = () => {
  const { user } = useContext(SessionContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const BackContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));


  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/orders' } });
      return;
    }

    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/orders', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Error fetching: ${response.status}`);
        }

        const data = await response.json();
        setOrders(data);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);  
      }
    };

    fetchOrders();
  }, [user, navigate]);

  if (loading) {
    return (
      <Container sx={{ mt: 6 }}>
        <Typography variant="h5">Loading your orders...</Typography>
        <CircularProgress sx={{ mt: 2 }} />
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 6 }}>
		<BackContainer>
		<Button
		  startIcon={<ArrowBackIcon />}
		  onClick={() => navigate('/')}
		  variant="outlined"
		>
		  Back to Products
		</Button>
	  </BackContainer>
      <Typography variant="h4" gutterBottom>Your Orders</Typography>
      {orders.length === 0 ? (
        <Typography>No orders found.</Typography>
      ) : (
        orders.map((order) => (
          <Paper key={order.order_id} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6">Order #{order.order_id}</Typography>
            <Typography>Status: {order.status}</Typography>
            <Typography>Date: {new Date(order.order_date).toLocaleString()}</Typography>
            <Divider sx={{ my: 2 }} />
            {order.items.map((item, index) => (
              <Box key={index} sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                <Typography>
                  - {item.name} x {item.quantity} @ ${item.price_at_time}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ ml: 1 }}
                  onClick={() => navigate(`/product-page/${item.product_id}`)}
                >
                  Review
                </Button>
              </Box>
            ))}
          </Paper>
        ))
      )}
    </Container>
  );
};

export default Orders;
