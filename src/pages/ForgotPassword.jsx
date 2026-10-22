import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, Loader2, KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      console.error('[ForgotPassword] Error:', err);
      setError(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 160px)' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="brand-icon-wrap" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>
            <KeyRound size={22} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>Reset Password</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Enter your account email and we'll send you a password recovery link
          </p>
        </div>

        {/* Success message */}
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{ 
                background: 'rgba(16, 185, 129, 0.15)', 
                border: '1px solid rgba(16, 185, 129, 0.3)', 
                borderRadius: 'var(--radius-md)', 
                padding: '1.25rem', 
                marginBottom: '1.5rem',
                textAlign: 'left',
                display: 'flex',
                gap: '0.75rem',
                color: '#34d399'
              }}
              id="reset-success-notice"
            >
              <CheckCircle2 size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                <strong>Recovery email sent!</strong><br />
                We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and click the link to choose a new password.
              </div>
            </div>

            <Link to="/login" className="btn btn-secondary" style={{ width: '100%' }}>
              <ArrowLeft size={16} /> Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate id="forgot-password-form">
            {/* Error banner */}
            {error && (
              <div 
                style={{ 
                  background: 'rgba(244, 63, 94, 0.15)', 
                  border: '1px solid rgba(244, 63, 94, 0.3)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '0.85rem 1rem', 
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  color: '#fb7185',
                  fontSize: '0.88rem'
                }}
                id="forgot-password-error-banner"
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="forgot-email">
                Registered Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={loading}
                  className={`form-input ${error ? 'is-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                />
                <Mail 
                  size={18} 
                  color="var(--text-dim)" 
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} 
                />
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="btn btn-primary" 
              id="forgot-submit-btn"
              disabled={loading}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.85rem', opacity: loading ? 0.8 : 1 }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" /> Sending Link...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>

            {/* Back to login */}
            <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem' }}>
              <Link to="/login" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <ArrowLeft size={16} /> Back to Sign In
              </Link>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
