import React, { useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Button, Accordion,
    AccordionSummary, AccordionDetails, CircularProgress
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

    useEffect(() => {
        fetchUnpricedProducts();
    }, []);

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
            alert('Please enter a valid discount rate (0–100)');
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
                const final_price = (
                    (priceUpdates[productId] || products.find(p => p.id === productId)?.price || 0) *
                    (1 - rate / 100)
                ).toFixed(2);

                setProducts(prev => prev.map(p =>
                    p.id === productId ? { ...p, final_price } : p
                ));

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

            {products.length === 0 ? (
                <Typography>No products </Typography>
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
                            <Typography>Category: {product.category}</Typography>
                            {product.final_price && (
                                <Typography sx={{ mt: 1 }}>
                                    Final Price: <strong>${product.final_price}</strong>
                                </Typography>
                            )}

                            {/* Price Field */}
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

                            {/* Discount Field */}
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
                        </AccordionDetails>
                    </Accordion>
                ))
            )}
        </Box>
    );
};

export default SalesManager;


