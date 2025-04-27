// src/pages/AdminInterface.js

import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionContext } from '../middleware/SessionManager';
import { Typography, Box, Button, Stack, Paper } from '@mui/material';
import InventoryIcon from '@mui/icons-material/Inventory';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

function AdminInterface() {
  const { user, loading } = useContext(SessionContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (
        !user ||
        (!user.roles.includes('product_manager') && !user.roles.includes('sales_manager'))
      ) {
        navigate('/');
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <Box p={4} display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Typography variant="h6">Loading...</Typography>
      </Box>
    );
  }

  if (!user || (!user.roles.includes('product_manager') && !user.roles.includes('sales_manager'))) {
    return null;
  }

  return (
    <Box p={4} display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
      <Paper elevation={4} sx={{ p: 6, borderRadius: 4, textAlign: 'center', width: '100%', maxWidth: 500 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Admin Dashboard
        </Typography>
        <Typography variant="subtitle1" color="textSecondary" gutterBottom>
          Welcome! Manage products and view sales below.
        </Typography>

        <Stack spacing={3} mt={4}>
          <Button
            variant="contained"
            size="large"
            startIcon={<InventoryIcon />}
            onClick={() => navigate('/product-manager')}
            disabled={!user.roles.includes('product_manager')}
          >
            Product Management
          </Button>

          <Button
            variant="contained"
            size="large"
            color="secondary"
            startIcon={<MonetizationOnIcon />}
            onClick={() => navigate('/sales-manager')}
            disabled={!user.roles.includes('sales_manager')}
          >
            Sales Management
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default AdminInterface;
