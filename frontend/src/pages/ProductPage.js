// --- File: src/pages/ProductPage.js ---
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CartContext } from '../App';
import Rating from '@mui/material/Rating';
import Box from '@mui/material/Box';

function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [comments, setComments] = useState([]);
  const [avgRating, setAvgRating] = useState(null);

  const { addToCart } = useContext(CartContext);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${id}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (isMounted) setProduct(data);
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/comments/${id}`);
        if (res.ok) {
          const data = await res.json();
          setComments(data);
        }
      } catch (err) {
        console.error("Failed to fetch comments", err);
      }
    };

    const fetchRating = async () => {
      try {
        const res = await fetch(`/api/ratings/${id}`);
        if (res.ok) {
          const { average_rating } = await res.json();
          setAvgRating(average_rating);
        }
      } catch (err) {
        console.error("Failed to fetch rating", err);
      }
    };

    fetchProduct();
    fetchComments();
    fetchRating();

    return () => { isMounted = false; };
  }, [id]);

  const handleIncrement = () => {
    if (product && quantity < product.stock) {
      setQuantity(q => q + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  const handleManualChange = (e) => {
    const value = e.target.value;
    if (value === "") {
      setQuantity("");
      return;
    }
    if (product && !isNaN(value) && value >= 1 && value <= product.stock) {
      setQuantity(Number(value));
    }
  };

  const handleBlur = (e) => {
    if (e.target.value === "") {
      setQuantity(1);
    }
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
    }
  };

  const handleGoBack = () => {
    navigate('/');
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!product) return <div className="not-found">Product not found</div>;

  return (
    <div className='product-page'>
      <div className="back-to-main-container">
        <button onClick={handleGoBack} className="back-btn">
          ← Back to Main Page
        </button>
      </div>

      <div className="product-image-container">
        <img
          src={`/${product.image_path}`}
          alt={product.name}
          className="product-image scale-image"
        />
      </div>

      <div className="product-info">
        <h2 className="product-name">{product.name}</h2>
        <p className="product-description">{product.description}</p>
        <p className="product-category">Category: {product.category}</p>
        <p className="product-price">Price: ${product.price}</p>
        <p className="product-stock">Stock: {product.stock}</p>

        <div className="quantity-selector no-navigate">
          <button onClick={handleDecrement} className={`quantity-btn ${quantity === 1 ? 'disabled' : ''}`} disabled={quantity === 1}>–</button>
          <input
            type="text"
            value={quantity}
            onChange={handleManualChange}
            onBlur={handleBlur}
            className="quantity-input"
          />
          <button onClick={handleIncrement} className={`quantity-btn ${quantity === product.stock ? 'disabled' : ''}`} disabled={quantity === product.stock}>+</button>
        </div>

        <button onClick={handleAddToCart} className="add-to-cart-btn">Add to Cart</button>
      </div>

      <div className="product-rating">
        <h3>Rating</h3>
        {avgRating !== null ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Rating
              name="read-only"
              value={Number(avgRating)}
              precision={0.5}
              readOnly
              sx={{ color: '#e67300', fontSize: '1.8rem' }}
            />
            <Box sx={{ ml: 1, fontSize: '1.2rem', color: '#555' }}>{Number(avgRating).toFixed(1)}</Box>
          </Box>
        ) : (
          <p>No ratings yet.</p>
        )}
      </div>

      <div className="product-comments">
        <h3>Comments</h3>
        {comments.length === 0 ? (
          <p>No comments yet.</p>
        ) : (
          <ul>
            {comments.map((c, i) => (
              <li key={i} className="comment-item">
                <strong>{c.name}</strong> ({new Date(c.created_at).toLocaleDateString()}):<br />
                {c.comment_text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ProductPage;
