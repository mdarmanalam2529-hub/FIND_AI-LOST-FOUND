import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminUser, isStaffOrAdminUser } from '../lib/roleHelpers';

export default function AdminRoute({ children, requireAdminRole = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>Checking administrator privileges…</span>
      </div>
    );
  }

  if (!user) {
    // Not authenticated – send to login preserving intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const authorized = requireAdminRole ? isAdminUser(user) : isStaffOrAdminUser(user);

  if (!authorized) {
    // Authenticated but insufficient privileges – redirect to home
    return <Navigate to="/" replace />;
  }

  // Authorized – render nested routes (children or outlet)
  return children || <Outlet />;
}
