// src/pages/AdminInterface.js

import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionContext } from '../middleware/SessionManager';
import { Typography, Box } from '@mui/material';

function AdminInterface() {
  const { user, loading } = useContext(SessionContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user || (user.role !== 'product_manager' && user.role !== 'sales_manager')) {
        navigate('/');
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    // Don't render page while loading
    return (
      <Box p={4}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!user || (user.role !== 'product_manager' && user.role !== 'sales_manager')) {
    // Don't even render Admin UI
    return null;
  }

  return (
    <Box p={4}>
      <Typography variant="h4" gutterBottom>
        Admin Interface
      </Typography>
      <Typography>
        Welcome to the Admin Dashboard! Manage products, view sales, etc.
      </Typography>
    </Box>
  );
}

export default AdminInterface;

