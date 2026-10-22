import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [user, authLoading, navigate, location]);

  // If redirected from a protected route
  const redirectMessage = location.state?.from 
    ? 'Please sign in to access that page.' 
    : null;

  const validate = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      await signIn({
        email: formData.email.trim(),
        password: formData.password,
      });

      // Redirect to intended route or dashboard
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      console.error('[Login] Authentication error:', err);
      // Map common Supabase error messages to friendly messages
      let message = err.message || 'An error occurred during sign in.';
      if (message.includes('Invalid login credentials')) {
        message = 'Invalid email or password. Please verify your credentials.';
      } else if (message.includes('Email not confirmed')) {
        message = 'Your email address has not been confirmed yet. Please check your inbox for the confirmation link.';
      }
      setServerError(message);
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
            <LogIn size={24} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>Welcome Back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Sign in to track your reported lost or found items
          </p>
        </div>

        {/* Redirect notice if redirected by ProtectedRoute */}
        {redirectMessage && (
          <div 
            style={{ 
              background: 'rgba(234, 179, 8, 0.12)', 
              border: '1px solid rgba(234, 179, 8, 0.3)', 
              borderRadius: 'var(--radius-md)', 
              padding: '0.75rem 1rem', 
              marginBottom: '1.25rem',
              color: '#fef08a',
              fontSize: '0.85rem'
            }}
          >
            {redirectMessage}
          </div>
        )}

        {/* Server error banner */}
        {serverError && (
          <div 
            style={{ 
              background: 'rgba(244, 63, 94, 0.15)', 
              border: '1px solid rgba(244, 63, 94, 0.3)', 
              borderRadius: 'var(--radius-md)', 
              padding: '0.85rem 1rem', 
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              color: '#fb7185',
              fontSize: '0.88rem'
            }}
            id="login-server-error"
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{serverError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate id="login-form">
          {/* Email Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                className={`form-input ${errors.email ? 'is-invalid' : ''}`}
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail 
                size={18} 
                color="var(--text-dim)" 
                style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} 
              />
            </div>
            {errors.email && (
              <div className="form-error" id="login-email-error">
                <AlertCircle size={14} /> {errors.email}
              </div>
            )}
          </div>

          {/* Password Field */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <Link 
                to="/forgot-password" 
                style={{ fontSize: '0.8rem', color: 'var(--primary-light)' }} 
                id="login-forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                className={`form-input ${errors.password ? 'is-invalid' : ''}`}
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
                id="login-toggle-password"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <div className="form-error" id="login-password-error">
                <AlertCircle size={14} /> {errors.password}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn btn-primary" 
            id="login-submit-btn"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.85rem', opacity: loading ? 0.8 : 1 }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin" /> Signing In...
              </>
            ) : (
              <>
                <LogIn size={18} /> Sign In
              </>
            )}
          </button>
        </form>

        {/* Footer switch to SignUp */}
        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Don't have an account yet?{' '}
          <Link to="/signup" style={{ color: 'var(--primary-light)', fontWeight: 600 }} id="login-switch-signup">
            Create account
          </Link>
        </div>

      </div>
    </div>
  );
}
