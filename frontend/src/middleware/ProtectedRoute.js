// frontend/src/middleware/ProtectedRoute.js
import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { SessionContext } from './SessionManager';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(SessionContext);

  if (loading) return null; // or show a spinner while session is loading

  return user ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
