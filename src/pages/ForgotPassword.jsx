import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanInput = identifier.trim();

    if (!cleanInput) {
      setError('Please enter your university email or registration number.');
      return;
    }

    setLoading(true);
    try {
      // Use backend anti-enumeration recovery endpoint
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: cleanInput }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Fallback to client-side Supabase reset if email format
        if (cleanInput.includes('@')) {
          await resetPassword(cleanInput);
        } else {
          throw new Error(data.message || 'Unable to process recovery request.');
        }
      }

      setSuccess(true);
    } catch (err) {
      // For email inputs, attempt direct reset if server endpoint was unreachable
      if (cleanInput.includes('@')) {
        try {
          await resetPassword(cleanInput);
          setSuccess(true);
          return;
        } catch {}
      }
      setError(err.message || 'Failed to send password recovery link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 140px)' }}>
      <HeroAnimatedBackground variant="ambient" />
      <div className="container" style={{ position: 'relative', zIndex: 1, padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 160px)' }}>
        <div className="glass-card form-entrance auth-card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', background: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="brand-icon-wrap" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>
            <KeyRound size={22} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>Reset Password</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Enter your registration number or registered email to receive a password recovery link
          </p>
        </div>

        {/* Success message */}
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{ 
                background: 'var(--found-subtle)', 
                border: '1px solid var(--found-border)', 
                borderRadius: 'var(--radius-md)', 
                padding: '1.25rem', 
                marginBottom: '1.5rem',
                textAlign: 'left',
                display: 'flex',
                gap: '0.75rem',
                color: 'var(--found-accent)'
              }}
              id="reset-success-notice"
            >
              <CheckCircle2 size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--found-accent)' }}>Recovery request submitted</strong><br />
                If an active account exists matching <strong>{identifier}</strong>, a password recovery link has been sent to the official registered email address. Please check your inbox and click the link to choose a new password.
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
                  background: 'var(--lost-subtle)', 
                  border: '1px solid var(--lost-border)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '0.85rem 1rem', 
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  color: 'var(--lost-accent)',
                  fontSize: '0.88rem'
                }}
                id="forgot-password-error-banner"
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Identifier Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="forgot-email">
                University Registration Number or Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="forgot-email"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. 251FA04G44 or student@university.edu"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
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
  </div>
  );
}
