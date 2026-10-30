import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminUser, isStaffOrAdminUser } from '../lib/roleHelpers';
import { adminHandoverService } from '../services/adminHandoverService';
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Eye,
  MapPin,
  Calendar,
  X,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  User,
} from 'lucide-react';

export default function AdminHandovers() {
  const { user, session, loading: authLoading } = useAuth();

  // Primary list state
  const [handovers, setHandovers] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmationFilter, setConfirmationFilter] = useState('all');
  const [flaggedFilter, setFlaggedFilter] = useState('all');

  // Detail inspection modal
  const [selectedHandover, setSelectedHandover] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Action dialog state (Suspend / Release hold)
  const [actionInProgress, setActionInProgress] = useState(false);
  const [activeActionModal, setActiveActionModal] = useState(null); // { action: 'suspend' | 'release_hold', handover }
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState(null);

  // User role
  const isFullAdmin = isAdminUser(user);
  const userRole = user?.app_metadata?.role || (
    isFullAdmin ? 'admin' : (isStaffOrAdminUser(user) ? 'staff' : 'viewer')
  );

  const showToast = (message) => {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 4500);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load handovers
  const loadHandovers = useCallback(async (pageNumber = 1) => {
    if (authLoading) return;
    if (!session?.access_token) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await adminHandoverService.fetchHandovers({
        page: pageNumber,
        limit: pagination.limit,
        status: statusFilter,
        confirmationStatus: confirmationFilter,
        isFlagged: flaggedFilter,
        search: debouncedSearch,
      });

      setHandovers(data.handovers || []);
      setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
      setStats(data.stats || null);
      setAccessDenied(false);
    } catch (err) {
      console.error('[AdminHandovers] Fetch error:', err);
      if (err.message.includes('Access denied') || err.message.includes('403')) {
        setAccessDenied(true);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authLoading, session, pagination.limit, statusFilter, confirmationFilter, flaggedFilter, debouncedSearch]);

  useEffect(() => {
    loadHandovers(1);
  }, [loadHandovers]);

  // Deep detail inspection
  const handleOpenDetail = async (handoverItem) => {
    setSelectedHandover(handoverItem);
    setDetailLoading(true);
    setDetailError(null);

    try {
      const detailed = await adminHandoverService.fetchHandover(handoverItem.id);
      setSelectedHandover(detailed);
    } catch (err) {
      console.error('[AdminHandovers] Detail error:', err);
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open action dialog
  const handleInitiateAction = (action, handover) => {
    const target = handover || selectedHandover;
    if (!target) return;

    if (!isFullAdmin && action === 'suspend') {
      alert('Suspending a campus handover requires full Administrator privileges.');
      return;
    }

    setActionReason('');
    setActionError(null);
    setActiveActionModal({ action, handover: target });
  };

  // Submit action
  const handleSubmitAction = async (e) => {
    if (e) e.preventDefault();
    if (!activeActionModal || actionInProgress) return;

    const { action, handover } = activeActionModal;

    if (!actionReason || actionReason.trim().length < 3) {
      setActionError('A valid documented reason of at least 3 characters is strictly required.');
      return;
    }

    setActionInProgress(true);
    setActionError(null);

    try {
      if (action === 'suspend') {
        await adminHandoverService.suspendHandover(handover.id, { reason: actionReason.trim() });
        showToast('Handover placed on administrative hold.');
      } else if (action === 'release_hold') {
        await adminHandoverService.releaseHold(handover.id, { reason: actionReason.trim() });
        showToast('Administrative hold cleared. Handover coordination resumed.');
      }

      setActiveActionModal(null);
      await loadHandovers(pagination.page);

      if (selectedHandover && selectedHandover.id === handover.id) {
        const refreshed = await adminHandoverService.fetchHandover(handover.id);
        setSelectedHandover(refreshed);
      }
    } catch (err) {
      console.error('[AdminHandovers] Submit action error:', err);
      setActionError(err.message || 'Action failed.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'proposed':
        return <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>Proposed</span>;
      case 'scheduled':
        return <span className="badge" style={{ background: '#ECFEFF', color: '#0891B2', border: '1px solid #A5F3FC' }}>Scheduled</span>;
      case 'handover_pending':
        return <span className="badge" style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>Awaiting Confirmation</span>;
      case 'completed':
        return <span className="badge" style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>Completed Return</span>;
      case 'suspended':
        return <span className="badge" style={{ background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3' }}>Suspended / Hold</span>;
      case 'cancelled':
        return <span className="badge" style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1' }}>Cancelled</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  if (accessDenied) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', maxWidth: '640px', margin: '0 auto' }}>
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', borderColor: 'var(--lost-border)' }}>
          <ShieldAlert size={48} color="var(--lost-accent)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Administrator Access Required</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            This page is restricted to authorized FindAI security administrators. Your account does not have permission to manage campus handovers.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/dashboard" className="btn btn-secondary btn-sm">Return to Dashboard</Link>
            <Link to="/login" className="btn btn-primary btn-sm">Switch Account</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
      {/* Toast Notification */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'var(--found-accent)',
            color: '#fff',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 500,
          }}
          id="admin-handovers-toast"
        >
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link to="/dashboard" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <span style={{ color: 'var(--border-muted)' }}>/</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>Administration</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <UserCheck size={26} color="var(--primary)" />
            Campus Handover Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Monitor physical handover meetings, track dual confirmations, enforce safety holds, and inspect return audits.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadHandovers(pagination.page)}
            disabled={loading}
            id="admin-handovers-refresh-btn"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
          id="admin-handovers-stats-bar"
        >
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Handovers</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.total}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#2563EB', textTransform: 'uppercase', fontWeight: 600 }}>Proposed</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563EB' }}>{stats.proposed}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#0891B2', textTransform: 'uppercase', fontWeight: 600 }}>Scheduled</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0891B2' }}>{stats.scheduled}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#7C3AED', textTransform: 'uppercase', fontWeight: 600 }}>Pending Confirm</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7C3AED' }}>{stats.handover_pending}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#059669', textTransform: 'uppercase', fontWeight: 600 }}>Completed</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>{stats.completed}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--lost-accent)', textTransform: 'uppercase', fontWeight: 600 }}>Suspended Holds</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--lost-accent)' }}>{stats.suspended}</div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search handovers by location, items, notes, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.4rem', paddingRight: searchQuery ? '2rem' : '0.75rem', height: '38px', fontSize: '0.88rem' }}
              id="admin-handovers-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '0.85rem', padding: '0 0.75rem' }}
              id="admin-handover-status-filter"
            >
              <option value="all">All Handover Statuses</option>
              <option value="proposed">Proposed</option>
              <option value="scheduled">Scheduled</option>
              <option value="handover_pending">Awaiting Confirmation</option>
              <option value="completed">Completed Return</option>
              <option value="suspended">Suspended / Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Confirmation State */}
            <select
              value={confirmationFilter}
              onChange={(e) => setConfirmationFilter(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '0.85rem', padding: '0 0.75rem' }}
              id="admin-handover-confirm-filter"
            >
              <option value="all">All Confirmation States</option>
              <option value="pending_both">Pending Both Parties</option>
              <option value="awaiting_claimant">Finder Confirmed (Awaiting Claimant)</option>
              <option value="awaiting_finder">Claimant Confirmed (Awaiting Finder)</option>
              <option value="completed">Both Confirmed (Finalized)</option>
            </select>

            {/* Flagged */}
            <select
              value={flaggedFilter}
              onChange={(e) => setFlaggedFilter(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '0.85rem', padding: '0 0.75rem' }}
              id="admin-handover-flag-filter"
            >
              <option value="all">All Flag Conditions</option>
              <option value="true">Flagged / Suspended Only</option>
              <option value="false">Unflagged Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && !loading && (
        <div
          className="glass-card"
          style={{
            padding: '1.25rem',
            marginBottom: '1.5rem',
            borderColor: 'var(--lost-border)',
            background: 'var(--lost-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
          id="admin-handovers-error-banner"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} color="var(--lost-accent)" />
            <span style={{ color: 'var(--lost-accent)', fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadHandovers(pagination.page)}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }} id="admin-handovers-loading">
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>Loading campus handovers...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && handovers.length === 0 && (
        <div
          className="glass-card"
          style={{ textAlign: 'center', padding: '3.5rem 1rem' }}
          id="admin-handovers-empty"
        >
          <FileText size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>No Handover Records Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
            There are currently no handovers matching the active filter criteria.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setConfirmationFilter('all');
              setFlaggedFilter('all');
            }}
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Handovers Grid */}
      {!loading && handovers.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
          id="admin-handovers-grid"
        >
          {handovers.map((h) => {
            const isSuspended = h.status === 'suspended' || h.is_flagged;
            const hasIncidents = h.has_incidents || (h.incidents && h.incidents.length > 0);

            return (
              <div
                key={h.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.15rem',
                  border: isSuspended
                    ? '1.5px solid var(--lost-border)'
                    : hasIncidents
                    ? '1.5px solid var(--warning-border)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                {/* Header: Status and Hold Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {renderStatusBadge(h.status)}
                    {isSuspended && (
                      <span className="badge" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', fontSize: '0.72rem' }}>
                        <AlertTriangle size={11} style={{ marginRight: '2px', display: 'inline' }} /> Hold Active
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    ID: {h.id.substring(0, 8)}…
                  </span>
                </div>

                {/* Items Connected */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Items Involved
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
                      <span className="badge badge-found" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>Found</span>
                      <strong style={{ color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.claim?.found_item?.title || 'Found Report'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
                      <span className="badge badge-lost" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>Lost</span>
                      <strong style={{ color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.claim?.lost_item?.title || 'Lost Report'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Meeting Logistics */}
                <div
                  style={{
                    background: 'var(--bg-surface-hover)',
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                    <MapPin size={13} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.proposed_location || 'Campus Security / Main Reception'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                    <Calendar size={13} style={{ flexShrink: 0 }} />
                    <span>Scheduled: {h.scheduled_at ? new Date(h.scheduled_at).toLocaleString() : 'Pending schedule agreement'}</span>
                  </div>
                </div>

                {/* Dual Confirmation Progress */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Dual Confirmation Progress
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.78rem' }}>
                    {/* Finder */}
                    <div
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background: h.finder_confirmed_at ? '#ECFDF5' : '#FFFBEB',
                        border: h.finder_confirmed_at ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                        color: h.finder_confirmed_at ? '#047857' : '#B45309',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      {h.finder_confirmed_at ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                      <span>Finder {h.finder_confirmed_at ? 'Confirmed' : 'Pending'}</span>
                    </div>

                    {/* Claimant */}
                    <div
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background: h.claimant_confirmed_at ? '#ECFDF5' : '#FFFBEB',
                        border: h.claimant_confirmed_at ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                        color: h.claimant_confirmed_at ? '#047857' : '#B45309',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      {h.claimant_confirmed_at ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                      <span>Claimant {h.claimant_confirmed_at ? 'Confirmed' : 'Pending'}</span>
                    </div>
                  </div>
                </div>

                {/* Flagged Reason Warning */}
                {h.is_flagged && h.flagged_reason && (
                  <div
                    style={{
                      background: 'var(--lost-subtle)',
                      border: '1px solid var(--lost-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 0.65rem',
                      fontSize: '0.78rem',
                      color: 'var(--lost-accent)',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <strong>Hold Reason:</strong> {h.flagged_reason}
                  </div>
                )}

                {/* Card Action Footer */}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => handleOpenDetail(h)}
                    id={`btn-inspect-handover-${h.id}`}
                  >
                    <Eye size={13} /> Inspect
                  </button>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {/* Suspend Action (if active) */}
                    {h.status !== 'suspended' && h.status !== 'completed' && h.status !== 'cancelled' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem', color: '#BE123C' }}
                        onClick={() => handleInitiateAction('suspend', h)}
                        id={`btn-suspend-${h.id}`}
                      >
                        Suspend Hold
                      </button>
                    )}

                    {/* Release Hold Action (if suspended) */}
                    {h.status === 'suspended' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem', color: '#2563EB' }}
                        onClick={() => handleInitiateAction('release_hold', h)}
                        id={`btn-release-hold-${h.id}`}
                      >
                        Release Hold
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem 0',
            borderTop: '1px solid var(--border-subtle)',
          }}
          id="admin-handovers-pagination"
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} handovers)
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => {
                const prev = pagination.page - 1;
                setPagination((p) => ({ ...p, page: prev }));
                loadHandovers(prev);
              }}
              id="admin-handovers-prev-page"
            >
              <ChevronLeft size={15} /> Prev
            </button>

            <span style={{ fontSize: '0.85rem', padding: '0 0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {pagination.page}
            </span>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => {
                const next = pagination.page + 1;
                setPagination((p) => ({ ...p, page: next }));
                loadHandovers(next);
              }}
              id="admin-handovers-next-page"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Deep Inspection Modal */}
      {selectedHandover && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedHandover(null);
          }}
          id="admin-handover-detail-modal"
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              borderRadius: 'var(--radius-xl)',
              background: '#FFFFFF',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                  {renderStatusBadge(selectedHandover.status)}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {selectedHandover.id}</span>
                </div>
                <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: 800 }}>
                  Handover Meeting: {selectedHandover.claim?.found_item?.title || 'Campus Item'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHandover(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                aria-label="Close detail modal"
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Loader2 size={24} className="spin" style={{ margin: '0 auto 0.5rem', color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Loading handover timeline...</p>
              </div>
            ) : detailError ? (
              <div style={{ padding: '1rem', background: 'var(--lost-subtle)', color: 'var(--lost-accent)', borderRadius: 'var(--radius-md)' }}>
                {detailError}
              </div>
            ) : (
              <div>
                {/* Logistics */}
                <div style={{ background: 'var(--bg-surface-hover)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div><strong>Meeting Location:</strong> {selectedHandover.proposed_location || 'Campus Police Office'}</div>
                  <div><strong>Scheduled Date &amp; Time:</strong> {selectedHandover.scheduled_at ? new Date(selectedHandover.scheduled_at).toLocaleString() : 'Not agreed yet'}</div>
                  {selectedHandover.notes && <div><strong>Coordination Notes:</strong> {selectedHandover.notes}</div>}
                  {selectedHandover.completed_at && <div><strong style={{ color: '#059669' }}>Finalized Return Time:</strong> {new Date(selectedHandover.completed_at).toLocaleString()}</div>}
                </div>

                {/* Participant Verification */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.25rem' }}>
                      <User size={14} /> Claimant (Lost Report Owner)
                    </div>
                    <div>Reg No: <strong>{selectedHandover.claimant_profile?.registration_number || 'Verified Student'}</strong></div>
                    <div>Status: {selectedHandover.claimant_confirmed_at ? <strong style={{ color: '#059669' }}>Confirmed Receipt</strong> : <span style={{ color: '#B45309' }}>Pending Confirmation</span>}</div>
                  </div>

                  <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.25rem' }}>
                      <User size={14} /> Finder (Found Report Owner)
                    </div>
                    <div>Reg No: <strong>{selectedHandover.finder_profile?.registration_number || 'Verified Student'}</strong></div>
                    <div>Status: {selectedHandover.finder_confirmed_at ? <strong style={{ color: '#059669' }}>Confirmed Handover</strong> : <span style={{ color: '#B45309' }}>Pending Confirmation</span>}</div>
                  </div>
                </div>

                {/* Linked Incidents */}
                {selectedHandover.incidents && selectedHandover.incidents.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--lost-accent)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <ShieldAlert size={15} /> Security Incident Anomaly Log
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {selectedHandover.incidents.map((inc) => (
                        <div key={inc.id} style={{ background: 'var(--lost-subtle)', border: '1px solid var(--lost-border)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--lost-accent)' }}>
                            <span>Incident: {inc.incident_type} (Severity: {inc.severity})</span>
                            <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>{new Date(inc.created_at).toLocaleString()}</span>
                          </div>
                          <div style={{ marginTop: '0.2rem', color: 'var(--text-main)' }}>Reason: {inc.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Trail */}
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={15} color="var(--text-muted)" /> Administrative Audit History
                  </h4>
                  {(!selectedHandover.audit_history || selectedHandover.audit_history.length === 0) ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No administrative hold adjustments recorded for this handover.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {selectedHandover.audit_history.map((log) => (
                        <div key={log.id} style={{ background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-main)' }}>
                            <span>{log.action}</span>
                            <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Reason: {log.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Dialog (Suspend / Release Hold) */}
      {activeActionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionInProgress) setActiveActionModal(null);
          }}
          id="admin-handover-action-modal"
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              borderRadius: 'var(--radius-lg)',
              background: '#FFFFFF',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              Confirm: {activeActionModal.action === 'suspend' ? 'Suspend Campus Handover' : 'Release Administrative Hold'}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Handover ID: <strong>{activeActionModal.handover.id.substring(0, 8)}…</strong>
            </p>

            {actionError && (
              <div style={{ padding: '0.75rem', background: 'var(--lost-subtle)', border: '1px solid var(--lost-border)', borderRadius: 'var(--radius-sm)', color: 'var(--lost-accent)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleSubmitAction}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  Documented Justification / Reason <span style={{ color: 'var(--lost-accent)' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="State the security or fraud justification (mandatory audit log)..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.88rem', resize: 'vertical' }}
                  required
                  id="handover-action-reason-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveActionModal(null)}
                  disabled={actionInProgress}
                  id="handover-action-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={actionInProgress}
                  id="handover-action-submit-btn"
                >
                  {actionInProgress ? <Loader2 size={14} className="spin" /> : null}
                  <span>{actionInProgress ? 'Executing Decision...' : 'Confirm Action'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

