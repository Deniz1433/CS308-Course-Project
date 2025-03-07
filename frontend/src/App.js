import React, { useState, useEffect } from 'react';
import './App.css';

function ProductCard({ product }) {
  const [quantity, setQuantity] = useState(1);

  const handleIncrement = () => {
    setQuantity(q => q + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  return (
    <div className="product-card">
      <div className="product-image-container">
        {/* Image is scaled down and constrained by CSS */}
        <img
          src={`/${product.image_path}`}
          alt={product.name}
          className="product-image"
        />
      </div>
      <div className="product-info">
        <h2 className="product-name">{product.name}</h2>
        <p className="product-description">{product.description}</p>
        <p className="product-category">Category: {product.category}</p>
        <p className="product-price">Price: ${product.price}</p>
        <div className="quantity-selector">
          <button
            onClick={handleDecrement}
            className={`quantity-btn ${quantity === 1 ? 'disabled' : ''}`}
            disabled={quantity === 1}
          >
            –
          </button>
          <span className="quantity-value">{quantity}</span>
          <button onClick={handleIncrement} className="quantity-btn">+</button>
        </div>
        <button className="add-to-cart-btn">Add to Cart</button>
      </div>
    </div>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/products'),
      fetch('/api/images')
    ])
      .then(async ([productsRes, imagesRes]) => {
        if (!productsRes.ok) {
          throw new Error(`Products API error: ${productsRes.status}`);
        }
        if (!imagesRes.ok) {
          throw new Error(`Images API error: ${imagesRes.status}`);
        }
        const productsData = await productsRes.json();
        const imagesData = await imagesRes.json();
        return [productsData, imagesData];
      })
      .then(([productsData, imagesData]) => {
        setProducts(productsData);
        setImageUrls(imagesData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="App"><p>Loading...</p></div>;
  }

  if (error) {
    return <div className="App"><p>Error: {error}</p></div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Product Listings</h1>
        <div className="product-list">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </header>
    </div>
  );
}

export default App;
