import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { isStaffOrAdminUser } from '../lib/roleHelpers';
import { claimsService } from '../services/claimsService';
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Inbox
} from 'lucide-react';

export default function AdminClaims() {
  const { user, loading } = useAuth();
  const [claimsData, setClaimsData] = useState({ outgoing: [], incoming: [], adminQueue: [], allClaims: [] });
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('adminQueue'); // default admin view
  const [actionInProgress, setActionInProgress] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (loading) return;
    if (!user) return; // unauthenticated handled by AdminRoute
    const fetchClaims = async () => {
      try {
        const json = await claimsService.fetchClaims();
        setClaimsData({
          outgoing: json.outgoing || [],
          incoming: json.incoming || [],
          adminQueue: json.adminQueue || [],
          allClaims: json.allClaims || [],
        });
      } catch (e) {
        console.error('[AdminClaims] fetch error', e);
        setError(e.message);
      }
    };
    fetchClaims();
  }, [loading, user]);

  const refreshClaims = async () => {
    setRefreshing(true);
    try {
      const json = await claimsService.fetchClaims();
      setClaimsData({
        outgoing: json.outgoing || [],
        incoming: json.incoming || [],
        adminQueue: json.adminQueue || [],
        allClaims: json.allClaims || [],
      });
      setError(null);
    } catch (e) {
      console.error('[AdminClaims] refresh error', e);
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const getAllowedAdminActions = (claim) => {
    if (['completed', 'cancelled'].includes(claim.status)) return [];
    return ['admin_approve', 'admin_reject', 'admin_hold', 'admin_release_hold', 'admin_dispute', 'admin_suspend_handover'];
  };

  const handleAdminAction = async (claimId, action) => {
    if (actionInProgress) return;
    const requiresReason = ['admin_reject', 'admin_hold', 'admin_dispute', 'admin_suspend_handover'].includes(action);
    let reason = '';
    if (requiresReason) {
      reason = window.prompt('Please provide a reason for this action (required)');
      if (!reason || !reason.trim()) {
        alert('Action cancelled – a reason is required.');
        return;
      }
    }
    if (!window.confirm(`Are you sure you want to ${action.replace('_', ' ')} this claim?`)) return;
    setActionInProgress(true);
    try {
      await claimsService.reviewClaim(claimId, { action, reason: reason || '' });
      alert('Action completed successfully.');
      await refreshClaims();
    } catch (e) {
      console.error('[AdminClaims] action error', e);
      alert(`Failed to perform action: ${e.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="badge badge-found" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <span className="badge badge-lost" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <XCircle size={12} /> {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      case 'on_hold':
      case 'hold':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={12} /> On Hold
          </span>
        );
      case 'disputed':
        return (
          <span className="badge badge-lost" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <ShieldAlert size={12} /> Disputed
          </span>
        );
      case 'completed':
        return (
          <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle2 size={12} /> Completed
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={12} /> {status || 'Pending'}
          </span>
        );
    }
  };

  const getFilteredList = (list) => {
    if (!list) return [];
    return list.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = item.id?.toLowerCase().includes(q);
        const foundMatch = item.found_item?.title?.toLowerCase().includes(q);
        const lostMatch = item.lost_item?.title?.toLowerCase().includes(q);
        const claimantMatch = item.claimant_id?.toLowerCase().includes(q);
        return idMatch || foundMatch || lostMatch || claimantMatch;
      }
      return true;
    });
  };

  const currentRawList = useMemo(() => {
    if (activeTab === 'outgoing') return claimsData.outgoing;
    if (activeTab === 'incoming') return claimsData.incoming;
    if (activeTab === 'adminQueue') return claimsData.adminQueue;
    return claimsData.allClaims;
  }, [activeTab, claimsData]);

  const currentDisplayList = useMemo(() => {
    return getFilteredList(currentRawList);
  }, [currentRawList, searchQuery, statusFilter]);

  const renderTable = (list) => {
    if (list.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
          <Inbox size={40} style={{ opacity: 0.35, margin: '0 auto 0.75rem' }} />
          <h4 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '0.35rem' }}>No Claims Found</h4>
          <p style={{ fontSize: '0.88rem', margin: 0 }}>
            {searchQuery || statusFilter !== 'all' 
              ? 'No claims match your search and filter criteria.'
              : 'There are currently no claims in this queue.'}
          </p>
        </div>
      );
    }

    return (
      <div className="table-responsive" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem', minWidth: '720px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Claim ID</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Found Item</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Lost Item</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Claimant</th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}>
                <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-main)' }}>
                  {c.id.substring(0, 8)}…
                </td>
                <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>
                  {c.found_item?.title || '—'}
                </td>
                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                  {c.lost_item?.title || '—'}
                </td>
                <td style={{ padding: '0.85rem 1rem' }}>
                  {renderStatusBadge(c.status)}
                </td>
                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {c.claimant_id ? `${c.claimant_id.substring(0, 8)}…` : '—'}
                </td>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  {user && isStaffOrAdminUser(user) ? (
                    <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {getAllowedAdminActions(c).map((act) => (
                        <button
                          key={act}
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                          disabled={actionInProgress}
                          onClick={() => handleAdminAction(c.id, act)}
                        >
                          {act.replace('admin_', '').replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const tabs = [
    { id: 'adminQueue', label: `Admin Queue (${claimsData.adminQueue.length})` },
    { id: 'allClaims', label: `All Claims (${claimsData.allClaims.length})` },
    { id: 'incoming', label: `Incoming (${claimsData.incoming.length})` },
    { id: 'outgoing', label: `My Claims (${claimsData.outgoing.length})` },
  ];

  return (
    <div style={{ position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 140px)' }}>
      <div className="container" style={{ padding: '2.5rem 1.5rem 4rem' }} id="admin-claims-page">
        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
              <ShieldAlert size={13} /> Administrative Operations
            </div>
            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Claims Administration</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
              Review ownership assertions, private proofs, verification holds, and disputed custody returns.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={refreshClaims}
            disabled={refreshing}
            id="admin-claims-refresh-btn"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {error && (
          <div 
            style={{ 
              padding: '0.85rem 1.25rem', 
              background: 'var(--lost-subtle)', 
              border: '1px solid var(--lost-border)', 
              borderRadius: 'var(--radius-md)', 
              color: 'var(--lost-accent)', 
              marginBottom: '1.25rem',
              fontSize: '0.9rem'
            }} 
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Toolbar: Tabs & Filters */}
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search & Filter */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: '180px' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter by title / ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '1.9rem', height: '34px', fontSize: '0.84rem' }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-input"
                style={{ height: '34px', fontSize: '0.84rem', padding: '0 0.5rem', cursor: 'pointer' }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="on_hold">On Hold</option>
                <option value="disputed">Disputed</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Container Card */}
        <div className="glass-card" style={{ padding: '0.5rem 0', overflow: 'hidden' }}>
          {renderTable(currentDisplayList)}
        </div>
      </div>
    </div>
  );
}
