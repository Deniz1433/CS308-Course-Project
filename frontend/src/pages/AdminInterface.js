// src/pages/AdminInterface.js

import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionContext } from '../middleware/SessionManager';
import { Typography, Box, Button} from '@mui/material';

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
		<Box p={4}>
		  <Typography>Loading...</Typography>
		</Box>
	  );
	}

	if (!user || (!user.roles.includes('product_manager') && !user.roles.includes('sales_manager'))) {
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
       {/* Show buttons depending on the user's role */}
        <Button
		  variant="contained"
		  color="primary"
		  onClick={() => navigate('/product-manager')} 
		  disabled={!user.roles.includes('product_manager')}
		>
		  Go to Product Management
		</Button>
    </Box>
  );
}

export default AdminInterface;


