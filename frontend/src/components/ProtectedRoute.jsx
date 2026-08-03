import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Usage:
 *   <ProtectedRoute>               → any authenticated user
 *   <ProtectedRoute role="admin">  → admin only
 */
export default function ProtectedRoute({ children, role }) {
  const { auth, hasRole } = useAuth();
  const location = useLocation();

  if (!auth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && !hasRole(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
