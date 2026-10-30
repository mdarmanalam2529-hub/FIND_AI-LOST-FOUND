import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminUser, isStaffOrAdminUser, isPrimaryAdminUser } from '../lib/roleHelpers';
import {
  Sparkles,
  LogIn,
  UserPlus,
  LogOut,
  User,
  Menu,
  X,
  ShieldCheck,
  ChevronDown,
  LayoutDashboard,
  GraduationCap,
  Users,
  FileText,
  ShieldAlert,
  Handshake,
} from 'lucide-react';
import NotificationsDropdown from './NotificationsDropdown';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const adminDropdownRef = useRef(null);

  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMenu = () => {
    setMobileMenuOpen(false);
    setAdminMenuOpen(false);
  };

  // Close admin dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target)) {
        setAdminMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      closeMenu();
      navigate('/login');
    } catch (err) {
      console.error('[Navbar] Logout error:', err);
      alert(err.message || 'Failed to sign out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const isPrivilegedStaff = isStaffOrAdminUser(user);
  const isPrivilegedAdmin = isAdminUser(user);
  const isPrimaryAdmin = isPrimaryAdminUser(user);
  const isAdminActive = location.pathname.startsWith('/admin');

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
            to="/dashboard"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
            id="nav-link-dashboard"
          >
            Dashboard
          </NavLink>

          {/* Admin Panel Dropdown */}
          {(isPrivilegedStaff || isPrivilegedAdmin) && (
            <div
              ref={adminDropdownRef}
              className="admin-dropdown-container"
            >
              <button
                type="button"
                onClick={() => setAdminMenuOpen((prev) => !prev)}
                className={`admin-dropdown-btn ${isAdminActive ? 'active' : ''}`}
                id="nav-link-admin-panel"
                aria-haspopup="true"
                aria-expanded={adminMenuOpen}
              >
                <ShieldCheck size={16} color="#8b5cf6" />
                <span>Admin Panel</span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: adminMenuOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>

              {adminMenuOpen && (
                <div className="admin-dropdown-menu">
                  <Link
                    to="/admin/dashboard"
                    onClick={closeMenu}
                    className="admin-dropdown-item"
                    id="nav-admin-link-dashboard"
                  >
                    <LayoutDashboard size={15} color="var(--primary)" />
                    <span>Admin Dashboard</span>
                  </Link>

                  {isPrivilegedAdmin && (
                    <Link
                      to="/admin/students"
                      onClick={closeMenu}
                      className="admin-dropdown-item"
                      id="nav-admin-link-students"
                    >
                      <GraduationCap size={15} color="#3b82f6" />
                      <span>Manage Students</span>
                    </Link>
                  )}

                  {isPrivilegedAdmin && (
                    <Link
                      to="/admin/management"
                      onClick={closeMenu}
                      className="admin-dropdown-item"
                      id="nav-admin-link-management"
                    >
                      <Users size={15} color="#8b5cf6" />
                      <span>Manage Admins</span>
                    </Link>
                  )}

                  <Link
                    to="/admin/reports"
                    onClick={closeMenu}
                    className="admin-dropdown-item"
                    id="nav-admin-link-reports"
                  >
                    <FileText size={15} color="#eab308" />
                    <span>Manage Reports</span>
                  </Link>

                  <Link
                    to="/admin/claims"
                    onClick={closeMenu}
                    className="admin-dropdown-item"
                    id="nav-admin-link-claims"
                  >
                    <ShieldAlert size={15} color="#10b981" />
                    <span>Manage Claims</span>
                  </Link>

                  <Link
                    to="/admin/handovers"
                    onClick={closeMenu}
                    className="admin-dropdown-item"
                    id="nav-admin-link-handovers"
                  >
                    <Handshake size={15} color="#06b6d4" />
                    <span>Manage Handovers</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Mobile Only Action Buttons */}
          {mobileMenuOpen && (
            <div className="mobile-actions">
              {user ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <User size={16} color="var(--primary)" />
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{displayName}</span>
                      {isPrimaryAdmin ? (
                        <span style={{ background: '#7c3aed', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px' }}>Primary Admin</span>
                      ) : isPrivilegedAdmin ? (
                        <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px' }}>Admin</span>
                      ) : isPrivilegedStaff ? (
                        <span style={{ background: '#10b981', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px' }}>Staff</span>
                      ) : null}
                    </div>
                    <NotificationsDropdown />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    id="mobile-nav-logout"
                    style={{ width: '100%', justifyContent: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <NotificationsDropdown />
              <Link 
                to="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  fontWeight: 500,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                id="desktop-user-pill"
              >
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: isPrimaryAdmin ? '#7c3aed' : 'var(--primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
                {isPrimaryAdmin ? (
                  <span style={{ background: '#7c3aed', color: '#fff', fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>Primary Admin</span>
                ) : isPrivilegedAdmin ? (
                  <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>Admin</span>
                ) : isPrivilegedStaff ? (
                  <span style={{ background: '#10b981', color: '#fff', fontSize: '0.68rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>Staff</span>
                ) : null}
              </Link>

              <button 
                type="button" 
                onClick={handleLogout} 
                className="btn btn-secondary btn-sm" 
                disabled={isLoggingOut}
                id="desktop-nav-logout"
                title="Sign out of FindAI"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '0.42rem 0.85rem',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  transition: 'all 0.15s ease',
                }}
              >
                <LogOut size={16} />
                <span>{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
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
