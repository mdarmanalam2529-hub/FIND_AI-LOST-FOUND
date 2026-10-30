import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, User, AlertCircle, CheckCircle2, Loader2, ArrowRight, GraduationCap } from 'lucide-react';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';

export default function SignUp() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    registrationNumber: '',
    fullName: '',
    agreeTerms: false,
  });

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const validate = () => {
    const newErrors = {};

    if (!formData.registrationNumber.trim()) {
      newErrors.registrationNumber = 'University registration number is required.';
    } else if (formData.registrationNumber.trim().length < 3) {
      newErrors.registrationNumber = 'Please enter at least 3 characters.';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter at least 2 characters.';
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
      // Secure server-side student registration with registry verification
      const response = await fetch('/api/auth/register-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registrationNumber: formData.registrationNumber.trim(),
          fullName: formData.fullName.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setServerError(data.message || 'Registration could not be completed with university records.');
        return;
      }

      setSignupComplete(true);
    } catch {
      setServerError('Unable to connect to the registration service. Please verify your connection or try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 140px)' }}>
      <HeroAnimatedBackground variant="ambient" />
      <div className="container" style={{ position: 'relative', zIndex: 1, padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 160px)' }}>
        <div className="glass-card form-entrance auth-card" style={{ width: '100%', maxWidth: '460px', padding: '2.5rem', background: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        
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

        {/* Successful Registration Screen */}
        {signupComplete ? (
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{ 
                background: 'var(--found-subtle)', 
                border: '1px solid var(--found-border)', 
                borderRadius: 'var(--radius-md)', 
                padding: '1.5rem', 
                marginBottom: '1.5rem',
                textAlign: 'left',
                display: 'flex',
                gap: '0.85rem',
                color: 'var(--found-accent)'
              }}
              id="signup-verification-notice"
            >
              <CheckCircle2 size={26} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>
                <strong>Account created successfully!</strong>
                <p style={{ marginTop: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Your account is active. You can now sign in using your registration number <strong>{formData.registrationNumber.trim().toUpperCase()}</strong> as your password.
                </p>
              </div>
            </div>

            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }} id="signup-proceed-login-btn">
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
                  background: 'var(--lost-subtle)', 
                  border: '1px solid var(--lost-border)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '0.85rem 1rem', 
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  color: 'var(--lost-accent)',
                  fontSize: '0.88rem'
                }}
                id="signup-server-error"
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{serverError}</span>
              </div>
            )}

            {/* University Registration Number */}
            <div className="form-group">
              <label className="form-label" htmlFor="signup-reg-number">
                University Registration Number
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-reg-number"
                  name="registrationNumber"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. 251FA04G44"
                  value={formData.registrationNumber}
                  onChange={handleChange}
                  disabled={loading}
                  className={`form-input ${errors.registrationNumber ? 'is-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem', textTransform: 'uppercase' }}
                />
                <GraduationCap 
                  size={18} 
                  color="var(--text-dim)" 
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} 
                />
              </div>
              {errors.registrationNumber && (
                <div className="form-error" id="signup-reg-number-error">
                  <AlertCircle size={14} /> {errors.registrationNumber}
                </div>
              )}
            </div>

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

            {/* Terms Agreement Checkbox */}
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
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
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }} id="signup-switch-login">
            Sign In
          </Link>
        </div>

      </div>
    </div>
  </div>
  );
}
