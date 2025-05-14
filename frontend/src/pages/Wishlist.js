import React, { useState, useEffect, useContext } from 'react';
import { Box, Grid, Typography, Button, Card, CardMedia, CardContent, CardActions } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { SessionContext } from '../middleware/SessionManager';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';


const Container = styled('div')(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: 1200,
  margin: '0 auto'
}));

function Wishlist() {
  const { user } = useContext(SessionContext);
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const BackContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

  

  useEffect(() => {
    if (!user) return;
    fetch('/api/wishlist', { credentials: 'include' })
      .then(res => res.json())
      .then(setItems)
      .catch(console.error);
  }, [user]);

  const handleRemove = async (id) => {
    await fetch(`/api/wishlist/${id}`, {
      method: 'DELETE', credentials: 'include'
    });
    setItems(items.filter(p => p.id !== id));
  };

  return (
    <Container>
		<BackContainer>
		<Button
		  startIcon={<ArrowBackIcon />}
		  onClick={() => navigate('/')}
		  variant="outlined"
		>
		  Back to Products
		</Button>
	  </BackContainer>
      <Typography variant="h4" gutterBottom>Your Wishlist</Typography>
      {items.length === 0 ? (
        <Typography>No items in your wishlist yet.</Typography>
      ) : (
        <Grid container spacing={2}>
          {items.map(p => (
            <Grid item xs={12} sm={6} md={4} key={p.id}>
              <Card>
                <CardMedia
                  component="img"
                  height="140"
                  image={p.image_path}
                  alt={p.name}
                  onClick={() => navigate(`/product-page/${p.id}`)}
                  sx={{ cursor: 'pointer', objectFit: 'contain' }}
                />
                <CardContent>
                  <Typography variant="h6">{p.name}</Typography>
                  <Typography>${p.price}</Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" color="error" onClick={() => handleRemove(p.id)}>
                    Remove
                  </Button>
                  <Button size="small" onClick={() => navigate(`/product-page/${p.id}`)}>
                    View
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

export default Wishlist;