// src/pages/Profile.js
import React, { useState, useEffect, useContext } from 'react';
import { createTheme, ThemeProvider, styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Alert
} from '@mui/material';
import { SessionContext } from '../middleware/SessionManager';

const MainContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
}));

export default function ProfilePage() {
  const { user } = useContext(SessionContext);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', home_address: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/profile' } });
      return;
    }
    fetch('/api/user/profile')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
      })
      .then(data => {
        setForm({
          name: data.name || '',
          email: data.email || '',
          home_address: data.home_address || '',
          password: '',
          confirmPassword: ''
        });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [user, navigate]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setError(null);
    setSuccess('');
    // Validate password match
    if (form.password && form.password !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name,
      home_address: form.home_address
    };
    if (form.password) payload.password = form.password;

    fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Save failed');
        return res.json();
      })
      .then(() => {
        setSuccess('Profile updated successfully');
        setSaving(false);
        setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      })
      .catch(err => {
        setError(err.message);
        setSaving(false);
      });
  };

  if (loading) {
    return (
      <MainContainer>
        <CircularProgress />
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <Card sx={{ maxWidth: 600, margin: 'auto' }}>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            My Profile
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          <Box component="form" noValidate autoComplete="off">
            <TextField
              fullWidth
              margin="normal"
              label="Name"
              name="name"
              value={form.name}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Email"
              name="email"
              value={form.email}
              disabled
            />
            <TextField
              fullWidth
              margin="normal"
              label="Home Address"
              name="home_address"
              value={form.home_address}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="normal"
              label="New Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
            />
          </Box>
        </CardContent>
        <CardActions>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardActions>
      </Card>
    </MainContainer>
  );
}
