// src/pages/Invoice.js
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Container,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Box
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

export default function InvoicePage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [emailing, setEmailing] = useState(false)
  const [error, setError] = useState('')
  const [emailMsg, setEmailMsg] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/invoice/${orderId}`, {
      method: 'GET',
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Invoice not found')
        return res.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        setPdfUrl(url)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [orderId])

  const handleResend = async () => {
    setEmailMsg('')
    setEmailing(true)
    try {
      const res = await fetch(`/api/invoice/${orderId}/email`, {
        method: 'POST',
        credentials: 'include'
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Failed to send email')
      }
      setEmailMsg('Invoice emailed successfully!')
    } catch (err) {
      setEmailMsg(`Error: ${err.message}`)
    } finally {
      setEmailing(false)
    }
  }

  return (
    <Container sx={{ my: 4 }}>
      {/* Back to Products */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          onClick={() => navigate('/')}
        >
          Back to Products
        </Button>
      </Box>

      <Typography variant="h4" gutterBottom>
        Invoice
      </Typography>

      {loading && <CircularProgress />}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <Box>
          {/* Embed the PDF */}
          <Box
            component="iframe"
            src={pdfUrl}
            width="100%"
            height={600}
            sx={{ border: '1px solid #ccc' }}
          />

          {/* Download button */}
          <Button
            variant="contained"
            fullWidth
            sx={{
              mt: 2,
              backgroundColor: '#1976d2',
              '&:hover': { backgroundColor: '#115293' }
            }}
            href={pdfUrl}
            download={`invoice_${orderId}.pdf`}
          >
            Download Invoice
          </Button>

          {/* Resend email button */}
          <Button
            variant="outlined"
            fullWidth
            sx={{ mt: 2 }}
            onClick={handleResend}
            disabled={emailing}
          >
            {emailing
              ? <CircularProgress size={20} sx={{ color: 'inherit' }} />
              : 'Email Me This Invoice'}
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
  )
}
