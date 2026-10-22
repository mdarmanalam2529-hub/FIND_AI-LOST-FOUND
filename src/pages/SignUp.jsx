import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export default function SignUp() {
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const validate = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter at least 2 characters.';
    }

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

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms of Service & Privacy Policy.';
    }

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

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
      const data = await signUp({
        email: formData.email.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
      });

      // Check whether Supabase requires email verification (session is null if email confirmation is enabled)
      if (data?.user && !data?.session) {
        setNeedsEmailConfirmation(true);
        setSignupComplete(true);
      } else if (data?.session) {
        // Immediate login if email confirmation is turned off in Supabase project settings
        navigate('/dashboard', { replace: true });
      } else {
        setSignupComplete(true);
      }
    } catch (err) {
      console.error('[SignUp] Registration error:', err);
      let message = err.message || 'Failed to create account. Please try again.';
      if (message.includes('User already registered')) {
        message = 'An account with this email address already exists. Please sign in instead.';
      }
      setServerError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 160px)' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="brand-icon-wrap" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>
            <UserPlus size={24} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>Create Account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Join FindAI to report items and receive instant match alerts
          </p>
        </div>

        {/* Successful Registration Screen / Email Confirmation Notice */}
        {signupComplete ? (
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{ 
                background: 'rgba(16, 185, 129, 0.15)', 
                border: '1px solid rgba(16, 185, 129, 0.3)', 
                borderRadius: 'var(--radius-md)', 
                padding: '1.5rem', 
                marginBottom: '1.5rem',
                textAlign: 'left',
                display: 'flex',
                gap: '0.85rem',
                color: '#34d399'
              }}
              id="signup-verification-notice"
            >
              <CheckCircle2 size={26} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>
                <strong>Account created successfully!</strong>
                <p style={{ marginTop: '0.4rem', color: '#e2e8f0', fontSize: '0.88rem' }}>
                  {needsEmailConfirmation ? (
                    <>
                      We sent a verification email to <strong>{formData.email}</strong>. Please check your inbox (and spam folder) and click the confirmation link to activate your account.
                    </>
                  ) : (
                    <>Your account is now ready. You can sign in immediately.</>
                  )}
                </p>
              </div>
            </div>

            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
              Proceed to Sign In <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          /* Sign Up Form */
          <form onSubmit={handleSubmit} noValidate id="signup-form">
            {/* Server Error Banner */}
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
                id="signup-server-error"
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{serverError}</span>
              </div>
            )}

            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-name"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Alex Rivera"
                  value={formData.fullName}
                  onChange={handleChange}
                  disabled={loading}
                  className={`form-input ${errors.fullName ? 'is-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                />
                <User 
                  size={18} 
                  color="var(--text-dim)" 
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} 
                />
              </div>
              {errors.fullName && (
                <div className="form-error" id="signup-name-error">
                  <AlertCircle size={14} /> {errors.fullName}
                </div>
              )}
            </div>

            {/* Email Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-email"
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
                <div className="form-error" id="signup-email-error">
                  <AlertCircle size={14} /> {errors.email}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
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
                  id="signup-toggle-password"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <div className="form-error" id="signup-password-error">
                  <AlertCircle size={14} /> {errors.password}
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm-password">
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                  className={`form-input ${errors.confirmPassword ? 'is-invalid' : ''}`}
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
                  id="signup-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <div className="form-error" id="signup-confirm-password-error">
                  <AlertCircle size={14} /> {errors.confirmPassword}
                </div>
              )}
            </div>

            {/* Terms Agreement Checkbox */}
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  disabled={loading}
                  id="signup-terms-checkbox"
                  style={{ marginTop: '3px', accentColor: 'var(--primary)' }}
                />
                <span>
                  I agree to the <a href="#terms" style={{ color: 'var(--primary-light)' }} onClick={(e) => e.preventDefault()}>Terms of Service</a> and <a href="#privacy" style={{ color: 'var(--primary-light)' }} onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
                </span>
              </label>
              {errors.agreeTerms && (
                <div className="form-error" id="signup-terms-error">
                  <AlertCircle size={14} /> {errors.agreeTerms}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="btn btn-primary" 
              id="signup-submit-btn"
              disabled={loading}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.85rem', opacity: loading ? 0.8 : 1 }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" /> Registering Account...
                </>
              ) : (
                <>
                  <UserPlus size={18} /> Create Account
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer switch to Login */}
        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary-light)', fontWeight: 600 }} id="signup-switch-login">
            Sign in
          </Link>
        </div>

      </div>
    </div>
  );
}
