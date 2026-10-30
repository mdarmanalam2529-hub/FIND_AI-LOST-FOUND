import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Lock, Eye, EyeOff, AlertCircle, Loader2, GraduationCap, Mail, Shield } from 'lucide-react';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';

export default function Login() {
  const { signInWithRegistrationNumber, signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loginMode, setLoginMode] = useState('student'); // 'student' | 'staff'
  const [formData, setFormData] = useState({
    registrationNumber: '',
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

    if (loginMode === 'student') {
      if (!formData.registrationNumber.trim()) {
        newErrors.registrationNumber = 'University registration number is required.';
      } else if (formData.registrationNumber.trim().length < 3) {
        newErrors.registrationNumber = 'Please enter at least 3 characters.';
      }
      // In student mode, registration number is the password (optional to retype)
      if (formData.password && formData.password.length < 3) {
        newErrors.password = 'Password must be at least 3 characters.';
      }
    } else {
      if (!formData.email.trim()) {
        newErrors.email = 'Staff or administrator email is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        newErrors.email = 'Please enter a valid email address.';
      }

      if (!formData.password) {
        newErrors.password = 'Password is required.';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters.';
      }
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

  const handleTabChange = (mode) => {
    setLoginMode(mode);
    setErrors({});
    setServerError(null);
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
      if (loginMode === 'student') {
        const studentReg = formData.registrationNumber.trim().toUpperCase();
        const studentPassword = (formData.password && formData.password.trim())
          ? formData.password.trim()
          : studentReg;
        await signInWithRegistrationNumber(
          studentReg,
          studentPassword
        );
      } else {
        await signIn({
          email: formData.email.trim(),
          password: formData.password,
        });
      }

      // Redirect to intended route or dashboard
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      setServerError(err.message || 'An error occurred during sign in.');
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
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-icon-wrap" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>
            <LogIn size={24} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>Welcome Back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {loginMode === 'student' 
              ? 'Sign in to track your reported lost or found items'
              : 'Sign in with administrative or staff credentials'}
          </p>
        </div>

        {/* Dual Login Mode Tabs */}
        <div 
          role="tablist"
          aria-label="Login Mode"
          style={{ 
            display: 'flex', 
            background: 'var(--bg-subtle, #f1f5f9)', 
            padding: '0.25rem', 
            borderRadius: 'var(--radius-lg, 12px)', 
            marginBottom: '1.75rem',
            gap: '0.25rem',
            border: '1px solid var(--border-subtle, rgba(226, 232, 240, 0.8))'
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={loginMode === 'student'}
            id="login-tab-student"
            onClick={() => handleTabChange('student')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.75rem',
              borderRadius: 'var(--radius-md, 8px)',
              border: 'none',
              background: loginMode === 'student' ? '#ffffff' : 'transparent',
              color: loginMode === 'student' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
              fontWeight: loginMode === 'student' ? 600 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: loginMode === 'student' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <GraduationCap size={17} />
            <span>Student Login</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={loginMode === 'staff'}
            id="login-tab-staff"
            onClick={() => handleTabChange('staff')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.75rem',
              borderRadius: 'var(--radius-md, 8px)',
              border: 'none',
              background: loginMode === 'staff' ? '#ffffff' : 'transparent',
              color: loginMode === 'staff' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
              fontWeight: loginMode === 'staff' ? 600 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: loginMode === 'staff' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Shield size={17} />
            <span>Staff/Admin Login</span>
          </button>
        </div>

        {/* Redirect notice if redirected by ProtectedRoute */}
        {redirectMessage && (
          <div 
            style={{ 
              background: 'var(--warning-subtle)', 
              border: '1px solid var(--warning-border)', 
              borderRadius: 'var(--radius-md)', 
              padding: '0.75rem 1rem', 
              marginBottom: '1.25rem',
              color: 'var(--warning-accent)',
              fontSize: '0.86rem',
              fontWeight: 500,
            }}
          >
            {redirectMessage}
          </div>
        )}

        {/* Server error banner */}
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
            id="login-server-error"
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{serverError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate id="login-form">
          {loginMode === 'student' ? (
            /* University Registration Number */
            <div className="form-group">
              <label className="form-label" htmlFor="login-reg-number">
                University Registration Number
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-reg-number"
                  name="registrationNumber"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. 23CSE101"
                  value={formData.registrationNumber}
                  onChange={handleChange}
                  disabled={loading}
                  className={`form-input ${errors.registrationNumber ? 'is-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem', textTransform: 'uppercase' }}
                />
                <GraduationCap 
                  size={18} 
                  color="var(--text-muted)" 
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} 
                />
              </div>
              {errors.registrationNumber && (
                <div className="form-error" id="login-reg-number-error">
                  <AlertCircle size={14} /> {errors.registrationNumber}
                </div>
              )}
            </div>
          ) : (
            /* Staff/Admin Email Address */
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">
                Staff / Admin Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. admin@university.edu"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  className={`form-input ${errors.email ? 'is-invalid' : ''}`}
                  style={{ paddingLeft: '2.5rem' }}
                />
                <Mail 
                  size={18} 
                  color="var(--text-muted)" 
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} 
                />
              </div>
              {errors.email && (
                <div className="form-error" id="login-email-error">
                  <AlertCircle size={14} /> {errors.email}
                </div>
              )}
            </div>
          )}

          {/* Password Field */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="login-password">
                {loginMode === 'student' ? 'Password (University Registration Number)' : 'Password'}
              </label>
              {loginMode === 'staff' && (
                <Link 
                  to="/forgot-password" 
                  style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 500 }} 
                  id="login-forgot-password"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={loginMode === 'student' ? 'Enter registration number' : '••••••••'}
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

        {/* Footer switch to SignUp or info */}
        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {loginMode === 'student' ? (
            <>
              Don't have an account yet?{' '}
              <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 600 }} id="login-switch-signup">
                Create account
              </Link>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-dim)' }}>
              Staff & administrator access is verified securely by the backend authentication server.
            </p>
          )}
        </div>

      </div>
    </div>
  </div>
  );
}
