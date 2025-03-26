import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header';
import ProductCard from './ProductCard';
import Cart from './Cart';

const API_URL = 'http://localhost:5000'; // Adjust if needed

// Custom hook to get query parameters using useLocation
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function SearchResults() {
  const queryParams = useQuery();
  const query = queryParams.get('q') || '';
  console.log("Query is:", query);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If there's no query, stop loading
    if (!query) {
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Search API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log("Received data:", data);
        setResults(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Search error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [query]);

  return (
    <div className="App">
      <Header />
      <h2>Search results for: "{query}"</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!loading && !error && (
        <div className="product-list">
          {results.length > 0 ? (
            results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            <p>No products found.</p>
          )}
        </div>
      )}
      <Cart />
    </div>
  );
}

export default SearchResults;
