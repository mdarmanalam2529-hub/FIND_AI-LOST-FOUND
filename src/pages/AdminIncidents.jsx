import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { claimsService } from '../services/claimsService';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ArrowLeft,
  XCircle,
  Loader2,
  Key,
  Flame,
  UserX,
  FileWarning,
} from 'lucide-react';

export default function AdminIncidents() {
  const { user, session, loading: authLoading } = useAuth();

  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [accessError, setAccessError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Review modal state
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('under_review');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [releaseHold, setReleaseHold] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [modalError, setModalError] = useState(null);

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const loadIncidentsData = useCallback(async () => {
    if (authLoading) return;

    if (!session?.access_token) {
      setIsAuthorized(false);
      setAccessError('Authentication required: please log in with an administrator account.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [incidentRes, statsRes] = await Promise.all([
        claimsService.fetchIncidents({
          status: statusFilter,
          severity: severityFilter,
          incidentType: typeFilter,
          search: searchQuery,
        }),
        claimsService.fetchIncidentStats(),
      ]);

      setIncidents(incidentRes.incidents || []);
      setStats(statsRes);
      setIsAuthorized(true);
    } catch (err) {
      console.error('[AdminIncidents] Fetch error:', err);
      const errMsg = err?.message || '';
      if (
        errMsg.toLowerCase().includes('access denied') ||
        errMsg.includes('403') ||
        errMsg.toLowerCase().includes('privileges') ||
        errMsg.toLowerCase().includes('forbidden')
      ) {
        setIsAuthorized(false);
        setAccessError(errMsg || 'Access denied: Requires administrator or security reviewer privileges.');
      } else {
        setError(errMsg || 'Failed to load security incidents.');
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, session?.access_token, statusFilter, severityFilter, typeFilter, searchQuery]);

  useEffect(() => {
    if (!authLoading) {
      loadIncidentsData();
    }
  }, [authLoading, loadIncidentsData]);

  const handleOpenReview = (incident) => {
    setSelectedIncident(incident);
    setReviewStatus(incident.status === 'pending_review' ? 'under_review' : incident.status);
    setDecisionNotes(incident.decision_notes || '');
    setReleaseHold(incident.status === 'cleared' ? false : true);
    setModalError(null);
  };

  const handleCloseReview = () => {
    setSelectedIncident(null);
    setDecisionNotes('');
    setModalError(null);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedIncident) return;

    const isConsequential = reviewStatus === 'cleared' || reviewStatus === 'confirmed_violation';
    if (isConsequential && !decisionNotes.trim()) {
      setModalError('Mandatory decision notes are required for consequential review decisions.');
      return;
    }

    setSubmittingReview(true);
    setModalError(null);

    try {
      await claimsService.reviewIncident(selectedIncident.id || selectedIncident.incident_id, {
        status: reviewStatus,
        decisionNotes: decisionNotes.trim(),
        releaseHold: reviewStatus === 'cleared' ? releaseHold : false,
      });

      showToast(`Incident ${selectedIncident.incident_id} marked as ${reviewStatus.replace(/_/g, ' ')}.`);
      handleCloseReview();
      loadIncidentsData();
    } catch (err) {
      setModalError(err.message || 'Failed to record incident review decision.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical':
        return <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>CRITICAL</span>;
      case 'high':
        return <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>HIGH</span>;
      case 'medium':
        return <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>MEDIUM</span>;
      default:
        return <span style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>LOW</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'cleared':
        return <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle2 size={12} /> Cleared</span>;
      case 'under_review':
        return <span style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={12} /> Under Review</span>;
      case 'confirmed_violation':
        return <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><XCircle size={12} /> Confirmed Violation</span>;
      default:
        return <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><AlertTriangle size={12} /> Pending Review</span>;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'repeated_failed_otp':
      case 'expired_otp':
      case 'reused_otp':
        return <Key size={16} color="#f59e0b" />;
      case 'unusual_attempt_burst':
        return <Flame size={16} color="#ef4444" />;
      case 'unauthorized_attempt':
        return <UserX size={16} color="#ef4444" />;
      case 'conflicting_claims':
        return <FileWarning size={16} color="#ef4444" />;
      default:
        return <AlertTriangle size={16} color="#f59e0b" />;
    }
  };

  // If restoring auth session
  if (authLoading) {
    return (
      <div className="container" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Verifying administrative security credentials...</span>
      </div>
    );
  }

  // If unauthorized
  if (!isAuthorized) {
    return (
      <div className="container" style={{ maxWidth: '640px', margin: '4rem auto', textAlign: 'center' }}>
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '3rem 2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <ShieldAlert size={32} color="var(--danger, #ef4444)" />
          </div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>Administrative Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            {accessError || 'This page requires verified university administrator or security reviewer privileges.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/dashboard" className="btn btn-secondary">
              <ArrowLeft size={16} /> Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1100px', margin: '2rem auto 4rem auto' }}>
      {/* Toast */}
      {successToast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, background: '#10b981', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
          <CheckCircle2 size={18} /> {successToast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              Handover <span className="gradient-text">Security Incidents</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
              Suspicious activity detection, OTP anomalies, and administrative hold verification
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.85rem', color: '#60a5fa' }}>
            <ShieldCheck size={16} /> Security Reviewer Session ({user?.email})
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Incidents</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-main)' }}>
            {stats?.total ?? '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>All logged anomalies</div>
        </div>

        <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 600 }}>Pending Review</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.4rem', color: '#f59e0b' }}>
            {stats?.pendingReview ?? '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Awaiting initial triage</div>
        </div>

        <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>Under Review</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.4rem', color: '#3b82f6' }}>
            {stats?.underReview ?? '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Active investigation</div>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>Cleared (Hold Released)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.4rem', color: '#10b981' }}>
            {stats?.cleared ?? '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Resolved as benign</div>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>Confirmed Violations</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.4rem', color: '#ef4444' }}>
            {stats?.confirmedViolation ?? '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Hold maintained</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by ID, reason, reg..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', fontSize: '0.85rem', height: '38px' }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.85rem', height: '38px', padding: '0 0.5rem' }}
            >
              <option value="all">All Statuses</option>
              <option value="pending_review">Pending Review</option>
              <option value="under_review">Under Review</option>
              <option value="cleared">Cleared</option>
              <option value="confirmed_violation">Confirmed Violation</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.85rem', height: '38px', padding: '0 0.5rem' }}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.85rem', height: '38px', padding: '0 0.5rem' }}
            >
              <option value="all">All Anomaly Types</option>
              <option value="repeated_failed_otp">Repeated Failed OTP</option>
              <option value="expired_otp">Expired OTP</option>
              <option value="reused_otp">Reused OTP</option>
              <option value="unauthorized_attempt">Unauthorized Attempt</option>
              <option value="premature_confirmation">Premature Confirmation</option>
              <option value="conflicting_claims">Conflicting Claims</option>
              <option value="unusual_attempt_burst">Unusual Attempt Burst</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadIncidentsData}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
        </button>
      </div>

      {/* Incidents Table / List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <div>Loading incident records...</div>
        </div>
      ) : error ? (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '1.5rem', color: '#ef4444', textAlign: 'center' }}>
          <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem' }} />
          <p>{error}</p>
        </div>
      ) : incidents.length === 0 ? (
        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <ShieldCheck size={40} color="#10b981" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Security Incidents Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>
            No suspicious handover activities or verification holds match the active filters.
          </p>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
          <div className="table-responsive" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem', minWidth: '820px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Incident ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Anomaly Type</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Severity</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Reason / Details</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Attempts</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id || inc.incident_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                      {inc.incident_id}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {getTypeIcon(inc.incident_type)}
                        <span style={{ textTransform: 'capitalize' }}>
                          {inc.incident_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {getSeverityBadge(inc.severity)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={inc.reason}>{inc.reason}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 600 }}>{inc.attempt_count}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(inc.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {getStatusBadge(inc.status)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenReview(inc)}
                      >
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedIncident && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '16px', maxWidth: '600px', width: '100%', padding: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={22} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Investigate Incident {selectedIncident.incident_id}</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseReview}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Evidence summary */}
            <div style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Anomaly Type:</span> <strong>{selectedIncident.incident_type.replace(/_/g, ' ')}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Severity:</span> {getSeverityBadge(selectedIncident.severity)}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Attempts:</span> <strong>{selectedIncident.attempt_count}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Logged At:</span> {new Date(selectedIncident.created_at).toLocaleString()}</div>
                {selectedIncident.registration_number && (
                  <div><span style={{ color: 'var(--text-muted)' }}>Reg Number:</span> <strong>{selectedIncident.registration_number}</strong></div>
                )}
                {selectedIncident.handover_id && (
                  <div><span style={{ color: 'var(--text-muted)' }}>Handover ID:</span> <span style={{ fontFamily: 'monospace' }}>{selectedIncident.handover_id.slice(0, 8)}...</span></div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Flag Reason:</span>
                <p style={{ margin: '0.25rem 0 0', fontWeight: 500 }}>{selectedIncident.reason}</p>
              </div>
            </div>

            <form onSubmit={handleSubmitReview}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Review Status Decision</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  className="form-input"
                  disabled={submittingReview}
                >
                  <option value="under_review">Under Review (Keep Hold)</option>
                  <option value="cleared">Cleared (Benign / Resolved)</option>
                  <option value="confirmed_violation">Confirmed Violation (Maintain Hold)</option>
                </select>
              </div>

              {reviewStatus === 'cleared' && (
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked={releaseHold}
                      onChange={(e) => setReleaseHold(e.target.checked)}
                    />
                    <span style={{ fontWeight: 600, color: '#10b981' }}>Release Administrative Hold on Handover</span>
                  </label>
                  <p style={{ margin: '0.25rem 0 0 1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Re-enables normal handover confirmation flow for the student finder and claimant.
                  </p>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">
                  Documented Decision Justification {reviewStatus !== 'under_review' && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                <textarea
                  rows={3}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Record factual notes, verified student ID credentials, or rationale..."
                  className="form-input"
                  style={{ resize: 'vertical' }}
                  disabled={submittingReview}
                />
              </div>

              {modalError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '0.5rem 0.75rem', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseReview}
                  disabled={submittingReview}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReview}
                >
                  {submittingReview ? (
                    <>
                      <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Recording...
                    </>
                  ) : (
                    'Save Review Decision'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
