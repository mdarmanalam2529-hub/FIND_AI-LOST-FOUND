import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, KeyRound, ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';

export default function ChangePassword() {
  const { user, changePassword, signOut } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const regNumber = user?.user_metadata?.registration_number;
  const isInitialPasswordInUse = user?.user_metadata?.initial_password_used === true;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!formData.newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (formData.newPassword === formData.currentPassword) {
      setError('New password cannot be identical to your current password.');
      return;
    }

    if (regNumber && formData.newPassword.trim().toUpperCase() === regNumber.trim().toUpperCase()) {
      setError('New password cannot be your university registration number. Please choose a strong, unique password.');
      return;
    }

    setLoading(true);

    try {
      await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });

      setSuccess(true);
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutAndTest = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 140px)' }}>
      <HeroAnimatedBackground variant="ambient" />
      <div className="container" style={{ position: 'relative', zIndex: 1, padding: '4rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 160px)' }}>
        <div className="glass-card form-entrance auth-card" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem', background: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div className="brand-icon-wrap" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>
              <KeyRound size={24} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>Account Security</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Update your account password to secure your reports and personal data
            </p>
          </div>

          {/* Success Screen */}
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  background: 'var(--found-subtle, #f0fdf4)',
                  border: '1px solid var(--found-border, #bbf7d0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  textAlign: 'left',
                  display: 'flex',
                  gap: '0.85rem',
                  color: 'var(--found-accent, #166534)',
                }}
                id="change-password-success-notice"
              >
                <CheckCircle2 size={26} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>
                  <strong>Password changed successfully!</strong>
                  <p style={{ marginTop: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                    Your new password is now active. Your previous password (including your registration number, if previously used) has been deactivated and can no longer be used to sign in.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <Link to="/dashboard" className="btn btn-primary" style={{ width: '100%' }} id="btn-return-dashboard">
                  Continue to Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOutAndTest}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                  id="btn-signout-test"
                >
                  Sign Out & Sign In with New Password
                </button>
              </div>
            </div>
          ) : (
            /* Change Password Form */
            <form onSubmit={handleSubmit} noValidate id="change-password-form">
              {/* Error Banner */}
              {error && (
                <div
                  style={{
                    background: 'var(--lost-subtle, #fef2f2)',
                    border: '1px solid var(--lost-border, #fecaca)',
                    borderRadius: 'var(--radius-md, 8px)',
                    padding: '0.85rem 1rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    color: 'var(--lost-accent, #991b1b)',
                    fontSize: '0.88rem',
                  }}
                  id="change-password-error"
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Current Password Field */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="current-password">
                    Current Password
                  </label>
                  {isInitialPasswordInUse && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      (Default: Your Registration Number)
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="current-password"
                    name="currentPassword"
                    type={showCurrent ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter current password"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    disabled={loading}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  />
                  <Lock
                    size={18}
                    color="var(--text-dim)"
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label={showCurrent ? 'Hide password' : 'Show password'}
                    id="toggle-current-password"
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-password"
                    name="newPassword"
                    type={showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 6 characters (8+ recommended)"
                    value={formData.newPassword}
                    onChange={handleChange}
                    disabled={loading}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  />
                  <Lock
                    size={18}
                    color="var(--text-dim)"
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                    id="toggle-new-password"
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formData.newPassword && formData.newPassword.length < 6 && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--lost-accent)', marginTop: '0.25rem' }}>
                    Password must be at least 6 characters long.
                  </div>
                )}
              </div>

              {/* Confirm New Password Field */}
              <div className="form-group">
                <label className="form-label" htmlFor="confirm-new-password">
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirm-new-password"
                    name="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  />
                  <Lock
                    size={18}
                    color="var(--text-dim)"
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    id="toggle-confirm-new-password"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--lost-accent)', marginTop: '0.25rem' }}>
                    Passwords do not match.
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                id="btn-update-password"
                disabled={loading}
                style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin" /> Updating Password...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} /> Update Password
                  </>
                )}
              </button>

              {/* Cancel / Back Link */}
              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <Link
                  to="/dashboard"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}
                  id="link-cancel-change-password"
                >
                  <ArrowLeft size={14} /> Back to Dashboard
                </Link>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

