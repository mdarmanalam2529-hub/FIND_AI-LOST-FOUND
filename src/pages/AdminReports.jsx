import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../lib/roleHelpers';
import { adminReportService } from '../services/adminReportService';
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Eye,
  Flag,
  Archive,
  RotateCcw,
  Copy,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  MapPin,
  Calendar,
  X,
} from 'lucide-react';

export default function AdminReports() {
  const { user, session, loading: authLoading } = useAuth();

  // Primary list state
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [indicatorFilter, setIndicatorFilter] = useState('all');

  // Detail & Moderation modal
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [matches, setMatches] = useState(null);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Action modal / prompt state
  const [actionInProgress, setActionInProgress] = useState(false);
  const [activeActionModal, setActiveActionModal] = useState(null); // { action, report }
  const [actionReason, setActionReason] = useState('');
  const [duplicateOfId, setDuplicateOfId] = useState('');
  const [actionError, setActionError] = useState(null);

  // Image zoom modal
  const [zoomedImage, setZoomedImage] = useState(null);

  // Check user role
  const isFullAdmin = isAdminUser(user);

  const showToast = (message) => {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 4500);
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load reports
  const loadReports = useCallback(async (pageNumber = 1) => {
    if (authLoading) return;
    if (!session?.access_token) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await adminReportService.fetchReports({
        page: pageNumber,
        limit: pagination.limit,
        itemType: typeFilter,
        status: statusFilter,
        category: categoryFilter,
        indicator: indicatorFilter,
        search: debouncedSearch,
      });

      setReports(data.reports || []);
      setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
      setStats(data.stats || null);
      setAccessDenied(false);
    } catch (err) {
      console.error('[AdminReports] Fetch error:', err);
      if (err.message.includes('Access denied') || err.message.includes('403')) {
        setAccessDenied(true);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authLoading, session, pagination.limit, typeFilter, statusFilter, categoryFilter, indicatorFilter, debouncedSearch]);

  useEffect(() => {
    loadReports(1);
  }, [loadReports]);

  // Open deep report detail
  const handleOpenDetail = async (reportItem) => {
    setSelectedReport(reportItem);
    setDetailLoading(true);
    setDetailError(null);
    setMatches(null);

    try {
      const detailed = await adminReportService.fetchReport(reportItem.id);
      setSelectedReport(detailed);
    } catch (err) {
      console.error('[AdminReports] Detail fetch error:', err);
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  // Fetch AI candidate matches
  const handleFetchMatches = async (reportId) => {
    setMatchesLoading(true);
    try {
      const results = await adminReportService.fetchMatches(reportId);
      setMatches(results);
    } catch (err) {
      console.error('[AdminReports] Fetch matches error:', err);
      showToast(`Could not load matches: ${err.message}`);
    } finally {
      setMatchesLoading(false);
    }
  };

  // Open moderation action dialog
  const handleInitiateAction = (action, report) => {
    const targetReport = report || selectedReport;
    if (!targetReport) return;

    // Check permission
    const adminOnlyActions = ['approve', 'reject', 'hide_report', 'restrict', 'restore', 'resolve_duplicate'];
    if (adminOnlyActions.includes(action) && !isFullAdmin) {
      alert(`Action "${action.replace('_', ' ')}" requires full Administrator authority. Security reviewers can mark reports as reviewed and flag suspicious items.`);
      return;
    }

    setActionReason('');
    setDuplicateOfId('');
    setActionError(null);
    setActiveActionModal({ action, report: targetReport });
  };

  // Submit moderation action
  const handleSubmitAction = async (e) => {
    if (e) e.preventDefault();
    if (!activeActionModal || actionInProgress) return;

    const { action, report } = activeActionModal;
    const requiresReason = ['reject', 'flag_suspicious', 'hide_report', 'restrict', 'restore', 'resolve_duplicate'];

    if (requiresReason.includes(action)) {
      if (!actionReason || actionReason.trim().length < 3) {
        setActionError('A valid explanation reason of at least 3 characters is strictly required.');
        return;
      }
    }

    if (action === 'resolve_duplicate') {
      if (!duplicateOfId || duplicateOfId.trim().length < 8) {
        setActionError('Please provide a valid Primary Report UUID that this report duplicates.');
        return;
      }
      if (duplicateOfId.trim() === report.id) {
        setActionError('A report cannot be marked as a duplicate of itself.');
        return;
      }
    }

    setActionInProgress(true);
    setActionError(null);

    try {
      const details = {};
      if (action === 'resolve_duplicate') {
        details.duplicateOfId = duplicateOfId.trim();
      }

      await adminReportService.moderateReport(report.id, {
        action,
        reason: actionReason.trim(),
        details,
      });

      showToast(`Action "${action.replace('_', ' ')}" applied successfully.`);
      setActiveActionModal(null);

      // Refresh list & current opened report
      await loadReports(pagination.page);
      if (selectedReport && selectedReport.id === report.id) {
        const refreshed = await adminReportService.fetchReport(report.id);
        setSelectedReport(refreshed);
      }
    } catch (err) {
      console.error('[AdminReports] Submit action error:', err);
      setActionError(err.message || 'Moderation action failed.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>Open</span>;
      case 'matched':
        return <span className="badge" style={{ background: '#ECFEFF', color: '#0891B2', border: '1px solid #A5F3FC' }}>Matched</span>;
      case 'returned':
        return <span className="badge" style={{ background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>Returned</span>;
      case 'closed':
        return <span className="badge" style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1' }}>Closed / Restricted</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  // Render Type Badge
  const renderTypeBadge = (itemType) => {
    return itemType === 'lost' ? (
      <span className="badge badge-lost" style={{ fontSize: '0.75rem' }}>Lost Report</span>
    ) : (
      <span className="badge badge-found" style={{ fontSize: '0.75rem' }}>Found Report</span>
    );
  };

  if (accessDenied) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', maxWidth: '640px', margin: '0 auto' }}>
        <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', borderColor: 'var(--lost-border)' }}>
          <ShieldAlert size={48} color="var(--lost-accent)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Administrator Access Required</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            This page is restricted to authorized FindAI staff and security reviewers. Your account is not authorized to moderate lost-and-found reports.
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
            animation: 'fadeIn 0.2s ease',
          }}
          id="admin-reports-toast"
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
            <ShieldCheck size={26} color="var(--primary)" />
            Report Moderation Queue
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Inspect campus lost &amp; found reports, verify legitimacy, manage duplicates, and review flagged items.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadReports(pagination.page)}
            disabled={loading}
            id="admin-reports-refresh-btn"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Statistics Bar */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
          id="admin-reports-stats-bar"
        >
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Reports</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{stats.total}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--lost-accent)', textTransform: 'uppercase', fontWeight: 600 }}>Lost Items</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--lost-accent)' }}>{stats.lost}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--found-accent)', textTransform: 'uppercase', fontWeight: 600 }}>Found Items</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--found-accent)' }}>{stats.found}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#2563EB', textTransform: 'uppercase', fontWeight: 600 }}>Active Open</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563EB' }}>{stats.open}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#7C3AED', textTransform: 'uppercase', fontWeight: 600 }}>Returned</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7C3AED' }}>{stats.returned}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--warning-accent)', textTransform: 'uppercase', fontWeight: 600 }}>Disputed / Claims</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning-accent)' }}>{stats.disputed}</div>
          </div>
          <div className="glass-card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--lost-accent)', textTransform: 'uppercase', fontWeight: 600 }}>Suspicious Flags</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--lost-accent)' }}>{stats.suspicious}</div>
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
              placeholder="Search reports by title, location, color, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.4rem', paddingRight: searchQuery ? '2rem' : '0.75rem', height: '38px', fontSize: '0.88rem' }}
              id="admin-reports-search-input"
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
            {/* Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '0.85rem', padding: '0 0.75rem' }}
              id="admin-filter-type"
            >
              <option value="all">All Types</option>
              <option value="lost">Lost Only</option>
              <option value="found">Found Only</option>
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '0.85rem', padding: '0 0.75rem' }}
              id="admin-filter-status"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="matched">Matched</option>
              <option value="returned">Returned</option>
              <option value="closed">Closed / Restricted</option>
            </select>

            {/* Category */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '0.85rem', padding: '0 0.75rem' }}
              id="admin-filter-category"
            >
              <option value="all">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="keys-wallets">Keys &amp; Wallets</option>
              <option value="clothing">Clothing</option>
              <option value="documents">Documents</option>
              <option value="jewelry">Jewelry</option>
              <option value="other">Other</option>
            </select>

            {/* Indicator */}
            <select
              value={indicatorFilter}
              onChange={(e) => setIndicatorFilter(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '0.85rem', padding: '0 0.75rem' }}
              id="admin-filter-indicator"
            >
              <option value="all">All Moderation Indicators</option>
              <option value="disputed">Disputed / Competing</option>
              <option value="suspicious">Suspicious Flags</option>
              <option value="competing">Multiple Competing Claims</option>
              <option value="needs_review">Needs Review</option>
              <option value="reviewed">Reviewed</option>
              <option value="duplicate">Resolved Duplicates</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
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
          id="admin-reports-error-banner"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} color="var(--lost-accent)" />
            <span style={{ color: 'var(--lost-accent)', fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadReports(pagination.page)}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }} id="admin-reports-loading">
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>Loading report moderation queue...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && reports.length === 0 && (
        <div
          className="glass-card"
          style={{ textAlign: 'center', padding: '3.5rem 1rem' }}
          id="admin-reports-empty"
        >
          <FileText size={40} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>No Reports Match Your Query</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
            Try broadening your search term or selecting different filters from the moderation toolbar.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('');
              setTypeFilter('all');
              setStatusFilter('all');
              setCategoryFilter('all');
              setIndicatorFilter('all');
            }}
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Reports Grid */}
      {!loading && reports.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
          id="admin-reports-grid"
        >
          {reports.map((report) => {
            const hasDispute = report.indicators?.is_disputed || report.indicators?.has_competing_claims;
            const isSuspicious = report.indicators?.is_flagged_suspicious || report.indicators?.has_security_incidents;
            const isDuplicate = report.indicators?.is_duplicate_resolved;
            const isReviewed = report.indicators?.is_reviewed;

            return (
              <div
                key={report.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.1rem',
                  border: isSuspicious
                    ? '1.5px solid var(--lost-border)'
                    : hasDispute
                    ? '1.5px solid var(--warning-border)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'box-shadow 0.15s ease',
                  position: 'relative',
                }}
              >
                {/* Header: Type, Status, & Indicator Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {renderTypeBadge(report.item_type)}
                    {renderStatusBadge(report.status)}
                  </div>

                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {hasDispute && (
                      <span className="badge" style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', fontSize: '0.7rem' }}>
                        <AlertTriangle size={11} style={{ marginRight: '2px', display: 'inline' }} /> Disputed
                      </span>
                    )}
                    {isSuspicious && (
                      <span className="badge" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', fontSize: '0.7rem' }}>
                        <Flag size={11} style={{ marginRight: '2px', display: 'inline' }} /> Flagged
                      </span>
                    )}
                    {isDuplicate && (
                      <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: '0.7rem' }}>
                        <Copy size={11} style={{ marginRight: '2px', display: 'inline' }} /> Duplicate
                      </span>
                    )}
                    {isReviewed && (
                      <span className="badge" style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: '0.7rem' }}>
                        <CheckCircle2 size={11} style={{ marginRight: '2px', display: 'inline' }} /> Reviewed
                      </span>
                    )}
                  </div>
                </div>

                {/* Content with optional thumbnail */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  {report.signed_image_url ? (
                    <button
                      type="button"
                      onClick={() => setZoomedImage(report.signed_image_url)}
                      style={{
                        width: '64px',
                        height: '64px',
                        flexShrink: 0,
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        border: '1px solid var(--border-subtle)',
                        padding: 0,
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                      title="Click to view image"
                    >
                      <img
                        src={report.signed_image_url}
                        alt={report.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </button>
                  ) : (
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        flexShrink: 0,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-dim)',
                      }}
                    >
                      <FileText size={20} />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        marginBottom: '0.2rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={report.title}
                    >
                      {report.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.35,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {report.description}
                    </p>
                  </div>
                </div>

                {/* Meta details: category, location, date */}
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    marginBottom: '0.85rem',
                    background: 'var(--bg-surface-hover)',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Category: <strong>{report.category}</strong></span>
                    {report.color && <span>Color: <strong>{report.color}</strong></span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={12} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.location_description}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={12} style={{ flexShrink: 0 }} />
                    <span>Incident: {report.incident_date}</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>
                      ID: {report.id.substring(0, 8)}…
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.4rem', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => handleOpenDetail(report)}
                    id={`btn-view-${report.id}`}
                  >
                    <Eye size={13} /> Inspect
                  </button>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {/* Mark Reviewed */}
                    {!isReviewed && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem', color: '#047857' }}
                        onClick={() => handleInitiateAction('mark_reviewed', report)}
                        title="Mark report as reviewed by admin"
                        id={`btn-reviewed-${report.id}`}
                      >
                        <CheckCircle2 size={13} /> Review
                      </button>
                    )}

                    {/* Flag Suspicious */}
                    {!isSuspicious && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem', color: '#BE123C' }}
                        onClick={() => handleInitiateAction('flag_suspicious', report)}
                        title="Flag report as suspicious"
                        id={`btn-flag-${report.id}`}
                      >
                        <Flag size={13} /> Flag
                      </button>
                    )}

                    {/* Consequential action: Hide / Restrict (if open) */}
                    {isFullAdmin && report.status === 'open' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem', color: '#64748B' }}
                        onClick={() => handleInitiateAction('hide_report', report)}
                        title="Hide/Restrict report from public campus view"
                        id={`btn-hide-${report.id}`}
                      >
                        <Archive size={13} /> Hide
                      </button>
                    )}

                    {/* Restore (if closed) */}
                    {isFullAdmin && report.status === 'closed' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.55rem', color: '#2563EB' }}
                        onClick={() => handleInitiateAction('restore', report)}
                        title="Restore previously restricted report"
                        id={`btn-restore-${report.id}`}
                      >
                        <RotateCcw size={13} /> Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
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
          id="admin-reports-pagination"
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} reports)
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => {
                const prevPage = pagination.page - 1;
                setPagination((prev) => ({ ...prev, page: prevPage }));
                loadReports(prevPage);
              }}
              id="admin-reports-prev-page"
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
                const nextPage = pagination.page + 1;
                setPagination((prev) => ({ ...prev, page: nextPage }));
                loadReports(nextPage);
              }}
              id="admin-reports-next-page"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Deep Report Inspection Modal */}
      {selectedReport && (
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
            if (e.target === e.currentTarget) setSelectedReport(null);
          }}
          id="admin-report-detail-modal"
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              borderRadius: 'var(--radius-xl)',
              background: '#FFFFFF',
              position: 'relative',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                  {renderTypeBadge(selectedReport.item_type)}
                  {renderStatusBadge(selectedReport.status)}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {selectedReport.id}</span>
                </div>
                <h2 style={{ fontSize: '1.35rem', color: 'var(--text-main)', fontWeight: 800 }}>{selectedReport.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                aria-label="Close detail modal"
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Loader2 size={24} className="spin" style={{ margin: '0 auto 0.5rem', color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Loading report details &amp; audit history...</p>
              </div>
            ) : detailError ? (
              <div style={{ padding: '1rem', background: 'var(--lost-subtle)', border: '1px solid var(--lost-border)', borderRadius: 'var(--radius-md)', color: 'var(--lost-accent)', marginBottom: '1rem' }}>
                {detailError}
              </div>
            ) : (
              <div>
                {/* Image and Basic Info Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: selectedReport.signed_image_url ? '1fr 180px' : '1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div>
                    <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Description</h4>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      {selectedReport.description}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', background: 'var(--bg-surface-hover)', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Category:</span> <strong>{selectedReport.category}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Color:</span> <strong>{selectedReport.color || 'None specified'}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Incident Date:</span> <strong>{selectedReport.incident_date}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Reported At:</span> <strong>{new Date(selectedReport.created_at).toLocaleString()}</strong></div>
                    </div>

                    <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Location Description:</span> <strong>{selectedReport.location_description}</strong>
                    </div>

                    {selectedReport.reporter_profile && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                        <span>Reporter Reg No: <strong>{selectedReport.reporter_profile.registration_number}</strong> ({selectedReport.reporter_profile.branch || 'Student'}, Year {selectedReport.reporter_profile.academic_year || '—'})</span>
                      </div>
                    )}
                  </div>

                  {selectedReport.signed_image_url && (
                    <div style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setZoomedImage(selectedReport.signed_image_url)}
                        style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', padding: 0, cursor: 'pointer', background: 'transparent', width: '100%' }}
                        title="Enlarge photo"
                      >
                        <img
                          src={selectedReport.signed_image_url}
                          alt="Report Photo"
                          style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                        />
                      </button>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>Click to zoom</span>
                    </div>
                  )}
                </div>

                {/* Moderation Controls Bar */}
                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={16} color="var(--primary)" />
                    Administrative Actions
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleInitiateAction('mark_reviewed', selectedReport)}
                      id="modal-btn-mark-reviewed"
                    >
                      <CheckCircle2 size={14} color="#047857" /> Mark Reviewed
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleInitiateAction('flag_suspicious', selectedReport)}
                      id="modal-btn-flag-suspicious"
                    >
                      <Flag size={14} color="#BE123C" /> Flag Suspicious
                    </button>

                    {isFullAdmin && selectedReport.status !== 'open' && selectedReport.status !== 'returned' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleInitiateAction('approve', selectedReport)}
                        id="modal-btn-approve"
                      >
                        <CheckCircle2 size={14} color="#2563EB" /> Approve / Reopen
                      </button>
                    )}

                    {isFullAdmin && selectedReport.status === 'open' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleInitiateAction('reject', selectedReport)}
                        id="modal-btn-reject"
                      >
                        <XCircle size={14} color="#BE123C" /> Reject Report
                      </button>
                    )}

                    {isFullAdmin && selectedReport.status === 'open' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleInitiateAction('hide_report', selectedReport)}
                        id="modal-btn-hide"
                      >
                        <Archive size={14} color="#64748B" /> Hide / Restrict
                      </button>
                    )}

                    {isFullAdmin && selectedReport.status === 'closed' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleInitiateAction('restore', selectedReport)}
                        id="modal-btn-restore"
                      >
                        <RotateCcw size={14} color="#2563EB" /> Restore to Feed
                      </button>
                    )}

                    {isFullAdmin && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleInitiateAction('resolve_duplicate', selectedReport)}
                        id="modal-btn-resolve-duplicate"
                      >
                        <Copy size={14} color="#2563EB" /> Resolve as Duplicate
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Matching Inspection */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sparkles size={16} color="var(--primary)" />
                      AI Matching Candidates (Privacy Protected)
                    </h4>
                    {!matches && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => handleFetchMatches(selectedReport.id)}
                        disabled={matchesLoading}
                        id="modal-btn-load-matches"
                      >
                        {matchesLoading ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                        <span>{matchesLoading ? 'Calculating AI Matches...' : 'Load Potential Matches'}</span>
                      </button>
                    )}
                  </div>

                  {matches && matches.length === 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-surface-hover)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                      No active opposite reports found for candidate matching at this time.
                    </div>
                  )}

                  {matches && matches.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {matches.map((m, idx) => (
                        <div
                          key={m.item.id || idx}
                          style={{
                            background: 'var(--bg-surface-hover)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.65rem 0.85rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{m.item.title}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {m.item.category} • {m.item.location_description} • {m.explanation}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span className="badge" style={{ background: '#ECFEFF', color: '#0891B2', border: '1px solid #A5F3FC', fontWeight: 700 }}>
                              {m.similarityPercent}% match
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit & Moderation Trail */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Clock size={15} color="var(--text-muted)" />
                    Moderation Audit History
                  </h4>

                  {(!selectedReport.audit_history || selectedReport.audit_history.length === 0) ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No prior administrative moderation recorded for this report.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {selectedReport.audit_history.map((log) => (
                        <div
                          key={log.id}
                          style={{
                            background: 'var(--bg-surface-hover)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontWeight: 600 }}>
                            <span>Action: {log.action.replace('report_', '')}</span>
                            <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            <strong>Reason:</strong> {log.reason}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                            By: {log.actor_name} ({log.actor_role})
                          </div>
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

      {/* Action Execution Dialog (Reason & Duplicate prompt) */}
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
          id="admin-reports-action-modal"
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '1.75rem',
              borderRadius: 'var(--radius-lg)',
              background: '#FFFFFF',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem', textTransform: 'capitalize' }}>
              Confirm: {activeActionModal.action.replace('_', ' ')}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              You are applying <strong>{activeActionModal.action.replace('_', ' ')}</strong> to report:
              <br />
              <strong style={{ color: 'var(--text-main)' }}>"{activeActionModal.report.title}"</strong> (ID: {activeActionModal.report.id.substring(0, 8)}…)
            </p>

            {actionError && (
              <div style={{ padding: '0.75rem', background: 'var(--lost-subtle)', border: '1px solid var(--lost-border)', borderRadius: 'var(--radius-sm)', color: 'var(--lost-accent)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {actionError}
              </div>
            )}

            <form onSubmit={handleSubmitAction}>
              {/* Duplicate ID Input if resolving duplicate */}
              {activeActionModal.action === 'resolve_duplicate' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                    Primary Report UUID <span style={{ color: 'var(--lost-accent)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter UUID of the primary canonical report"
                    value={duplicateOfId}
                    onChange={(e) => setDuplicateOfId(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.88rem' }}
                    required
                    id="action-duplicate-of-id"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    This duplicate report will be closed and linked to the primary canonical report.
                  </span>
                </div>
              )}

              {/* Reason Input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  Action Explanation / Justification <span style={{ color: 'var(--lost-accent)' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide documented reason for this administrative decision (audited)..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.88rem', resize: 'vertical' }}
                  required
                  id="action-reason-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveActionModal(null)}
                  disabled={actionInProgress}
                  id="action-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={actionInProgress}
                  id="action-submit-btn"
                >
                  {actionInProgress ? <Loader2 size={14} className="spin" /> : null}
                  <span>{actionInProgress ? 'Executing Action...' : 'Confirm Decision'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            zIndex: 1200,
          }}
          onClick={() => setZoomedImage(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={zoomedImage}
              alt="Zoomed Report"
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
            />
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0px',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close enlarged photo"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
