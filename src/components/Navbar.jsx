import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, 
  LogIn, 
  UserPlus, 
  LogOut, 
  User, 
  Menu, 
  X, 
  LayoutDashboard,
  ShieldCheck
} from 'lucide-react';
import NotificationsDropdown from './NotificationsDropdown';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMenu = () => setMobileMenuOpen(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      closeMenu();
      navigate('/login');
    } catch (err) {
      console.error('[Navbar] Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        {/* Brand Logo */}
        <Link to="/" className="brand-logo" onClick={closeMenu} id="nav-brand-logo">
          <div className="brand-icon-wrap">
            <Sparkles size={20} color="#ffffff" />
          </div>
          <span>Find<span className="gradient-text">AI</span></span>
        </Link>

        {/* Mobile Hamburger Toggle */}
        <button
          className="mobile-toggle"
          onClick={toggleMenu}
          aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          id="nav-mobile-toggle"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Navigation Links */}
        <nav className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
            id="nav-link-home"
          >
            Home
          </NavLink>

          <NavLink
            to="/report-lost"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
            id="nav-link-report-lost"
          >
            Report Lost Item
          </NavLink>

          <NavLink
            to="/report-found"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
            id="nav-link-report-found"
          >
            Report Found Item
          </NavLink>

          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
            id="nav-link-dashboard"
          >
            Dashboard
          </NavLink>

          {/* Mobile Only Action Buttons */}
          {mobileMenuOpen && (
            <div className="mobile-actions">
              {user ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <User size={16} color="var(--primary)" />
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{displayName}</span>
                    </div>
                    <NotificationsDropdown />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    id="mobile-nav-logout"
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                  >
                    <LogOut size={16} /> {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="btn btn-secondary btn-sm"
                    onClick={closeMenu}
                    id="mobile-nav-login"
                  >
                    <LogIn size={16} /> Login
                  </Link>
                  <Link
                    to="/signup"
                    className="btn btn-primary btn-sm"
                    onClick={closeMenu}
                    id="mobile-nav-signup"
                  >
                    <UserPlus size={16} /> Sign Up
                  </Link>
                </>
              )}
            </div>
          )}
        </nav>

        {/* Desktop Action Buttons */}
        <div className="nav-actions">
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <NotificationsDropdown />
              <Link 
                to="/dashboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  fontWeight: 500,
                }}
                id="desktop-user-pill"
              >
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
              </Link>

              <button 
                type="button" 
                onClick={handleLogout} 
                className="btn btn-secondary btn-sm" 
                disabled={isLoggingOut}
                id="desktop-nav-logout"
                title="Sign out of FindAI"
              >
                <LogOut size={16} /> {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary btn-sm" id="desktop-nav-login">
                <LogIn size={16} /> Login
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm" id="desktop-nav-signup">
                <UserPlus size={16} /> Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
