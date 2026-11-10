import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Search,
  UploadCloud,
  FileText,
  Sparkles,
  ShieldCheck,
  Handshake,
  User,
  LogOut,
  GraduationCap,
  Users,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { isAdminUser, isStaffOrAdminUser, getUserRoleTitle } from '../../lib/roleHelpers';

export default function AppSidebar({
  mode = 'student', // 'student' | 'admin'
  activeTab,
  onTabChange,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Persistent collapse state with localStorage fallback
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    try {
      return localStorage.getItem('findai-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Synchronize internal state if controlled from props
  const isControlled = controlledCollapsed !== undefined;
  const effectiveCollapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    const nextState = !effectiveCollapsed;
    if (!isControlled) {
      setInternalCollapsed(nextState);
    }
    try {
      localStorage.setItem('findai-sidebar-collapsed', String(nextState));
    } catch {
      // Ignore storage errors
    }
    if (onToggleCollapse) {
      onToggleCollapse(nextState);
    }
  };

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname, location.search]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  const isAdmin = isAdminUser(user);
  const isStaff = isStaffOrAdminUser(user);
  const roleTitle = getUserRoleTitle(user);

  const handleSignOut = async () => {
    try {
      await signOut();
      setMobileDrawerOpen(false);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const studentNavSections = [
    {
      title: 'Workspace',
      items: [
        { id: 'my-reports', label: 'My Reports', icon: LayoutDashboard, isTab: true, tabKey: 'my-reports', href: '/dashboard?tab=my-reports' },
        { id: 'report-lost', label: 'Report Lost', icon: Search, href: '/report-lost', badge: 'Lost' },
        { id: 'report-found', label: 'Report Found', icon: UploadCloud, href: '/report-found', badge: 'Found' },
      ],
    },
    {
      title: 'Discovery',
      items: [
        { id: 'ai-matches', label: 'AI Matches', icon: Sparkles, isTab: true, tabKey: 'ai-matches', highlight: true, href: '/dashboard?tab=ai-matches' },
        { id: 'community', label: 'Community', icon: Users, href: '/community' },
      ],
    },
    {
      title: 'Recovery',
      items: [
        { id: 'claims', label: 'My Claims', icon: ShieldCheck, isTab: true, tabKey: 'claims', subtab: 'outgoing', href: '/dashboard?tab=claims&subtab=outgoing' },
        { id: 'handovers', label: 'Handovers', icon: Handshake, isTab: true, tabKey: 'claims', subtab: 'incoming', href: '/dashboard?tab=claims&subtab=incoming' },
      ],
    },
  ];

  const adminNavSections = [
    {
      title: 'Operations',
      items: [
        { id: 'admin-overview', label: 'Admin Overview', icon: LayoutDashboard, href: '/admin/dashboard' },
        { id: 'admin-reports', label: 'Report Moderation', icon: FileText, href: '/admin/reports' },
        { id: 'admin-claims', label: 'Claims Management', icon: ShieldCheck, href: '/admin/claims' },
        { id: 'admin-handovers', label: 'Handover Operations', icon: Handshake, href: '/admin/handovers' },
        { id: 'admin-incidents', label: 'Incident Investigation', icon: ShieldAlert, href: '/admin/incidents' },
      ],
    },
    ...(isAdmin ? [
      {
        title: 'Administration',
        items: [
          { id: 'admin-students', label: 'Student Registry', icon: GraduationCap, href: '/admin/students' },
          { id: 'admin-import', label: 'Import Students', icon: UploadCloud, href: '/admin/import-students' },
          { id: 'admin-users', label: 'Staff & Users', icon: Users, href: '/admin/users' },
        ],
      },
    ] : []),
  ];

  const effectiveMode = (isStaff || mode === 'admin' || location.pathname.startsWith('/admin')) ? 'admin' : 'student';
  const sections = effectiveMode === 'admin' ? adminNavSections : studentNavSections;
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const currentSubTab = new URLSearchParams(location.search).get('subtab') || 'incoming';

  return (
    <>
      {/* Mobile Workspace Bar Trigger */}
      <div className="workspace-mobile-bar" id="workspace-mobile-bar">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="workspace-mobile-toggle"
          aria-label="Open Workspace Navigation"
        >
          <Menu size={20} />
          <span>Workspace Menu</span>
        </button>
        <span className="workspace-mobile-mode-badge">
          {effectiveMode === 'admin' ? 'Admin Console' : 'Student Hub'}
        </span>
      </div>

      {/* Backdrop for Mobile Drawer */}
      {mobileDrawerOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Persistent Workspace Sidebar Shell */}
      <aside
        className={`app-sidebar ${effectiveCollapsed ? 'is-collapsed' : ''} sidebar-${effectiveMode} ${mobileDrawerOpen ? 'mobile-drawer-open' : ''}`}
        id="app-workspace-sidebar"
      >
        {/* Brand Header & Toggle (Logo removed, text label preserved) */}
        <div className="sidebar-header">
          <NavLink to="/" className="sidebar-brand" title="FindAI">
            {!effectiveCollapsed ? (
              <div className="sidebar-brand-text">
                <span className="brand-name">Find<span className="gradient-text">AI</span></span>
                <span className="brand-badge">{effectiveMode === 'admin' ? 'Console' : 'Campus'}</span>
              </div>
            ) : (
              <span className="brand-name brand-name-collapsed">
                F<span className="gradient-text">AI</span>
              </span>
            )}
          </NavLink>

          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="sidebar-mobile-close-btn"
            aria-label="Close workspace drawer"
          >
            <X size={18} />
          </button>

          {/* Desktop Collapse / Expand Arrow Button */}
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="sidebar-toggle-btn"
            aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {effectiveCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Navigation Links - Independently scrollable */}
        <div className="sidebar-nav-section">
          {sections.map((section, sIdx) => (
            <div
              key={section.title || sIdx}
              className="sidebar-section-group"
              style={{ marginBottom: sIdx < sections.length - 1 ? '0.75rem' : 0 }}
            >
              <span className="sidebar-nav-title">
                {!effectiveCollapsed ? section.title : '•••'}
              </span>
              <nav className="sidebar-nav">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isClaimsItem = item.tabKey === 'claims';
                  const isOnDashboard = location.pathname === '/dashboard' || location.pathname.startsWith('/student');
                  const isActiveTab = isOnDashboard && (isClaimsItem
                    ? activeTab === 'claims' && (item.subtab ? item.subtab === currentSubTab : true)
                    : activeTab === item.tabKey);

                  if (item.isTab && onTabChange && isOnDashboard) {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onTabChange(item.tabKey, item.subtab);
                          setMobileDrawerOpen(false);
                        }}
                        className={`sidebar-link ${isActiveTab ? 'is-active' : ''} ${item.highlight ? 'is-highlight' : ''}`}
                        title={item.label}
                        id={`sidebar-link-${item.id}`}
                      >
                        <Icon size={18} className="sidebar-link-icon" />
                        {!effectiveCollapsed && <span className="sidebar-link-text">{item.label}</span>}
                        {!effectiveCollapsed && item.badge && <span className="sidebar-link-badge">{item.badge}</span>}
                      </button>
                    );
                  }

                  return (
                    <NavLink
                      key={item.id}
                      to={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `sidebar-link ${isActive || (item.id === 'community' && location.pathname === '/community') ? 'is-active' : ''} ${item.highlight ? 'is-highlight' : ''}`
                      }
                      title={item.label}
                      id={`sidebar-link-${item.id}`}
                    >
                      <Icon size={18} className="sidebar-link-icon" />
                      {!effectiveCollapsed && <span className="sidebar-link-text">{item.label}</span>}
                      {!effectiveCollapsed && item.badge && <span className="sidebar-link-badge">{item.badge}</span>}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Sidebar Footer - Always anchored at the bottom */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card" title={displayName}>
            <div className="user-avatar">
              <User size={16} />
            </div>
            {!effectiveCollapsed && (
              <div className="user-details">
                <span className="user-name">
                  {displayName}
                </span>
                <span className="user-role">{roleTitle || (effectiveMode === 'admin' ? 'Administrator' : 'Verified Student')}</span>
              </div>
            )}
          </div>

          {/* Phase 5 Requirement: Sign Out button exists ONLY in Workspace sidebar anchored at the bottom */}
          <button
            type="button"
            onClick={handleSignOut}
            className="sidebar-logout-btn"
            title="Sign out of FindAI"
            aria-label="Sign out of FindAI"
            id="sidebar-signout-btn"
          >
            <LogOut size={16} className="sidebar-logout-icon" />
            {!effectiveCollapsed && <span className="sidebar-logout-text">Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
