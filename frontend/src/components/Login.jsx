import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Implement your login logic here (e.g., API call)
    console.log({ email, password });
    if (onLogin) onLogin();
  };

  return (
    <div style={{ width: '300px', margin: '100px auto' }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
        <label htmlFor="email" style={{ marginBottom: '8px' }}>Email:</label>
        <input
          type="email"
          id="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ marginBottom: '16px' }}
          required
        />

        <label htmlFor="password" style={{ marginBottom: '8px' }}>Password:</label>
        <input
          type="password"
          id="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: '16px' }}
          required
        />

        <button type="submit">Login</button>
      </form>
      <p style={{ marginTop: '16px' }}>
        Don't have an account?{' '}
        <button
          onClick={() => navigate('/register')}
          style={{
            background: 'none',
            border: 'none',
            textDecoration: 'underline',
            color: 'blue',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Register
        </button>
      </p>
    </div>
  );
}

export default Login;
