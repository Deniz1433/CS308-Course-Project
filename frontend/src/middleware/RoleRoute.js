// RoleRoute.js
import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { SessionContext } from './SessionManager';

export const RoleRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useContext(SessionContext);
  if (loading) return null;
  if (!user || !allowedRoles.some(role => user.roles.includes(role))) {
    return <Navigate to="/" replace />;
  }
  return children;
};
