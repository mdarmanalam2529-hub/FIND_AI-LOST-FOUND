import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';

export default function ResetPassword() {
  const { updatePassword, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [linkError] = useState(() => { const hash = window.location.hash; const search = window.location.search; const parseParams = (str) => { if (!str) return {}; const query = str.startsWith('#') || str.startsWith('?') ? str.substring(1) : str; const params = {}; new URLSearchParams(query).forEach((val, key) => { params[key] = val; }); return params; }; const hashParams = parseParams(hash); const searchParams = parseParams(search); const allParams = { ...searchParams, ...hashParams }; if (allParams.error || allParams.error_description) { return allParams.error_description?.replace(/\+/g, ' ') || 'This password reset link is invalid or has expired.'; } return null; });



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter a new password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
    } catch (err) {
      console.error('[ResetPassword] Error updating password:', err);
      setError(err.message || 'Failed to update password. Your reset link may have expired.');
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
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>Set New Password</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Choose a secure password for your FindAI account
          </p>
        </div>

        {/* Link Error (e.g. OTP Expired / Invalid Token) */}
        {linkError ? (
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{ 
                background: 'var(--lost-subtle)', 
                border: '1px solid var(--lost-border)', 
                borderRadius: 'var(--radius-md)', 
                padding: '1.25rem', 
                marginBottom: '1.5rem',
                textAlign: 'left',
                display: 'flex',
                gap: '0.75rem',
                color: 'var(--lost-accent)'
              }}
              id="reset-link-error-banner"
            >
              <AlertCircle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                <strong>Link Expired or Invalid</strong><br />
                {linkError}
              </div>
            </div>

            <Link to="/forgot-password" className="btn btn-primary" style={{ width: '100%' }}>
              Request New Reset Link
            </Link>
          </div>
        ) : success ? (
          /* Success Screen */
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
              id="password-update-success"
            >
              <CheckCircle2 size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--found-accent)' }}>Password updated!</strong><br />
                Your account password has been updated successfully. You can now access your dashboard.
              </div>
            </div>

            <Link to="/dashboard" className="btn btn-primary" style={{ width: '100%' }}>
              Go to Dashboard
            </Link>
          </div>
        ) : (
          /* Password Update Form */
          <form onSubmit={handleSubmit} noValidate id="reset-password-form">
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
                id="reset-password-error-banner"
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* New Password Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={loading}
                  className={`form-input ${error ? 'is-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                />
                <Lock 
                  size={18} 
                  color="var(--text-dim)" 
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="confirm-new-password">
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={loading}
                  className={`form-input ${error ? 'is-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                />
                <Lock 
                  size={18} 
                  color="var(--text-dim)" 
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} 
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="btn btn-primary" 
              id="set-new-password-btn"
              disabled={loading}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.85rem', opacity: loading ? 0.8 : 1 }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" /> Updating Password...
                </>
              ) : (
                'Update Password'
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
