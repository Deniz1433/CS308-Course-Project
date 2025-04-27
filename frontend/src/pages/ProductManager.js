import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Paper,
  IconButton,
  TextField,
  Grid,
  Divider,
  Container,
  Chip,
  Stack,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import InventoryIcon from '@mui/icons-material/Inventory';
import CommentIcon from '@mui/icons-material/Comment';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { useDropzone } from 'react-dropzone';


const ProductManager = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);
  
  // Products states
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingComments, setPendingComments] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [updatedStock, setUpdatedStock] = useState({});

  // Orders states
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderStatusUpdating, setOrderStatusUpdating] = useState({});
  const [expandedOrder, setExpandedOrder] = useState(null);
  
  const [uploadedImageName, setUploadedImageName] = useState('');
	const { getRootProps, getInputProps } = useDropzone({
	  accept: {
		'image/jpeg': ['.jpeg', '.jpg'],
		'image/png': ['.png']
	  },
	  onDrop: async (acceptedFiles) => {
		const file = acceptedFiles[0];
		if (!file) return;

		const formData = new FormData();
		formData.append('image', file);

		try {
		  const res = await fetch('/api/upload-image', {
			method: 'POST',
			body: formData,
		  });
		  const data = await res.json();
		  setUploadedImageName(file.name);
		  handleInputChange('image_path', data.filePath); // Set image_path automatically
		} catch (error) {
		  console.error('Image upload failed', error);
		}
	  }
	});


  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    popularity: '',
    image_path: '',
  });
  
  const [categories, setCategories] = useState([]);

	useEffect(() => {
	  async function fetchCategories() {
		try {
		  const res = await fetch('/api/categories');
		  const data = await res.json();
		  setCategories(data);
		} catch (error) {
		  console.error("Failed to fetch categories", error);
		}
	  }
	  fetchCategories();
	}, []);


  // Status options for orders
  const orderStatusOptions = ['processing', 'in-transit', 'delivered', 'refunded'];

  useEffect(() => {
    if (activeTab === 0) {
      fetchProducts();
    } else if (activeTab === 1) {
      fetchOrders();
    }
  }, [activeTab]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/orders-pm');
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchPendingComments = async (productId) => {
    if (pendingComments[productId]) return;
    setLoadingComments(prev => ({ ...prev, [productId]: true }));
    try {
      const response = await fetch(`/api/pending-comments-pm/${productId}`);
      const data = await response.json();
      setPendingComments(prev => ({ ...prev, [productId]: data }));
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(prev => ({ ...prev, [productId]: false }));
    }
  };

  const handleApproveComment = async (commentId) => {
    try {
      const response = await fetch(`/api/approve-comment/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        setPendingComments(prevState => {
          const updated = { ...prevState };
          Object.keys(updated).forEach(productId => {
            updated[productId] = updated[productId]?.filter(c => c.comment_id !== commentId);
          });
          return updated;
        });
      } else {
        console.error('Failed to approve comment');
      }
    } catch (err) {
      console.error('Error approving comment:', err);
    }
  };

  const handleAccordionChange = (productId) => (event, isExpanded) => {
    setExpandedProduct(isExpanded ? productId : null);
    if (isExpanded) fetchPendingComments(productId);
  };

  const handleOrderAccordionChange = (orderId) => (event, isExpanded) => {
    setExpandedOrder(isExpanded ? orderId : null);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/delete-product/${productId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setProducts(prevProducts => prevProducts.filter(product => product.id !== productId));
        alert('Product deleted successfully');
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to delete product');
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('An error occurred while deleting the product');
    }
  };

  const handleAddProduct = async () => {
  const { name, category_id, price } = newProduct;

  if (!name || !category_id || !price) {
    alert('Please enter product name, category, and price');
    return;
  }

  try {
    const response = await fetch('/api/add-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: newProduct.stock ? parseInt(newProduct.stock) : 0,
        popularity: newProduct.popularity ? parseInt(newProduct.popularity) : 0,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      const addedProduct = {
        id: result.productId,
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: newProduct.stock ? parseInt(newProduct.stock) : 0,
        popularity: newProduct.popularity ? parseInt(newProduct.popularity) : 0,
      };

      setProducts(prevProducts => [...prevProducts, addedProduct]);
      setNewProduct({
        name: '',
        description: '',
        category_id: '',  // <-- ✅ reset category_id not category
        price: '',
        stock: '',
        popularity: '',
        image_path: '',
      });

      alert('Product added successfully');
    } else {
      alert(result.error || 'Failed to add product');
    }
  } catch (err) {
    console.error('Error adding product:', err);
    alert('An error occurred while adding the product');
  }
};


  const handleUpdateStock = async (productId, newStock) => {
    try {
      const response = await fetch(`/api/update-stock/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      });

      if (response.ok) {
        setProducts(prevProducts => {
          return prevProducts.map(product => 
            product.id === productId ? { ...product, stock: newStock } : product
          );
        });
        alert('Stock updated successfully');
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to update stock');
      }
    } catch (err) {
      console.error('Error updating stock:', err);
      alert('An error occurred while updating stock');
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setOrderStatusUpdating(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const response = await fetch(`/api/orders-pm/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Update local state
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.order_id === orderId ? { ...order, status: newStatus } : order
          )
        );
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('An error occurred while updating the order status');
    } finally {
      setOrderStatusUpdating(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleInputChange = (field, value) => {
    setNewProduct(prev => ({ ...prev, [field]: value }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'processing': return 'info';
      case 'in-transit': return 'success';
      case 'delivered': return 'success';
      case 'refunded': return 'warning';
      default: return 'default';
    }
  };
  
  const calculateOrderTotal = (items) => {
    return items.reduce((total, item) => total + (item.price_at_time * item.quantity), 0);
  };

  const renderLoading = () => (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
      <CircularProgress />
    </Box>
  );

  const renderProductsTab = () => {
    if (loading) return renderLoading();

    return (
      <>
        {/* Add Product Form */}
		<Card elevation={3} sx={{ mb: 5, overflow: 'visible' }}>
		  <CardContent>
			<Typography variant="h6" fontWeight="medium" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
			  <AddCircleIcon sx={{ mr: 1 }} /> Add New Product
			</Typography>
			<Divider sx={{ my: 2 }} />
			
			<Grid container spacing={2}>
			  {/* Name - Required */}
			  <Grid item xs={12} sm={6} md={4}>
				<TextField
				  fullWidth
				  required
				  label="Name"
				  value={newProduct.name}
				  onChange={(e) => handleInputChange('name', e.target.value)}
				/>
			  </Grid>

			  {/* Model - Optional */}
			  <Grid item xs={12} sm={6} md={4}>
				<TextField
				  fullWidth
				  label="Model"
				  value={newProduct.model}
				  onChange={(e) => handleInputChange('model', e.target.value)}
				/>
			  </Grid>

			  {/* Serial Number - Optional but Unique */}
			  <Grid item xs={12} sm={6} md={4}>
				<TextField
				  fullWidth
				  label="Serial Number"
				  value={newProduct.serial_number}
				  onChange={(e) => handleInputChange('serial_number', e.target.value)}
				/>
			  </Grid>

			  <Grid item xs={12} sm={6} md={4}>
				  <TextField
					fullWidth
					required
					select
					label="Category"
					value={newProduct.category_id}
					onChange={(e) => handleInputChange('category_id', e.target.value)}
				  >
					{categories.map((cat) => (
					  <MenuItem key={cat.id} value={cat.id}>
						{cat.name}
					  </MenuItem>
					))}
				  </TextField>
				</Grid>

			  {/* Price - Required */}
			  <Grid item xs={12} sm={6} md={4}>
				<TextField
				  fullWidth
				  required
				  label="Price ($)"
				  type="number"
				  value={newProduct.price}
				  onChange={(e) => handleInputChange('price', e.target.value)}
				  InputProps={{
					inputProps: { min: 0, step: 0.01 }
				  }}
				/>
			  </Grid>

			  {/* Stock - Optional (default 0) */}
			  <Grid item xs={12} sm={6} md={4}>
				<TextField
				  fullWidth
				  label="Initial Stock"
				  type="number"
				  value={newProduct.stock}
				  onChange={(e) => handleInputChange('stock', e.target.value)}
				  InputProps={{
					inputProps: { min: 0 }
				  }}
				/>
			  </Grid>

			  {/* Warranty Status - Optional (default 'No Warranty') */}
			  <Grid item xs={12} sm={6} md={4}>
				<TextField
				  fullWidth
				  label="Warranty Status"
				  value={newProduct.warranty_status}
				  onChange={(e) => handleInputChange('warranty_status', e.target.value)}
				  placeholder="No Warranty"
				/>
			  </Grid>

			  {/* Distributor Info - Optional */}
			  <Grid item xs={12} sm={6} md={4}>
				<TextField
				  fullWidth
				  label="Distributor Info"
				  value={newProduct.distributor_info}
				  onChange={(e) => handleInputChange('distributor_info', e.target.value)}
				/>
			  </Grid>

			  <Grid item xs={12} sm={6} md={4}>
			  <Box
				{...getRootProps()}
				sx={{
				  border: '2px dashed #ccc',
				  borderRadius: 2,
				  p: 3,
				  textAlign: 'center',
				  cursor: 'pointer'
				}}
			  >
				<input {...getInputProps()} />
				<Typography variant="body1">
				  {uploadedImageName || "Drag & drop an image here, or click to select"}
				</Typography>
			  </Box>
			</Grid>

			  
			  {/* Popularity - Optional (default 0) */}
			  <Grid item xs={12} sm={6} md={4}>
				<TextField
				  fullWidth
				  label="Popularity (1-10)"
				  type="number"
				  value={newProduct.popularity}
				  onChange={(e) => handleInputChange('popularity', e.target.value)}
				  InputProps={{
					inputProps: { min: 0, max: 10 }
				  }}
				/>
			  </Grid>

			  {/* Description - Optional */}
			  <Grid item xs={12}>
				<TextField
				  fullWidth
				  multiline
				  rows={3}
				  label="Description"
				  value={newProduct.description}
				  onChange={(e) => handleInputChange('description', e.target.value)}
				/>
			  </Grid>
			</Grid>

			<Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
			  <Button 
				variant="contained" 
				size="large"
				color="primary" 
				startIcon={<AddCircleIcon />}
				onClick={handleAddProduct}
			  >
				Add Product
			  </Button>
			</Box>
		  </CardContent>
		</Card>


        {/* Products List */}
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Products ({products.length})
        </Typography>
        
        {products.length === 0 ? (
          <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No products available. Add a new product to get started.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {products.map(product => (
              <Grid item xs={12} key={product.id}>
                <Card elevation={2}>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={8}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h6" component="div">
                            {product.name}
                          </Typography>
                          <IconButton
                            color="error"
                            onClick={() => handleDeleteProduct(product.id)}
                            size="small"
                            sx={{ ml: 1 }}
                            title="Delete Product"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        
                        <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }}>
                          <Chip size="small" label={`$${product.price}`} color="primary" />
                          <Chip size="small" label={product.category} variant="outlined" />
                          <Chip 
                            size="small" 
                            icon={<InventoryIcon sx={{ fontSize: '0.8rem' }} />} 
                            label={`Stock: ${product.stock}`} 
                            variant="outlined"
                            color={product.stock > 5 ? "success" : product.stock > 0 ? "warning" : "error"}
                          />
                        </Stack>
                        
                        {product.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {product.description}
                          </Typography>
                        )}
                      </Grid>
                      
                      <Grid item xs={12} sm={4}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Update Stock
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                              size="small"
                              type="text"
                              fullWidth
                              value={
                                updatedStock[product.id] !== undefined
                                ? updatedStock[product.id]
                                : product.stock.toString()
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  setUpdatedStock(prev => ({ ...prev, [product.id]: '' }));
                                } else if (/^\d+$/.test(value)) {
                                  const numericValue = parseInt(value, 10);
                                  if (numericValue >= 1) {
                                    setUpdatedStock(prev => ({ ...prev, [product.id]: value }));
                                  }
                                }
                              }}
                              InputProps={{
                                inputProps: { min: 1 }
                              }}
                            />
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              onClick={() => handleUpdateStock(product.id, parseInt(updatedStock[product.id] || product.stock))}
                            >
                              Update
                            </Button>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />
                    
                    <Accordion
                      expanded={expandedProduct === product.id}
                      onChange={handleAccordionChange(product.id)}
                      elevation={0}
                      sx={{ 
                        '&:before': { display: 'none' },
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                        borderRadius: 1
                      }}
                    >
                      <AccordionSummary 
                        expandIcon={<ExpandMoreIcon />}
                        sx={{ backgroundColor: 'rgba(0, 0, 0, 0.01)' }}
                      >
                        <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                          <CommentIcon sx={{ mr: 1, fontSize: '0.9rem' }} />
                          Pending Review Comments
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        {loadingComments[product.id] ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                            <CircularProgress size={24} />
                          </Box>
                        ) : pendingComments[product.id]?.length > 0 ? (
                          <Stack spacing={2}>
                            {pendingComments[product.id].map(comment => (
                              <Paper key={comment.comment_id} variant="outlined" sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <Box>
                                    <Typography variant="subtitle2">
                                      User: {comment.user_id}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {new Date(comment.created_at).toLocaleString()}
                                    </Typography>
                                  </Box>
                                  {comment.rating && (
                                    <Chip 
                                      size="small" 
                                      label={`Rating: ${comment.rating}/5`} 
                                      color={comment.rating >= 4 ? "success" : comment.rating >= 3 ? "warning" : "error"}
                                    />
                                  )}
                                </Box>
                                
                                <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
                                  {comment.comment_text}
                                </Typography>
                                
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  startIcon={<CheckCircleIcon />}
                                  onClick={() => handleApproveComment(comment.comment_id)}
                                >
                                  Approve Comment
                                </Button>
                              </Paper>
                            ))}
                          </Stack>
                        ) : (
                          <Box sx={{ p: 2, textAlign: 'center' }}>
                            <Typography color="text.secondary">No pending comments to review.</Typography>
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </>
    );
  };

  const renderOrdersTab = () => {
    if (loadingOrders) return renderLoading();

    return (
      <>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <LocalShippingIcon sx={{ mr: 1 }} /> Orders Management ({orders.length})
        </Typography>

        {orders.length === 0 ? (
          <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No orders available.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {orders.map(order => {
              const orderTotal = calculateOrderTotal(order.items);
              
              return (
                <Grid item xs={12} key={order.order_id}>
                  <Card elevation={2}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Box>
                          <Typography variant="h6">
                            Order #{order.order_id}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(order.order_date).toLocaleString()}
                          </Typography>
                        </Box>
                        <Chip 
                          label={order.status.toUpperCase()}
                          color={getStatusColor(order.status)}
                          size="medium"
                        />
                      </Box>

                      <Divider sx={{ mb: 2 }} />
                      
                      {/* Order Summary - always visible */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Order Summary
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={8}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="body2">
                                <strong>Items:</strong> {order.items.length}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Total Quantity:</strong> {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                              </Typography>
                              <Typography variant="body1" sx={{ mt: 1, fontWeight: 'bold' }}>
                                Total: ${orderTotal}
                              </Typography>
                            </Paper>
                          </Grid>
                          
                          <Grid item xs={12} md={4}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Update Status
                              </Typography>
                              <FormControl fullWidth size="small">
                                <InputLabel id={`status-select-${order.order_id}`}>Status</InputLabel>
                                <Select
                                  labelId={`status-select-${order.order_id}`}
                                  value={order.status}
                                  label="Status"
                                  onChange={(e) => handleUpdateOrderStatus(order.order_id, e.target.value)}
                                  disabled={orderStatusUpdating[order.order_id]}
                                >
                                  {orderStatusOptions.map(status => (
                                    <MenuItem key={status} value={status}>
                                      {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              
                              {orderStatusUpdating[order.order_id] && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                                  <CircularProgress size={24} />
                                </Box>
                              )}
                              
                              {order.status === 'delivered' && (
                                <Alert severity="success" sx={{ mt: 2, py: 0 }}>
                                  Delivery completed
                                </Alert>
                              )}
                            </Paper>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* Order Items - expandable */}
                      <Accordion
                        expanded={expandedOrder === order.order_id}
                        onChange={handleOrderAccordionChange(order.order_id)}
                        elevation={0}
                        sx={{ 
                          '&:before': { display: 'none' },
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          borderRadius: 1
                        }}
                      >
                        <AccordionSummary 
                          expandIcon={<ExpandMoreIcon />}
                          sx={{ backgroundColor: 'rgba(0, 0, 0, 0.01)' }}
                        >
                          <Typography sx={{ display: 'flex', alignItems: 'center' }}>
                            <ShoppingBagIcon sx={{ mr: 1, fontSize: '0.9rem' }} />
                            Order Items ({order.items.length})
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell><strong>Product ID</strong></TableCell>
                                  <TableCell><strong>Product Name</strong></TableCell>
                                  <TableCell align="right"><strong>Quantity</strong></TableCell>
                                  <TableCell align="right"><strong>Price</strong></TableCell>
                                  <TableCell align="right"><strong>Subtotal</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {order.items.map((item, index) => (
                                  <TableRow key={`${order.order_id}-${item.product_id}-${index}`}>
                                    <TableCell>{item.product_id}</TableCell>
                                    <TableCell>{item.product_name}</TableCell>
                                    <TableCell align="right">{item.quantity}</TableCell>
                                    <TableCell align="right">${item.price_at_time}</TableCell>
                                    <TableCell align="right">${(item.quantity * item.price_at_time)}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow>
                                  <TableCell colSpan={3} />
                                  <TableCell align="right"><strong>Order Total:</strong></TableCell>
                                  <TableCell align="right"><strong>${orderTotal}</strong></TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </AccordionDetails>
                      </Accordion>

                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Product Manager
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab icon={<InventoryIcon />} iconPosition="start" label="Products Management" />
          <Tab icon={<LocalShippingIcon />} iconPosition="start" label="Orders Management" />
        </Tabs>
      </Box>

      {activeTab === 0 && renderProductsTab()}
      {activeTab === 1 && renderOrdersTab()}
    </Container>
  );
};

export default ProductManager;