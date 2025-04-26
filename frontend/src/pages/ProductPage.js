// src/pages/ProductPage.js
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  Box, Grid, Typography, Button, IconButton, TextField, Divider, Rating,
  Checkbox, FormControlLabel
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { CartContext } from '../App';
import { SessionContext } from '../middleware/SessionManager';

const PageContainer = styled(Box)(({ theme }) => ({ padding: theme.spacing(4), maxWidth: 1200, margin: '0 auto' }));
const BackContainer = styled(Box)(({ theme }) => ({ marginBottom: theme.spacing(2) }));
const ImageContainer = styled(Box)(({ theme }) => ({ textAlign: 'center', '& img': { maxWidth: '100%', borderRadius: theme.shape.borderRadius } }));
const InfoContainer = styled(Box)(({ theme }) => ({ display: 'flex', flexDirection: 'column', gap: theme.spacing(2) }));
const QuantityContainer = styled(Box)(({ theme }) => ({ display: 'flex', alignItems: 'center', gap: theme.spacing(1) }));
const SectionContainer = styled(Box)(({ theme }) => ({ marginTop: theme.spacing(4) }));

function Toast({ message, onClose }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const totalDuration = 4000;
    const interval = 100;
    const decrement = 100 * (interval / totalDuration);
    const timer = setInterval(() => {
      setProgress(prev => (prev <= 0 ? (clearInterval(timer), onClose(), 0) : prev - decrement));
    }, interval);
    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <Box position="fixed" top={16} left={16} zIndex={1300} bgcolor="black" color="white" px={2} py={1} borderRadius={1}>
      <Typography variant="body2">{message}</Typography>
      <Box mt={1} height={4} bgcolor="grey.500">
        <Box height="100%" bgcolor="primary.main" width={`${progress}%`} />
      </Box>
    </Box>
  );
}

function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useContext(CartContext);
  const { user } = useContext(SessionContext);

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [comments, setComments] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingReview, setPendingReview] = useState(null);
  const [showPending, setShowPending] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { if (!user) setPendingReview(null); }, [user]);

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, commRes, rateRes, canRes, pendingRes, wishlistRes] = await Promise.all([
          fetch(`/api/products/${id}`),
          fetch(`/api/comments/${id}`),
          fetch(`/api/ratings/${id}`),
          fetch(`/api/can-review/${id}`, { credentials: 'include' }),
          fetch(`/api/pending-comment/${id}`, { credentials: 'include' }),
          fetch('/api/wishlist', { credentials: 'include' }),
        ]);

        if (!prodRes.ok) throw new Error(`Failed to load product (${prodRes.status})`);
        const prodData = await prodRes.json();
        setProduct(prodData);

        if (commRes.ok) setComments(await commRes.json());
        if (rateRes.ok) setAvgRating((await rateRes.json()).average_rating);
        if (canRes.ok) setCanReview((await canRes.json()).canReview);
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          if (pendingData) setPendingReview({ id: pendingData.comment_id, rating: pendingData.rating, comment: pendingData.comment_text, date: new Date(pendingData.created_at) });
        }
        if (wishlistRes.ok) {
          const wishlistItems = await wishlistRes.json();
          setIsWishlisted(wishlistItems.some(p => p.id === prodData.id));
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, user]);

  const handleAddToCart = () => { if (product) addToCart(product, quantity); };
  const handleIncrement = () => { if (product) setQuantity(q => Math.min(q + 1, product.stock)); };
  const handleDecrement = () => { setQuantity(q => Math.max(q - 1, 1)); };
  const handleGoBack = () => navigate('/');

  const handleWishlistToggle = async (e) => {
    const want = e.target.checked;
    try {
      if (want) {
        await fetch('/api/wishlist', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id }) });
      } else {
        await fetch(`/api/wishlist/${product.id}`, { method: 'DELETE', credentials: 'include' });
      }
      setIsWishlisted(want);
    } catch (err) {
      console.error('Wishlist error:', err);
    }
  };

  const handleSubmitReview = async () => {
    setSubmitting(true);
    try {
      if (userRating) {
        await fetch('/api/ratings', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id, rating: userRating }) });
      }
      if (userRating && commentText.trim()) {
        await fetch('/api/comments', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id, comment_text: commentText }) });
        setCommentText('');
        setToastMessage('Your comment was submitted for review.');
      }
      const newRating = await fetch(`/api/ratings/${id}`).then(r => r.json());
      setAvgRating(newRating.average_rating);
    } catch (err) {
      console.error('Review submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Typography align="center">Loading...</Typography>;
  if (error) return <Typography align="center" color="error">Error: {error}</Typography>;
  if (!product) return <Typography align="center">Product not found</Typography>;

  return (
    <PageContainer>
      <BackContainer>
        <Button startIcon={<ArrowBackIcon />} onClick={handleGoBack} variant="outlined">Back to Products</Button>
      </BackContainer>

      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <ImageContainer>
            <img src={`/${product.image_path}`} alt={product.name} />
          </ImageContainer>
        </Grid>
        <Grid item xs={12} md={6}>
          <InfoContainer>
            <Typography variant="h4">{product.name}</Typography>
            <Typography>{product.description}</Typography>
            <Typography variant="subtitle1">Category: {product.category}</Typography>
            <Typography variant="h6" color="primary">${product.price}</Typography>
            <Typography>Stock: {product.stock}</Typography>

            <QuantityContainer>
              <IconButton onClick={handleDecrement} disabled={quantity === 1}><RemoveIcon /></IconButton>
              <TextField type="number" value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(Number(e.target.value) || 1, product.stock)))} inputProps={{ min: 1, max: product.stock, style: { textAlign: 'center', width: 60 } }} size="small" />
              <IconButton onClick={handleIncrement} disabled={quantity >= product.stock}><AddIcon /></IconButton>
            </QuantityContainer>

            <Button variant="contained" onClick={handleAddToCart}>Add to Cart</Button>

            {user && (
              <FormControlLabel
                control={<Checkbox checked={isWishlisted} onChange={handleWishlistToggle} />}
                label="Add to Wishlist"
              />
            )}
          </InfoContainer>
        </Grid>
      </Grid>

      <SectionContainer>
        <Typography variant="h5">Rating</Typography>
        <Box display="flex" alignItems="center" mt={1}>
          {avgRating !== null ? (<><Rating value={Number(avgRating)} precision={0.5} readOnly sx={{ mr: 1 }} /><Typography>{Number(avgRating).toFixed(1)}</Typography></>) : (<Typography>No ratings yet.</Typography>)}
        </Box>
      </SectionContainer>

      <SectionContainer>
        <Typography variant="h5">Comments</Typography>
        {comments.length === 0 ? (<Typography>No comments yet.</Typography>) : (
          <Box component="ul" sx={{ pl: 2, mt: 1 }}>
            {comments.map((c, i) => (
              <li key={i}>
                <Typography variant="subtitle2">{c.name} ({new Date(c.created_at).toLocaleDateString()})</Typography>
                <Rating value={c.rating} precision={0.5} readOnly sx={{ mb: 1 }} />
                <Typography variant="body1">{c.comment_text}</Typography>
                <Divider sx={{ my: 1 }} />
              </li>
            ))}
          </Box>
        )}
      </SectionContainer>

      {canReview && (
        <SectionContainer>
          <Typography variant="h5">Write Your Review</Typography>
          <Box display="flex" alignItems="center" mt={1} mb={2}>
            <Rating value={userRating} onChange={(e, newVal) => setUserRating(newVal)} />
          </Box>
          <TextField
            multiline
            minRows={3}
            fullWidth
            variant="outlined"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Write your comment (optional)"
          />
          <Box mt={2}>
            <Button variant="contained" onClick={handleSubmitReview} disabled={submitting || !userRating}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </Box>
        </SectionContainer>
      )}

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}
    </PageContainer>
  );
}

export default ProductPage;
