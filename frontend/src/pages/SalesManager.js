import React, { useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Button, Accordion,
    AccordionSummary, AccordionDetails, CircularProgress, Paper
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate } from 'react-router-dom';

const SalesManager = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedProduct, setExpandedProduct] = useState(null);
    const [priceUpdates, setPriceUpdates] = useState({});
    const [discountRates, setDiscountRates] = useState({});
    const [updating, setUpdating] = useState({});
    const navigate = useNavigate();
    const [refunds, setRefunds] = useState([]);
    const [loadingRefunds, setLoadingRefunds] = useState(true);


    useEffect(() => {
        fetchUnpricedProducts();
        fetchRefundRequests();
    }, []);
    
    const fetchRefundRequests = async () => {
        try {
          const res = await fetch('/api/refund-requests');
          const data = await res.json();
          setRefunds(data);
        } catch (err) {
          console.error("Failed to load refunds", err);
        } finally {
          setLoadingRefunds(false);
        }
      };


      const approveRefund = async (id) => {
        if (!window.confirm("Approve this refund request?")) return;
        try {
          const res = await fetch(`/api/refund-requests/${id}/approve`, {
            method: 'PUT'
          });
          const data = await res.json();
          alert(data.message);
          setRefunds(prev => prev.filter(r => r.id !== id)); // remove from list
        } catch (err) {
          console.error("Approval failed", err);
          alert("Approval failed");
        }
      };
      

    const fetchUnpricedProducts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/products');
            const data = await response.json();
            setProducts(data);
        } catch (error) {
            console.error('Failed to fetch unpriced products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccordionChange = (productId) => (event, isExpanded) => {
        setExpandedProduct(isExpanded ? productId : null);
    };

    const handlePriceChange = (productId, newPrice) => {
        setPriceUpdates(prev => ({ ...prev, [productId]: newPrice }));
    };

    const handleDiscountChange = (productId, rate) => {
        setDiscountRates(prev => ({ ...prev, [productId]: rate }));
    };

    const handleSetPrice = async (productId) => {
        const price = parseFloat(priceUpdates[productId]);
        if (isNaN(price) || price <= 0) {
            alert('Please enter a valid price');
            return;
        }

        setUpdating(prev => ({ ...prev, [productId]: true }));

        try {
            const response = await fetch(`/api/set-price/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ price }),
            });

            if (response.ok) {
                setProducts(prev => prev.map(p =>
                    p.id === productId ? { ...p, price, final_price: price } : p
                ));
                alert('Price set successfully');
            } else {
                const result = await response.json();
                alert(result.error || 'Failed to set price');
            }
        } catch (err) {
            console.error('Error setting price:', err);
            alert('An error occurred while setting the price');
        } finally {
            setUpdating(prev => ({ ...prev, [productId]: false }));
        }
    };

    const handleApplyDiscount = async (productId) => {
        const rate = parseFloat(discountRates[productId]);
        if (isNaN(rate) || rate < 0 || rate > 100) {
            alert('Please enter a valid discount rate (0�100)');
            return;
        }

        setUpdating(prev => ({ ...prev, [productId]: true }));

        try {
            const response = await fetch(`/api/apply-discount/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discountRate: rate }),
            });

            if (response.ok) {
                const product = products.find(p => p.id === productId);
                const basePrice = parseFloat(
                    product?.price
                );

                if (isNaN(basePrice) || basePrice <= 0) {
                    alert("Invalid base price for discount calculation");
                    return;
                }

                const final_price = (basePrice * (1 - rate / 100)).toFixed(2);

                setProducts(prev =>
                    prev.map(p =>
                        p.id === productId
                            ? { ...p, price: basePrice, final_price: final_price }
                            : p
                    )
                );

                alert('Discount applied successfully');
            } else {
                const result = await response.json();
                alert(result.error || 'Failed to apply discount');
            }
        } catch (err) {
            console.error('Error applying discount:', err);
            alert('An error occurred while applying the discount');
        } finally {
            setUpdating(prev => ({ ...prev, [productId]: false }));
        }
    };

    const handleCancelDiscount = async (productId) => {
        setUpdating(prev => ({ ...prev, [productId]: true }));

        try {
            const response = await fetch(`/api/cancel-discount/${productId}`, {
                method: 'PUT',
            });

            if (response.ok) {
                const data = await response.json();
                setProducts(prev =>
                    prev.map(p =>
                        p.id === productId
                            ? { ...p, price: data.restoredPrice, final_price: data.restoredPrice }
                            : p
                    )
                );
                alert('Discount canceled successfully');
            } else {
                const result = await response.json();
                alert(result.error || 'Failed to cancel discount');
            }
        } catch (err) {
            console.error('Error canceling discount:', err);
            alert('An error occurred while canceling the discount');
        } finally {
            setUpdating(prev => ({ ...prev, [productId]: false }));
        }
    };


    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box p={3}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/unpriced-products')}
            style={{ marginBottom: '10px' }}
          >
            View Unpriced Products
          </Button>
    
          <Typography variant="h4" gutterBottom>
            Products
          </Typography>
    
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
              <CircularProgress />
            </Box>
          ) : products.length === 0 ? (
            <Typography>No products available</Typography>
          ) : (
            products.map(product => (
              <Accordion
                key={product.id}
                expanded={expandedProduct === product.id}
                onChange={handleAccordionChange(product.id)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>{product.name}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography>Description: {product.description}</Typography>
                  {product.price && (
                    <Typography sx={{ mt: 1 }}>
                      Original Price: <strong>${product.price}</strong>
                    </Typography>
                  )}
                  {product.final_price && (
                    <Typography sx={{ mt: 1 }}>
                      Final Price: <strong>${product.final_price}</strong>
                    </Typography>
                  )}
    
                  <Box mt={2}>
                    <TextField
                      label="Set Price"
                      type="number"
                      fullWidth
                      value={priceUpdates[product.id] || ''}
                      onChange={(e) => handlePriceChange(product.id, e.target.value)}
                    />
                  </Box>
    
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={updating[product.id]}
                      onClick={() => handleSetPrice(product.id)}
                    >
                      {updating[product.id] ? 'Updating...' : 'Set Price'}
                    </Button>
                  </Box>
    
                  <Box mt={4}>
                    <TextField
                      label="Discount Rate (%)"
                      type="number"
                      fullWidth
                      value={discountRates[product.id] || ''}
                      onChange={(e) => handleDiscountChange(product.id, e.target.value)}
                    />
                  </Box>
    
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      color="secondary"
                      disabled={updating[product.id]}
                      onClick={() => handleApplyDiscount(product.id)}
                    >
                      {updating[product.id] ? 'Applying...' : 'Apply Discount'}
                    </Button>
                  </Box>
    
                  <Box mt={1}>
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={updating[product.id]}
                      onClick={() => handleCancelDiscount(product.id)}
                    >
                      {updating[product.id] ? 'Cancelling...' : 'Cancel Discount'}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))
          )}
    
          <Typography variant="h4" gutterBottom sx={{ mt: 6 }}>
            Pending Refund Requests
          </Typography>
    
          {loadingRefunds ? (
            <CircularProgress />
          ) : refunds.length === 0 ? (
            <Typography>No pending refund requests</Typography>
          ) : (
            refunds.map(refund => (
              <Paper key={refund.id} sx={{ p: 2, mb: 2 }}>
                <Typography><strong>Customer:</strong> {refund.customer_name}</Typography>
                <Typography><strong>Product:</strong> {refund.product_name}</Typography>
                <Typography><strong>Order ID:</strong> {refund.order_id}</Typography>
                <Typography><strong>Quantity:</strong> {refund.quantity}</Typography>
                <Typography><strong>Requested on:</strong> {new Date(refund.request_date).toLocaleString()}</Typography>
                <Button
                  variant="contained"
                  color="success"
                  sx={{ mt: 1 }}
                  onClick={() => approveRefund(refund.id)}
                >
                  Approve Refund
                </Button>
              </Paper>
            ))
          )}
        </Box>
      );
    };
export default SalesManager;


