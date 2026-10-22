import React, { useState, useEffect, useMemo } from 'react';
import { claimsService } from '../services/claimsService';
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  MapPin, 
  Calendar, 
  Lock, 
  FileText, 
  Send, 
  Loader2, 
  RefreshCw, 
  ShieldAlert, 
  UserCheck, 
  ArrowRight,
  Handshake,
  Check,
  Search,
  Filter,
  History,
  PauseCircle,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  Tag
} from 'lucide-react';

export default function ClaimsManager() {
  const [subTab, setSubTab] = useState('incoming'); // 'incoming' | 'outgoing' | 'admin'
  const [claimsData, setClaimsData] = useState({ outgoing: [], incoming: [], adminQueue: [], allClaims: [], isAdmin: false });
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Handover coordination state
  const [coordinatingHandoverId, setCoordinatingHandoverId] = useState(null);
  const [handoverLocation, setHandoverLocation] = useState('');
  const [handoverTime, setHandoverTime] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  // Admin filter & timeline state
  const [adminSearch, setAdminSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('all');
  const [adminRiskFilter, setAdminRiskFilter] = useState('all');
  const [expandedTimelineClaimId, setExpandedTimelineClaimId] = useState(null);
  const [expandedProofClaimId, setExpandedProofClaimId] = useState(null);

  const showToast = (message) => {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const loadClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await claimsService.fetchClaims();
      setClaimsData(data);
    } catch (err) {
      console.error('[ClaimsManager] Error:', err);
      setError(err.message || 'Failed to fetch claims.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, []);

  const handleReviewAction = async (claimId, action) => {
    let reason = '';
    if (action === 'reject' || action === 'admin_reject') {
      reason = window.prompt('Please provide a mandatory reason for rejecting this claim:') || '';
      if (!reason.trim()) return;
    } else if (action === 'admin_dispute') {
      reason = window.prompt('Provide a mandatory reason for flagging this claim as disputed (recorded in audit log):') || '';
      if (!reason.trim()) return;
    } else if (action === 'admin_hold') {
      reason = window.prompt('Provide a mandatory reason for placing this claim on administrative hold:') || '';
      if (!reason.trim()) return;
    } else if (action === 'admin_release_hold') {
      reason = window.prompt('Provide a mandatory reason for releasing the administrative hold:') || '';
      if (!reason.trim()) return;
    } else if (action === 'admin_suspend_handover') {
      reason = window.prompt('Provide a mandatory safety/fraud reason for suspending this handover:') || '';
      if (!reason.trim()) return;
    } else if (action === 'request_admin_review') {
      reason = window.prompt('Optional notes explaining why security review is requested:') || '';
    } else if (action === 'request_evidence') {
      reason = window.prompt('Specify what additional evidence is required from the claimant:') || '';
      if (!reason.trim()) return;
    } else if (action === 'admin_approve') {
      const confirmApprove = window.confirm('Authorize and approve this claim? This will open return handover coordination.');
      if (!confirmApprove) return;
      reason = window.prompt('Documented reason for admin approval override (e.g., serial verified, photo receipt confirmed):') || 'Authorized by security reviewer';
      if (!reason.trim()) return;
    } else if (action === 'approve') {
      const confirmApprove = window.confirm('Approve this ownership claim? This allows you to arrange physical return directly with the claimant.');
      if (!confirmApprove) return;
      reason = 'Claim approved directly by finder';
    }

    setActionLoadingId(claimId);
    try {
      const res = await claimsService.reviewClaim(claimId, { action, reason, adminNotes: reason });
      showToast(res.message || 'Action executed successfully.');
      await loadClaims();
    } catch (err) {
      alert(err.message || 'Failed to process review action.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveHandover = async (handoverId) => {
    if (!handoverLocation.trim()) {
      alert('Please specify a secure return meeting location (e.g. Campus Police Office, Main Reception).');
      return;
    }

    setActionLoadingId(handoverId);
    try {
      const res = await claimsService.coordinateHandover(handoverId, {
        proposedLocation: handoverLocation.trim(),
        scheduledAt: handoverTime || null,
        notes: handoverNotes.trim() || null,
      });
      setCoordinatingHandoverId(null);
      showToast('Handover plan updated. The other party has been notified.');
      await loadClaims();
    } catch (err) {
      alert(err.message || 'Failed to update handover details.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmHandover = async (handoverId, confirmationType) => {
    const promptMsg = confirmationType === 'finder_handed_over'
      ? 'Confirm that you have physically handed over the item to the claimant?'
      : 'Confirm that you have received your item and verified its condition?';

    if (!window.confirm(promptMsg)) return;

    setActionLoadingId(handoverId);
    try {
      const res = await claimsService.confirmHandover(handoverId, confirmationType);
      showToast(res.message);
      await loadClaims();
    } catch (err) {
      alert(err.message || 'Confirmation failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Determine standard, human-friendly status badge and label
  const getDetailedStatus = (claim) => {
    const handover = claim.handover;

    if (claim.status === 'completed') {
      return { label: 'Completed', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.35)' };
    }
    if (claim.status === 'disputed') {
      return { label: 'Disputed', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.35)' };
    }
    if (claim.status === 'rejected') {
      return { label: 'Rejected', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.35)' };
    }
    if (claim.status === 'cancelled') {
      return { label: 'Cancelled', color: 'var(--text-dim)', bg: 'rgba(255, 255, 255, 0.08)', border: 'transparent' };
    }
    if (claim.status === 'under_review') {
      return { label: 'On Hold (Admin Review)', color: '#facc15', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.35)' };
    }
    if (claim.status === 'approved') {
      if (handover?.status === 'suspended') {
        return { label: 'Handover Suspended', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.35)' };
      }
      if (handover?.status === 'handover_pending') {
        return { label: 'Awaiting Confirmation', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.35)' };
      }
      if (handover?.status === 'scheduled' || handover?.scheduled_at) {
        return { label: 'Return Arranged', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', border: 'rgba(96, 165, 250, 0.35)' };
      }
      return { label: 'Approved', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' };
    }
    return { label: 'Pending', color: 'var(--primary-light)', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.35)' };
  };

  const getRiskBadge = (claim) => {
    const risk = claim.private_proof?.riskLevel || (claim.requires_admin_review ? 'high' : 'low');
    if (risk === 'high' || claim.status === 'disputed') {
      return <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)' }}>HIGH RISK / HELD</span>;
    }
    if (risk === 'elevated') {
      return <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>SENSITIVE (DIRECT RETURN)</span>;
    }
    return <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>LOW RISK</span>;
  };

  // Filtered dataset for Admin Monitoring Dashboard
  const adminClaimsList = useMemo(() => {
    const baseList = claimsData.allClaims && claimsData.allClaims.length > 0
      ? claimsData.allClaims
      : claimsData.adminQueue;

    return baseList.filter((claim) => {
      // 1. Search Query
      if (adminSearch.trim()) {
        const query = adminSearch.toLowerCase();
        const titleMatch = (claim.found_item?.title || '').toLowerCase().includes(query) || (claim.lost_item?.title || '').toLowerCase().includes(query);
        const claimantMatch = (claim.claimant_id || '').toLowerCase().includes(query);
        const reasonMatch = (claim.decision_reason || '').toLowerCase().includes(query);
        const locationMatch = (claim.handover?.proposed_location || '').toLowerCase().includes(query);
        if (!titleMatch && !claimantMatch && !reasonMatch && !locationMatch) return false;
      }

      // 2. Status Filter
      if (adminStatusFilter !== 'all') {
        const detailed = getDetailedStatus(claim).label.toLowerCase().replace(/\s+/g, '_');
        if (adminStatusFilter === 'pending' && claim.status !== 'pending') return false;
        if (adminStatusFilter === 'approved' && claim.status !== 'approved') return false;
        if (adminStatusFilter === 'return_arranged' && detailed !== 'return_arranged') return false;
        if (adminStatusFilter === 'awaiting_confirmation' && detailed !== 'awaiting_confirmation') return false;
        if (adminStatusFilter === 'completed' && claim.status !== 'completed') return false;
        if (adminStatusFilter === 'on_hold' && claim.status !== 'under_review') return false;
        if (adminStatusFilter === 'disputed' && claim.status !== 'disputed') return false;
        if (adminStatusFilter === 'rejected' && claim.status !== 'rejected') return false;
      }

      // 3. Category Filter
      if (adminCategoryFilter !== 'all') {
        const cat = (claim.found_item?.category || '').toLowerCase();
        if (cat !== adminCategoryFilter.toLowerCase()) return false;
      }

      // 4. Risk Filter
      if (adminRiskFilter !== 'all') {
        const risk = claim.private_proof?.riskLevel || (claim.requires_admin_review ? 'high' : 'low');
        if (risk !== adminRiskFilter) return false;
      }

      return true;
    });
  }, [claimsData.allClaims, claimsData.adminQueue, adminSearch, adminStatusFilter, adminCategoryFilter, adminRiskFilter]);

  // Compute admin summary metrics
  const adminMetrics = useMemo(() => {
    const baseList = claimsData.allClaims || [];
    return {
      total: baseList.length,
      directReturns: baseList.filter((c) => ['approved', 'completed'].includes(c.status)).length,
      onHold: baseList.filter((c) => c.status === 'under_review').length,
      disputed: baseList.filter((c) => c.status === 'disputed').length,
      completed: baseList.filter((c) => c.status === 'completed').length,
    };
  }, [claimsData.allClaims]);

  const currentList = subTab === 'outgoing' 
    ? claimsData.outgoing 
    : subTab === 'incoming' 
    ? claimsData.incoming 
    : adminClaimsList;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Toast notification */}
      {successToast && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Sub Tabs Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSubTab('incoming')}
            style={{
              background: subTab === 'incoming' ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.04)',
              color: subTab === 'incoming' ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.45rem 0.95rem',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            id="tab-sub-incoming"
          >
            <Handshake size={15} /> Incoming Claims on Found Items ({claimsData.incoming.length})
          </button>

          <button
            type="button"
            onClick={() => setSubTab('outgoing')}
            style={{
              background: subTab === 'outgoing' ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.04)',
              color: subTab === 'outgoing' ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.45rem 0.95rem',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            id="tab-sub-outgoing"
          >
            <UserCheck size={15} /> My Outgoing Claims ({claimsData.outgoing.length})
          </button>

          {claimsData.isAdmin && (
            <button
              type="button"
              onClick={() => setSubTab('admin')}
              style={{
                background: subTab === 'admin' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)',
                color: subTab === 'admin' ? '#000' : '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.45rem 0.95rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              id="tab-sub-admin"
            >
              <ShieldAlert size={15} /> Admin Monitoring & Control ({claimsData.allClaims?.length || claimsData.adminQueue?.length || 0})
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={loadClaims}
          disabled={loading}
          style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* ADMIN MONITORING DASHBOARD HEADER & FILTERS */}
      {subTab === 'admin' && claimsData.isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Admin Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>Total Platform Claims</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>{adminMetrics.total}</div>
            </div>
            <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid #34d399' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>Direct Returns / Active</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>{adminMetrics.directReturns}</div>
            </div>
            <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid #facc15' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>On Administrative Hold</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#facc15' }}>{adminMetrics.onHold}</div>
            </div>
            <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid #fb7185' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>Disputes / Flagged</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fb7185' }}>{adminMetrics.disputed}</div>
            </div>
            <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>Completed Returns</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8' }}>{adminMetrics.completed}</div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Search claims by item, user ID, location, or reason..."
                className="form-input"
                style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="form-input"
                style={{ width: 'auto', fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                value={adminStatusFilter}
                onChange={(e) => setAdminStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="return_arranged">Return Arranged</option>
                <option value="awaiting_confirmation">Awaiting Confirmation</option>
                <option value="completed">Completed & Returned</option>
                <option value="on_hold">On Hold (Admin Review)</option>
                <option value="disputed">Disputed</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                className="form-input"
                style={{ width: 'auto', fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                value={adminCategoryFilter}
                onChange={(e) => setAdminCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="electronics">Electronics</option>
                <option value="jewelry">Jewelry</option>
                <option value="clothing">Clothing</option>
                <option value="documents">Documents</option>
                <option value="wallets">Wallets</option>
                <option value="cash">Cash</option>
                <option value="keys">Keys</option>
                <option value="other">Other</option>
              </select>

              <select
                className="form-input"
                style={{ width: 'auto', fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                value={adminRiskFilter}
                onChange={(e) => setAdminRiskFilter(e.target.value)}
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low Risk</option>
                <option value="elevated">Elevated (Sensitive)</option>
                <option value="high">High Risk</option>
              </select>

              {(adminSearch || adminStatusFilter !== 'all' || adminCategoryFilter !== 'all' || adminRiskFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setAdminSearch('');
                    setAdminStatusFilter('all');
                    setAdminCategoryFilter('all');
                    setAdminRiskFilter('all');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.8rem' }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Claims List Area */}
      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem', color: 'var(--primary-light)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading claims and handover records...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <ShieldCheck size={26} color="var(--primary-light)" />
          </div>
          <h4 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>
            {subTab === 'outgoing' 
              ? 'No active outgoing claims' 
              : subTab === 'incoming' 
              ? 'No incoming claims for your found items' 
              : 'No claims match your filters'}
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto' }}>
            {subTab === 'outgoing'
              ? 'When you locate your lost belongings via AI matches or the Community Feed, click "Claim Item" to submit ownership proof.'
              : subTab === 'incoming'
              ? 'When another user files a claim on an item you reported as found, their proof and verification request will appear here for you to approve directly.'
              : 'Adjust your search query or filter settings above to view claims across the platform.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {currentList.map((claim) => {
            const handover = claim.handover;
            const statusInfo = getDetailedStatus(claim);
            const isApproved = claim.status === 'approved' || claim.status === 'completed';
            const isCompleted = claim.status === 'completed';
            const auditTrail = claim.private_proof?.auditTrail || [];
            const isTimelineOpen = expandedTimelineClaimId === claim.id;
            const isProofOpen = expandedProofClaimId === claim.id;

            return (
              <div 
                key={claim.id} 
                className="glass-card" 
                style={{ 
                  padding: '1.5rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1rem',
                  borderLeft: `4px solid ${statusInfo.color}`
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '1.15rem', color: '#fff', margin: 0 }}>
                        {subTab === 'outgoing' 
                          ? `Claim for: ${claim.found_item?.title || 'Found Item'}` 
                          : `Claim on: ${claim.found_item?.title || 'Found Report'}`}
                      </h4>
                      
                      {/* Detailed Status Badge */}
                      <span 
                        className="badge" 
                        style={{ 
                          background: statusInfo.bg, 
                          color: statusInfo.color, 
                          border: `1px solid ${statusInfo.border}`,
                          fontWeight: 600,
                          fontSize: '0.78rem'
                        }}
                      >
                        {statusInfo.label}
                      </span>

                      {/* Risk Badge */}
                      {getRiskBadge(claim)}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span>Submitted: <strong>{new Date(claim.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                      {claim.found_item?.category && (
                        <span>Category: <strong>{claim.found_item.category}</strong></span>
                      )}
                      {subTab === 'admin' && (
                        <span>Claimant ID: <code style={{ fontSize: '0.75rem' }}>{claim.claimant_id?.slice(0, 8)}...</code></span>
                      )}
                    </div>
                  </div>

                  {/* Linked Lost Report */}
                  <div style={{ fontSize: '0.82rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.35rem 0.65rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                    <span>Linked Lost Report: </span>
                    <strong style={{ color: '#fff' }}>{claim.lost_item?.title || 'Lost Item'}</strong>
                  </div>
                </div>

                {/* Explanation Message */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.25rem', fontWeight: 600 }}>Claimant Explanation:</div>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                    {claim.claim_message}
                  </p>
                </div>

                {/* Proof Accordion Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedProofClaimId(isProofOpen ? null : claim.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
                  >
                    <Lock size={13} /> {isProofOpen ? 'Hide Private Proof' : 'View Private Ownership Proof'}
                    {isProofOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {isProofOpen && (
                    <div style={{ marginTop: '0.5rem', background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', color: 'var(--text-muted)' }}>
                        {claim.private_proof?.serialHint && (
                          <div><strong>Serial Identifier:</strong> {claim.private_proof.serialHint}</div>
                        )}
                        {claim.private_proof?.distinctiveMarks && (
                          <div><strong>Distinctive Marks:</strong> {claim.private_proof.distinctiveMarks}</div>
                        )}
                        {claim.private_proof?.lockScreenHint && (
                          <div><strong>Secret / Passcode Hint:</strong> {claim.private_proof.lockScreenHint}</div>
                        )}
                        {!claim.private_proof?.serialHint && !claim.private_proof?.distinctiveMarks && !claim.private_proof?.lockScreenHint && (
                          <div>{claim.private_proof?.text || 'Standard ownership confirmation submitted.'}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes or Admin Decisions */}
                {claim.decision_reason && (
                  <div style={{ fontSize: '0.82rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <strong>Status Note:</strong> {claim.decision_reason}
                  </div>
                )}

                {/* HANDOVER COORDINATION SECTION */}
                {isApproved && handover && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 600, fontSize: '0.95rem' }}>
                        <Handshake size={16} /> In-App Return Handover Coordination
                      </div>
                      <span className="badge" style={{ background: isCompleted ? 'rgba(56, 189, 248, 0.15)' : 'rgba(99, 102, 241, 0.15)', color: isCompleted ? '#38bdf8' : 'var(--primary-light)' }}>
                        Handover: {handover.status.toUpperCase()}
                      </span>
                    </div>

                    {coordinatingHandoverId === handover.id ? (
                      /* Coordinate Form */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0, 0, 0, 0.25)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>Proposed Public Meeting Location *</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. Campus Police Station, Student Union Front Desk, Central Library"
                            value={handoverLocation}
                            onChange={(e) => setHandoverLocation(e.target.value)}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Proposed Date & Time</label>
                            <input 
                              type="datetime-local" 
                              className="form-input"
                              value={handoverTime}
                              onChange={(e) => setHandoverTime(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Meeting Notes</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="e.g. Meet by reception counter, wearing blue jacket"
                              value={handoverNotes}
                              onChange={(e) => setHandoverNotes(e.target.value)}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                          <button type="button" onClick={() => setCoordinatingHandoverId(null)} className="btn btn-secondary btn-sm">
                            Cancel
                          </button>
                          <button type="button" onClick={() => handleSaveHandover(handover.id)} className="btn btn-primary btn-sm">
                            Save Handover Plan
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Handover Details View */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <MapPin size={14} color="#f43f5e" />
                            <span>Location: <strong style={{ color: '#fff' }}>{handover.proposed_location}</strong></span>
                          </div>
                          {handover.scheduled_at && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Calendar size={14} color="var(--primary-light)" />
                              <span>Time: <strong style={{ color: '#fff' }}>{new Date(handover.scheduled_at).toLocaleString()}</strong></span>
                            </div>
                          )}
                          {handover.notes && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Info size={14} color="var(--text-dim)" />
                              <span>Notes: <em>{handover.notes}</em></span>
                            </div>
                          )}
                          {!isCompleted && handover.status !== 'suspended' && (
                            <button
                              type="button"
                              onClick={() => {
                                setHandoverLocation(handover.proposed_location || '');
                                setHandoverTime(handover.scheduled_at ? handover.scheduled_at.slice(0, 16) : '');
                                setHandoverNotes(handover.notes || '');
                                setCoordinatingHandoverId(handover.id);
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline' }}
                            >
                              Arrange / Edit Return Details
                            </button>
                          )}
                        </div>

                        {/* Dual Confirmation Status Pills */}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', borderRadius: '4px', background: handover.finder_confirmed_at ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: handover.finder_confirmed_at ? '#34d399' : 'var(--text-dim)', border: '1px solid currentColor', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {handover.finder_confirmed_at ? <Check size={12} /> : <Clock size={12} />}
                            Finder Handed Over: {handover.finder_confirmed_at ? 'Confirmed' : 'Pending'}
                          </span>
                          <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', borderRadius: '4px', background: handover.claimant_confirmed_at ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: handover.claimant_confirmed_at ? '#34d399' : 'var(--text-dim)', border: '1px solid currentColor', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {handover.claimant_confirmed_at ? <Check size={12} /> : <Clock size={12} />}
                            Claimant Received: {handover.claimant_confirmed_at ? 'Confirmed' : 'Pending'}
                          </span>
                        </div>

                        {/* Confirmation Actions */}
                        {!isCompleted && handover.status !== 'suspended' && (
                          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                            {subTab === 'incoming' && !handover.finder_confirmed_at && (
                              <button
                                type="button"
                                onClick={() => handleConfirmHandover(handover.id, 'finder_handed_over')}
                                disabled={actionLoadingId === handover.id}
                                className="btn btn-primary btn-sm"
                              >
                                {actionLoadingId === handover.id ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                                Confirm I Handed Over Item
                              </button>
                            )}

                            {subTab === 'outgoing' && !handover.claimant_confirmed_at && (
                              <button
                                type="button"
                                onClick={() => handleConfirmHandover(handover.id, 'claimant_received')}
                                disabled={actionLoadingId === handover.id}
                                className="btn btn-primary btn-sm"
                                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                              >
                                {actionLoadingId === handover.id ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                                Confirm I Received My Item
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ACTIVITY TIMELINE / AUDIT TRAIL COLLAPSIBLE */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedTimelineClaimId(isTimelineOpen ? null : claim.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: 0 }}
                  >
                    <History size={13} /> {isTimelineOpen ? 'Hide Activity Timeline' : `View Activity Timeline & Audit Log (${auditTrail.length} events)`}
                    {isTimelineOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {isTimelineOpen && (
                    <div style={{ marginTop: '0.75rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Chronological Claim & Handover Audit Trail:
                      </div>
                      {auditTrail.length === 0 ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>No prior audit entries recorded.</div>
                      ) : (
                        auditTrail.map((entry, idx) => (
                          <div key={entry.id || idx} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem', alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--text-dim)', minWidth: '130px', fontSize: '0.75rem' }}>
                              {new Date(entry.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ 
                              padding: '0.1rem 0.4rem', 
                              borderRadius: '3px', 
                              fontSize: '0.7rem', 
                              fontWeight: 700, 
                              textTransform: 'uppercase',
                              background: entry.actorRole === 'admin' ? '#f59e0b' : entry.actorRole === 'finder' ? '#3b82f6' : entry.actorRole === 'system' ? '#8b5cf6' : '#10b981',
                              color: entry.actorRole === 'admin' ? '#000' : '#fff'
                            }}>
                              {entry.actorRole}
                            </span>
                            <div style={{ flex: 1 }}>
                              <strong style={{ color: '#fff' }}>{entry.action.replace(/_/g, ' ')}</strong>
                              {entry.reason && <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Note: {entry.reason}</div>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* ACTION BUTTONS (Finder, Claimant, Admin) */}
                <div style={{ display: 'flex', gap: '0.65rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                  
                  {/* Claimant Action: Cancel claim */}
                  {subTab === 'outgoing' && ['pending', 'under_review'].includes(claim.status) && (
                    <button
                      type="button"
                      onClick={() => handleReviewAction(claim.id, 'cancel')}
                      disabled={actionLoadingId === claim.id}
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#fb7185' }}
                    >
                      Cancel Claim
                    </button>
                  )}

                  {/* Finder Actions: Direct Return Workflow */}
                  {subTab === 'incoming' && claim.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReviewAction(claim.id, 'request_admin_review')}
                        disabled={actionLoadingId === claim.id}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                        title="Escalate claim to security reviewer if suspicious"
                      >
                        <ShieldAlert size={14} /> Request Admin Review
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewAction(claim.id, 'reject')}
                        disabled={actionLoadingId === claim.id}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#fb7185' }}
                      >
                        Reject Claim
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewAction(claim.id, 'approve')}
                        disabled={actionLoadingId === claim.id}
                        className="btn btn-primary btn-sm"
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' }}
                        id="finder-direct-approve-btn"
                      >
                        {actionLoadingId === claim.id ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                        Approve Claim
                      </button>
                    </>
                  )}

                  {/* Finder Action for Approved Claims without Scheduled Handover: Arrange Return */}
                  {subTab === 'incoming' && claim.status === 'approved' && handover && handover.status === 'proposed' && (
                    <button
                      type="button"
                      onClick={() => {
                        setHandoverLocation(handover.proposed_location || '');
                        setHandoverTime(handover.scheduled_at ? handover.scheduled_at.slice(0, 16) : '');
                        setHandoverNotes(handover.notes || '');
                        setCoordinatingHandoverId(handover.id);
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      <MapPin size={14} /> Arrange Return Handover
                    </button>
                  )}

                  {/* Admin Intervention Controls (Available in Admin View or when Admin views incoming contested claim) */}
                  {(subTab === 'admin' || (claimsData.isAdmin && (claim.status === 'under_review' || claim.status === 'disputed'))) && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Place on hold (if pending or approved) */}
                      {['pending', 'approved'].includes(claim.status) && (
                        <button
                          type="button"
                          onClick={() => handleReviewAction(claim.id, 'admin_hold')}
                          disabled={actionLoadingId === claim.id}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.35)' }}
                          title="Place claim on administrative hold"
                        >
                          <PauseCircle size={14} /> Place on Hold
                        </button>
                      )}

                      {/* Release hold (if under_review) */}
                      {claim.status === 'under_review' && (
                        <button
                          type="button"
                          onClick={() => handleReviewAction(claim.id, 'admin_release_hold')}
                          disabled={actionLoadingId === claim.id}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.35)' }}
                          title="Clear hold and allow finder direct return"
                        >
                          <PlayCircle size={14} /> Release Hold
                        </button>
                      )}

                      {/* Suspend handover (if active handover exists) */}
                      {handover && handover.status !== 'suspended' && handover.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleReviewAction(claim.id, 'admin_suspend_handover')}
                          disabled={actionLoadingId === claim.id}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.35)' }}
                          title="Suspend handover due to fraud or dispute"
                        >
                          Suspend Handover
                        </button>
                      )}

                      {/* Flag or resolve dispute */}
                      {claim.status !== 'disputed' && (
                        <button
                          type="button"
                          onClick={() => handleReviewAction(claim.id, 'admin_dispute')}
                          disabled={actionLoadingId === claim.id}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#fb7185' }}
                        >
                          Flag Disputed
                        </button>
                      )}

                      {/* Request evidence */}
                      <button
                        type="button"
                        onClick={() => handleReviewAction(claim.id, 'request_evidence')}
                        disabled={actionLoadingId === claim.id}
                        className="btn btn-secondary btn-sm"
                      >
                        Request Evidence
                      </button>

                      {/* Admin Reject Override */}
                      <button
                        type="button"
                        onClick={() => handleReviewAction(claim.id, 'admin_reject')}
                        disabled={actionLoadingId === claim.id}
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#fb7185' }}
                      >
                        Admin Reject
                      </button>

                      {/* Admin Approve Override */}
                      {claim.status !== 'approved' && claim.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleReviewAction(claim.id, 'admin_approve')}
                          disabled={actionLoadingId === claim.id}
                          className="btn btn-primary btn-sm"
                          style={{ background: '#f59e0b', color: '#000', fontWeight: 700 }}
                          id="admin-override-approve-btn"
                        >
                          {actionLoadingId === claim.id ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                          Admin Approve
                        </button>
                      )}
                    </div>
                  )}

                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
