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

function Toast({ message, onClose }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const totalDuration = 4000; // 4 seconds
    const interval = 100;
    const decrement = 100 * (interval / totalDuration);

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - decrement;
      });
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
  const [toastMessage, setToastMessage] = useState('');
  const [pendingReview, setPendingReview] = useState(null);
  const [showPending, setShowPending] = useState(false);
  const { user } = useContext(SessionContext);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [categories, setCategories] = useState([]);

  
  useEffect(() => {
	  if (!user) {
		setPendingReview(null);
	  }
	}, [user]);

	useEffect(() => {
	  fetch('/api/categories')
		.then(res => res.json())
		.then(setCategories)
		.catch(console.error);
	}, []);
	
	const getCategoryName = (id) => {
	  const category = categories.find(cat => cat.id === id);
	  return category ? category.name : 'Unknown';
	};


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
        if (rateRes.ok) {
          const { average_rating } = await rateRes.json();
          setAvgRating(average_rating);
        }
        if (canRes.ok) {
          const { canReview } = await canRes.json();
          setCanReview(canReview);
        }
		if (pendingRes.ok) {
		  const pendingData = await pendingRes.json();
		  if (pendingData) {
			setPendingReview({
			  id: pendingData.comment_id,
			  rating: pendingData.rating,
			  comment: pendingData.comment_text,
			  date: new Date(pendingData.created_at)
			});
		  }
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

  const handleGoBack = () => navigate('/');
  const handleIncrement = () => product && setQuantity(q => Math.min(q + 1, product.stock));
  const handleDecrement = () => setQuantity(q => Math.max(q - 1, 1));
  const handleAddToCart = () => product && addToCart(product, quantity);
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
  async function handleDeleteComment(commentId) {
	  try {
		await fetch(`/api/delete-comment/${commentId}`, { method: 'DELETE', credentials: 'include' });

		setComments(prev => prev.filter(c => c.comment_id !== commentId));
		setToastMessage('Comment deleted successfully.');

		// Refresh rating after deleting
		const newRating = await fetch(`/api/ratings/${id}`).then(r => r.json());
		setAvgRating(newRating.average_rating);

	  } catch (err) {
		console.error('Error deleting comment:', err);
		setToastMessage('Failed to delete comment.');
	  }
	}



	const handleSubmitReview = async () => {
	  setSubmitting(true);
	  try {
		if (userRating) {
		  await fetch('/api/ratings', {
			method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ productId: id, rating: userRating })
		  });
		}

		if (userRating && commentText.trim()) {
		  await fetch('/api/comments', {
			method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ productId: id, comment_text: commentText })
		  });
		  setCommentText('');
		  setToastMessage('Your comment was submitted for review.');

		  // ✅ New: Refetch your pending comment properly
		  const pendingRes = await fetch(`/api/pending-comment/${id}`, { credentials: 'include' });
		  if (pendingRes.ok) {
			const pendingData = await pendingRes.json();
			if (pendingData) {
			  setPendingReview({
				id: pendingData.comment_id,
				rating: userRating, // if you store rating too, otherwise can be 0
				comment: pendingData.comment_text,
				date: new Date(pendingData.created_at)
			  });
			}
		  }
		}

		// Only refresh rating, not comments (since pending is hidden)
		const newRating = await fetch(`/api/ratings/${id}`).then(r => r.json());
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
            <Typography variant="subtitle1">Category: {getCategoryName(product.category_id)}</Typography>
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
			{user && (
               <FormControlLabel
                 control={<Checkbox checked={isWishlisted} onChange={handleWishlistToggle} />}
                 label="Add to Wishlist"
               />
             )}
          </InfoContainer>
        </Grid>
      </Grid>
	  
	  {user && pendingReview && (
	  <SectionContainer>
		<Box display="flex" alignItems="center" justifyContent="space-between" bgcolor="#fffde7" px={2} py={1} borderRadius={1} mb={2}>
		  <Button color="inherit" onClick={() => setShowPending(prev => !prev)}>
			You have 1 pending review
		  </Button>
		  <Button color="error" onClick={async () => {
			  if (pendingReview?.id) {
				await handleDeleteComment(pendingReview.id);
				setPendingReview(null);
			  }
			}}>
			  Delete
			</Button>
		</Box>
		{showPending && (
		  <Box sx={{ opacity: 0.5, border: '1px dashed grey', p: 2, mb: 2 }}>
			<Typography variant="subtitle2">
			  You ({pendingReview.date.toLocaleDateString()})
			</Typography>
			<Rating value={pendingReview.rating} precision={0.5} readOnly sx={{ mb: 1 }} />
			<Typography variant="body1">{pendingReview.comment}</Typography>
		  </Box>
		)}
	  </SectionContainer>
	)}


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
            {comments.map((c, i) => (
			  <li key={i}>
				<Box display="flex" alignItems="center" justifyContent="space-between">
				  <Typography variant="subtitle2">
					{c.name} 
					<Typography component="span" variant="body2" color="text.secondary">
					  ({new Date(c.created_at).toLocaleDateString()})
					</Typography>
				  </Typography>
				  {user && c.user_id === user.id && (
					  <Button color="error" size="small" onClick={() => handleDeleteComment(c.comment_id)}>
						Delete
					  </Button>
					)}
				</Box>
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
	{toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}
    </PageContainer>
  );
}

export default ProductPage;