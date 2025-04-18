import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate} from 'react-router-dom';
import { CartContext } from '../App';

function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useContext(CartContext);
  const navigate = useNavigate();


  useEffect(() => {
    let isMounted = true; // Flag to track component mount state
    
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${id}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (isMounted) {
          setProduct(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    return () => {
      isMounted = false; // Cleanup function to prevent state updates on unmounted component
    };
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
        <button 
          onClick={handleGoBack} 
          className="back-btn"
        >
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
            <button
                onClick={handleDecrement}
                className={`quantity-btn ${quantity === 1 ? 'disabled' : ''}`}
                disabled={quantity === 1}
            >
                –
            </button>
            <input
                type="text"
                value={quantity}
                onChange={handleManualChange}
                onBlur={handleBlur}
                className="quantity-input"
            />
            <button
                onClick={handleIncrement}
                className={`quantity-btn ${quantity === product.stock ? 'disabled' : ''}`}
                disabled={quantity === product.stock}
            >
                +
            </button>
            </div>
            <button onClick={handleAddToCart} className="add-to-cart-btn">Add to Cart</button>
        </div>

    
    </div>

        
  );
}

export default ProductPage;