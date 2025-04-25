// src/pages/InvoicePage.jsx
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { InvoiceViewer, InvoiceDownloadLink } from './InvoiceDoc';
import { Container, Typography, Box, Button, Alert } from '@mui/material';

export default function InvoicePage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  // If someone lands here manually (no state), bounce back
  if (!state?.order) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="warning">
          No invoice found. Please place an order first.
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={() => navigate('/')}>
            Go to Products
          </Button>
        </Box>
      </Container>
    );
  }

  const { order } = state;

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Invoice #{order.order_id}
      </Typography>

      <InvoiceViewer order={order} items={order.items} />

      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <InvoiceDownloadLink order={order} items={order.items} />
        <Button
          variant="outlined"
          href={`mailto:${order.email || ''}?subject=Invoice%20#${order.order_id}`}
        >
          Email Invoice (opens mail client)
        </Button>
      </Box>
    </Container>
  );
}
