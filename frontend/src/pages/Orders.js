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
  CircularProgress,
  Stack
} from '@mui/material';

const Orders = () => {
  const { user } = useContext(SessionContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refundedItems, setRefundedItems] = useState(new Set());


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

  const cancelOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;

    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Cancel failed: ${response.status}`);
      }

      // Update order status locally
      setOrders((prev) =>
        prev.map(order =>
          order.order_id === orderId ? { ...order, status: 'cancelled' } : order
        )
      );
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel the order.');
    }
  };

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
        orders.map((order) => {
          const orderDate = new Date(order.order_date);
          const now = new Date();
          const daysSinceOrder = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));

          return (
            <Paper key={order.order_id} sx={{ p: 3, mb: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Order #{order.order_id}</Typography>
                {order.status === 'processing' && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => cancelOrder(order.order_id)}
                  >
                    Cancel
                  </Button>
                )}
              </Stack>

              <Typography>Status: {order.status}</Typography>
              <Typography>Date: {orderDate.toLocaleString()}</Typography>
              <Divider sx={{ my: 2 }} />

              {order.items.map((item, index) => (
                <Box key={index} sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                  <Typography>
                    - {item.name} x {item.quantity} @ ${item.price_at_time}
                  </Typography>

                  {order.status === 'delivered' && daysSinceOrder <= 30 && (
                    item.refund_status === 'pending' || item.refund_status === 'approved' ? (
                      <Typography sx={{ ml: 2 }} color="green">
                        Refund confirmed
                      </Typography>
                    ) : (
                      <>
                        <Button
                          variant="outlined"
                          size="small"
                          sx={{ ml: 1 }}
                          onClick={() => navigate(`/product-page/${item.product_id}`)}
                        >
                          Review
                        </Button>
                        <Button
                          variant="outlined"
                          color="warning"
                          size="small"
                          sx={{ ml: 1 }}
                          onClick={async () => {
                            if (!window.confirm("Are you sure you want to request a refund?")) return;
                            try {
                              const res = await fetch('/api/refund-request', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  orderId: order.order_id,
                                  productId: item.product_id
                                })
                              });
                              const data = await res.json();
                              alert(data.message || "Refund request submitted");
                              item.refund_status = 'pending'; // Update locally
                            } catch (err) {
                              console.error(err);
                              alert("Failed to request refund");
                            }
                          }}
                        >
                          Request Refund
                        </Button>
                      </>
                    )
                  )}
                </Box>
              ))}
            </Paper>
          );
        })
      )}
    </Container>
  );
};

export default Orders;
