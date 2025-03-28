import React, { useState, useEffect } from 'react';
import Header from './Header';
import ProductCard from './ProductCard';
import Cart from './Cart';

const API_URL = 'http://localhost:5000';

function ProductListing() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/products`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Products API error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setProducts(data);
        setFilteredProducts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const filtered = products.filter((product) => {
      const term = searchTerm.toLowerCase();
      return (
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        product.description.toLowerCase().includes(term)
      );
    });
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  if (loading) return <div className="App"><p>Loading...</p></div>;
  if (error) return <div className="App"><p>Error: {error}</p></div>;

  // Group filtered products by category
  const categorizedProducts = filteredProducts.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {});
  const categories = Object.keys(categorizedProducts);

  return (
    <div className="App">
      <Header />

      {/* Search bar only (no button) */}
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search by name, category, or description..."
        className="search-form"
      />

      <div className="category-selector">
        <button
          onClick={() => setSelectedCategory(null)}
          className={!selectedCategory ? 'active' : ''}
        >
          All Products
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={selectedCategory === category ? 'active' : ''}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="product-list">
        {selectedCategory ? (
          <div key={selectedCategory}>
            <h2 className="category-title">{selectedCategory}</h2>
            <div className="category-products">
              {categorizedProducts[selectedCategory].map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        ) : (
          categories.map(category => (
            <div key={category}>
              <h2 className="category-title">{category}</h2>
              <div className="category-products">
                {categorizedProducts[category].map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Cart />
    </div>
  );
}

export default ProductListing;
