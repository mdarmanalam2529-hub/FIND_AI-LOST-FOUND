import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminUser, isStaffOrAdminUser } from '../lib/roleHelpers';
import {
  Sparkles,
  LogIn,
  UserPlus,
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
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setAdminMenuOpen(false);
  }, [location.pathname, location.search]);

  const isPrivilegedStaff = isStaffOrAdminUser(user);
  const isPrivilegedAdmin = isAdminUser(user);
  const isAdminActive = location.pathname.startsWith('/admin');

  return (
    <header className="navbar" id="main-application-navbar">
      <div className="navbar-inner">
        {/* PHASE 4 - SECTION A: Left Navigation (flex-start) */}
        <div className="navbar-left">
          {/* FindAI Brand Logo */}
          <Link to="/" className="brand-logo" onClick={closeMenu} id="nav-brand-logo">
            <div className="brand-icon-wrap">
              <Sparkles size={18} color="#ffffff" />
            </div>
            <span>
              Find<span className="gradient-text">AI</span>
            </span>
          </Link>

          {/* Primary Navigation Links */}
          <nav className="navbar-primary-nav" aria-label="Main Navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              id="nav-link-home"
            >
              Home
            </NavLink>

            {user && (
              <NavLink
                to={isPrivilegedStaff ? '/admin/dashboard' : '/dashboard'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                id="nav-link-dashboard"
              >
                Dashboard
              </NavLink>
            )}

            {/* Admin Panel Dropdown (preserved for authorized staff/admin) */}
            {(isPrivilegedStaff || isPrivilegedAdmin) && (
              <div ref={adminDropdownRef} className="admin-dropdown-container">
                <button
                  type="button"
                  onClick={() => setAdminMenuOpen((prev) => !prev)}
                  className={`admin-dropdown-btn ${isAdminActive ? 'active' : ''}`}
                  id="nav-link-admin-panel"
                  aria-haspopup="true"
                  aria-expanded={adminMenuOpen}
                >
                  <ShieldCheck size={16} />
                  <span>Admin Panel</span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: adminMenuOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.18s ease',
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
                        <GraduationCap size={15} color="var(--primary)" />
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
                        <Users size={15} color="var(--ai-violet, #8b5cf6)" />
                        <span>Manage Admins</span>
                      </Link>
                    )}

                    <Link
                      to="/admin/reports"
                      onClick={closeMenu}
                      className="admin-dropdown-item"
                      id="nav-admin-link-reports"
                    >
                      <FileText size={15} color="var(--warning-accent)" />
                      <span>Manage Reports</span>
                    </Link>

                    <Link
                      to="/admin/claims"
                      onClick={closeMenu}
                      className="admin-dropdown-item"
                      id="nav-admin-link-claims"
                    >
                      <ShieldAlert size={15} color="var(--found-accent)" />
                      <span>Manage Claims</span>
                    </Link>

                    <Link
                      to="/admin/handovers"
                      onClick={closeMenu}
                      className="admin-dropdown-item"
                      id="nav-admin-link-handovers"
                    >
                      <Handshake size={15} color="var(--cyan-glow, #06b6d4)" />
                      <span>Manage Handovers</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Right Navigation: Actions / Notifications aligned to the far right */}
        <div className="navbar-right">
          {user ? (
            <div className="navbar-user-controls">
              {/* Notifications Icon (User profile avatar removed from top navbar) */}
              <NotificationsDropdown />
            </div>
          ) : (
            <div className="navbar-auth-controls">
              <Link to="/login" className="btn btn-secondary btn-sm" id="desktop-nav-login">
                <LogIn size={15} />
                <span>Login</span>
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm" id="desktop-nav-signup">
                <UserPlus size={15} />
                <span>Sign Up</span>
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            className="mobile-toggle"
            onClick={toggleMenu}
            aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
            id="nav-mobile-toggle"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <nav className="navbar-mobile-drawer" aria-label="Mobile Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Home
          </NavLink>

          {user && (
            <NavLink
              to={isPrivilegedStaff ? '/admin/dashboard' : '/dashboard'}
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={closeMenu}
            >
              Dashboard
            </NavLink>
          )}

          {/* Admin links on mobile */}
          {(isPrivilegedStaff || isPrivilegedAdmin) && (
            <div className="mobile-admin-block">
              <span className="mobile-admin-heading">Admin Console</span>
              <Link to="/admin/dashboard" onClick={closeMenu} className="mobile-subnav-link">
                <LayoutDashboard size={15} />
                <span>Dashboard</span>
              </Link>
              {isPrivilegedAdmin && (
                <Link to="/admin/students" onClick={closeMenu} className="mobile-subnav-link">
                  <GraduationCap size={15} />
                  <span>Student Registry</span>
                </Link>
              )}
              {isPrivilegedAdmin && (
                <Link to="/admin/management" onClick={closeMenu} className="mobile-subnav-link">
                  <Users size={15} />
                  <span>Manage Admins</span>
                </Link>
              )}
              <Link to="/admin/reports" onClick={closeMenu} className="mobile-subnav-link">
                <FileText size={15} />
                <span>Reports Moderation</span>
              </Link>
              <Link to="/admin/claims" onClick={closeMenu} className="mobile-subnav-link">
                <ShieldAlert size={15} />
                <span>Claims Review</span>
              </Link>
              <Link to="/admin/handovers" onClick={closeMenu} className="mobile-subnav-link">
                <Handshake size={15} />
                <span>Handovers</span>
              </Link>
            </div>
          )}

          {!user && (
            <div className="mobile-auth-actions">
              <Link
                to="/login"
                className="btn btn-secondary btn-sm"
                onClick={closeMenu}
                id="mobile-nav-login"
              >
                <LogIn size={15} /> Login
              </Link>
              <Link
                to="/signup"
                className="btn btn-primary btn-sm"
                onClick={closeMenu}
                id="mobile-nav-signup"
              >
                <UserPlus size={15} /> Sign Up
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
