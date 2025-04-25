// src/pages/ProductPage.js
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Rating from '@mui/material/Rating';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { CartContext } from '../App';

const PageContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: 1200,
  margin: '0 auto',
}));

const BackContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const ImageContainer = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  '& img': {
    maxWidth: '100%',
    borderRadius: theme.shape.borderRadius,
  },
}));

const InfoContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const QuantityContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const SectionContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(4),
}));

function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useContext(CartContext);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [comments, setComments] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, commRes, rateRes, canRes] = await Promise.all([
          fetch(`/api/products/${id}`),
          fetch(`/api/comments/${id}`),
          fetch(`/api/ratings/${id}`),
          fetch(`/api/can-review/${id}`, { credentials: 'include' }),
        ]);
        if (!prodRes.ok) throw new Error(`Failed to load product (${prodRes.status})`);
        const prodData = await prodRes.json();
        setProduct(prodData);

        if (commRes.ok) setComments(await commRes.json());
        if (rateRes.ok) {
          const { average_rating } = await rateRes.json();
          setAvgRating(average_rating);
        }
        if (canRes.ok) {
          const { canReview } = await canRes.json();
          setCanReview(canReview);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleGoBack = () => navigate('/');
  const handleIncrement = () => product && setQuantity(q => Math.min(q + 1, product.stock));
  const handleDecrement = () => setQuantity(q => Math.max(q - 1, 1));
  const handleAddToCart = () => product && addToCart(product, quantity);

  const handleSubmitReview = async () => {
    setSubmitting(true);
    try {
      if (userRating) {
        await fetch('/api/ratings', {
          method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ productId: id, rating: userRating })
        });
      }
      if (userRating && commentText.trim()) {
        await fetch('/api/comments', {
          method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ productId: id, comment_text: commentText })
        });
        setCommentText('');
      }
      // Refresh
      const [newComments, newRating] = await Promise.all([
        fetch(`/api/comments/${id}`).then(r=>r.json()),
        fetch(`/api/ratings/${id}`).then(r=>r.json())
      ]);
      setComments(newComments);
      setAvgRating(newRating.average_rating);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Typography align="center">Loading...</Typography>;
  if (error) return <Typography color="error" align="center">Error: {error}</Typography>;
  if (!product) return <Typography align="center">Product not found</Typography>;

  return (
    <PageContainer>
      <BackContainer>
        <Button startIcon={<ArrowBackIcon />} onClick={handleGoBack} variant="outlined">
          Back to Products
        </Button>
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
              <TextField
                type="number"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Math.min(Number(e.target.value)||1, product.stock)))}
                inputProps={{ min: 1, max: product.stock, style: { textAlign: 'center', width: 60 } }}
                size="small"
              />
              <IconButton onClick={handleIncrement} disabled={quantity >= product.stock}><AddIcon /></IconButton>
            </QuantityContainer>
            <Button variant="contained" onClick={handleAddToCart}>Add to Cart</Button>
          </InfoContainer>
        </Grid>
      </Grid>

      <SectionContainer>
        <Typography variant="h5">Rating</Typography>
        <Box display="flex" alignItems="center" mt={1}>
          {avgRating !== null ? (
            <>
              <Rating value={Number(avgRating)} precision={0.5} readOnly sx={{ mr: 1 }} />
              <Typography>{Number(avgRating).toFixed(1)}</Typography>
            </>
          ) : <Typography>No ratings yet.</Typography>}
        </Box>
      </SectionContainer>

      <SectionContainer>
        <Typography variant="h5">Comments</Typography>
        {comments.length === 0 ? (
          <Typography>No comments yet.</Typography>
        ) : (
          <Box component="ul" sx={{ pl: 2, mt: 1 }}>
            {comments.map((c,i) => (
              <li key={i}>
                <Typography variant="subtitle2">{c.name} <Typography component="span" variant="body2" color="text.secondary">({new Date(c.created_at).toLocaleDateString()})</Typography></Typography>
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
            <Rating value={userRating} onChange={(e,newVal)=>setUserRating(newVal)} />
          </Box>
          <TextField
            multiline
            minRows={3}
            fullWidth
            variant="outlined"
            value={commentText}
            onChange={e=>setCommentText(e.target.value)}
            placeholder="Write your comment (optional)"
          />
          <Box mt={2}>
            <Button variant="contained" onClick={handleSubmitReview} disabled={submitting || !userRating}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </Box>
        </SectionContainer>
      )}
    </PageContainer>
  );
}

export default ProductPage;