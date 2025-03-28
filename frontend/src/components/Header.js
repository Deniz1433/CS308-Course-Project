import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { SessionContext } from '../middleware/SessionManager';

function Header() {
  const { user, logout } = useContext(SessionContext);

  return (
    <header className="App-header">
      <div className="header-container">
        <h1>Product Listings</h1>
        {user ? (
          <div>
            <span>Welcome, {user.name}!</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        ) : (
          <Link to="/login">
            <button className="login-btn">Login</button>
          </Link>
        )}
      </div>
    </header>
  );
}

export default Header;
