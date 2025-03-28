// src/pages/Payment.js
import React, { useState, useContext, useEffect } from 'react';
import { CartContext } from '../App'; // Adjust path if needed
import { SessionContext } from '../middleware/SessionManager';
import { useNavigate } from 'react-router-dom';

const Payment = () => {
  // Get cart details and compute the total amount
  const { cart } = useContext(CartContext);
  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const { user } = useContext(SessionContext);
  const navigate = useNavigate();

  // If the user is not logged in, redirect to login
  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/payment' } });
    }
  }, [user, navigate]);

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Use the computed total for the payment amount
    const data = { cardNumber, expiry, cvv, amount: total };

    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      setMessage(result.message);
    } catch (error) {
      setMessage('Payment failed. Please try again.');
    }
  };

  return (
    <div className="payment-container">
      <h2>Payment</h2>
      <p>Total Amount: ${total.toFixed(2)}</p>
      <form onSubmit={handleSubmit} className="payment-form">
        <input
          type="text"
          placeholder="Card Number"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Expiry Date (MM/YY)"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="CVV"
          value={cvv}
          onChange={(e) => setCvv(e.target.value)}
          required
        />
        <button type="submit">Pay</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Payment;
