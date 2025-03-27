import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import ProductListing from './components/ProductListing'; // your listing + search bar
import SearchResults from './components/SearchResults'; // ⬅️ New Component

import { SessionProvider } from './middleware/SessionManager';

// ----- CART CONTEXT AND PROVIDER -----
export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    const storedCart = localStorage.getItem('cart');
    return storedCart ? JSON.parse(storedCart) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, quantity) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...prevCart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image_path: product.image_path,
          quantity,
          stock: product.stock,
        },
      ];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateCartQuantity = (productId, newQuantity) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateCartQuantity }}>
      {children}
    </CartContext.Provider>
  );
};

// ----- APP COMPONENT -----


function App() {
  return (
    <SessionProvider>
      <CartProvider>
        <Router>
          <Routes>
            <Route path="/" element={<ProductListing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/search" element={<SearchResults />} /> {/* 🔍 Search Page */}

          </Routes>
        </Router>
      </CartProvider>
    </SessionProvider>
  );
}

export default App;
