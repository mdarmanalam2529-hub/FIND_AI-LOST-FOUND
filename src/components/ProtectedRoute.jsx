import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div 
        className="container" 
        style={{ 
          minHeight: '60vh', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '1rem' 
        }}
      >
        <div 
          style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: '50%', 
            background: 'var(--primary-gradient)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)'
          }}
          className="glow-animation"
        >
          <Sparkles size={26} color="#ffffff" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Verifying authentication session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login page and remember the page the user tried to visit
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
