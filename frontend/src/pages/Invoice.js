// src/pages/Invoice.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Box
} from '@mui/material';

export default function InvoicePage() {
  const { orderId } = useParams();
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [emailing, setEmailing] = useState(false);
  const [error, setError] = useState('');
  const [emailMsg, setEmailMsg] = useState('');

  // 1) fetch the PDF blob & create an object URL
  useEffect(() => {
    setLoading(true);
    fetch(`/api/invoice/${orderId}`, {
      method: 'GET',
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Invoice not found');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  // 4) handler to re-email the invoice
  const handleResend = async () => {
    setEmailMsg('');
    setEmailing(true);
    try {
      const res = await fetch(`/api/invoice/${orderId}/email`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to send email');
      }
      setEmailMsg('Invoice emailed successfully!');
    } catch (err) {
      setEmailMsg(`Error: ${err.message}`);
    } finally {
      setEmailing(false);
    }
  };

  return (
    <Container sx={{ my: 4 }}>
      <Typography variant="h4" gutterBottom>
        Invoice #{orderId}
      </Typography>

      {loading && <CircularProgress />}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <Box>
          {/* 2) embed the PDF */}
          <Box
            component="iframe"
            src={pdfUrl}
            width="100%"
            height={600}
            sx={{ border: '1px solid #ccc' }}
          />

          {/* 3) download button */}
          <Button
            variant="contained"
            href={pdfUrl}
            download={`invoice_${orderId}.pdf`}
            sx={{ mt: 2, mr: 2 }}
          >
            Download Invoice
          </Button>

          {/* 4) resend email */}
          <Button
            variant="outlined"
            onClick={handleResend}
            disabled={emailing}
            sx={{ mt: 2 }}
          >
            {emailing ? <CircularProgress size={20} /> : 'Email Me This Invoice'}
          </Button>

          {emailMsg && (
            <Alert
              severity={emailMsg.startsWith('Error') ? 'error' : 'success'}
              sx={{ mt: 2 }}
            >
              {emailMsg}
            </Alert>
          )}
        </Box>
      )}
    </Container>
  );
}
