import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TextField, Button, Table, TableHead, TableRow, TableCell, TableBody, Paper, Typography, Container } from '@mui/material';
import { toast } from 'react-toastify';

const UnpricedProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [priceInputs, setPriceInputs] = useState({});

    useEffect(() => {
        fetchUnpricedProducts();
    }, []);

    const fetchUnpricedProducts = async () => {
        try {
            const response = await axios.get('/api/unpriced-products');
            setProducts(response.data);
        } catch (err) {
            toast.error('Failed to fetch unpriced products');
        }
    };

    const handlePriceChange = (productId, value) => {
        setPriceInputs(prev => ({ ...prev, [productId]: value }));
    };

    const handleSetPrice = async (productId) => {
        const price = parseFloat(priceInputs[productId]);
        if (isNaN(price) || price <= 0) {
            toast.error('Please enter a valid price');
            return;
        }

        try {
            await axios.put(`/api/set-price/${productId}`, { price });
            toast.success('Price set successfully');
            fetchUnpricedProducts(); // refresh list
        } catch (err) {
            toast.error('Failed to set price');
        }
    };

    return (
        <Container>
            <Typography variant="h4" gutterBottom>Unpriced Products</Typography>
            <Paper>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Product Name</TableCell>
                            <TableCell>Category ID</TableCell>
                            <TableCell>Model</TableCell>
                            <TableCell>Serial Number</TableCell>
                            <TableCell>Set Price</TableCell>
                            <TableCell>Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {products.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center">No unpriced products found</TableCell>
                            </TableRow>
                        ) : (
                            products.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell>{product.name}</TableCell>
                                    <TableCell>{product.category_id}</TableCell>
                                    <TableCell>{product.model}</TableCell>
                                    <TableCell>{product.serial_number}</TableCell>
                                    <TableCell>
                                        <TextField
                                            type="number"
                                            size="small"
                                            variant="outlined"
                                            value={priceInputs[product.id] || ''}
                                            onChange={(e) => handlePriceChange(product.id, e.target.value)}
                                            placeholder="Enter price"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="contained"
                                            onClick={() => handleSetPrice(product.id)}
                                        >
                                            Set Price
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Paper>
        </Container>
    );
};

export default UnpricedProductsPage;

