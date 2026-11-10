import React, { useState } from 'react';
import { claimsService } from '../services/claimsService';
import { ShieldCheck, AlertCircle, Loader2, X, Lock, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ClaimModal({ foundItem, preselectedLostItem = null, userReports = [], onClose, onClaimSubmitted }) {
  const [selectedLostItemId, setSelectedLostItemId] = useState(preselectedLostItem?.id || '');
  const [claimMessage, setClaimMessage] = useState('');
  const [serialHint, setSerialHint] = useState('');
  const [distinctiveMarks, setDistinctiveMarks] = useState('');
  const [lockScreenHint, setLockScreenHint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filter user's open lost reports
  const eligibleLostReports = userReports.filter(
    (r) => r.item_type === 'lost' && r.status === 'open'
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const lostId = preselectedLostItem?.id || selectedLostItemId;
    if (!lostId) {
      setError('Please select one of your open lost item reports to link to this claim.');
      return;
    }

    if (!claimMessage.trim() || claimMessage.trim().length < 5) {
      setError('Please provide a claim explanation message (minimum 5 characters).');
      return;
    }

    setSubmitting(true);

    try {
      const privateProof = {
        serialHint: serialHint.trim() || null,
        distinctiveMarks: distinctiveMarks.trim() || null,
        lockScreenHint: lockScreenHint.trim() || null,
      };

      const result = await claimsService.submitClaim({
        foundItemId: foundItem.id,
        lostItemId: lostId,
        claimMessage: claimMessage.trim(),
        privateProof,
      });

      setSuccessMessage(result.message || 'Claim submitted successfully!');
      setTimeout(() => {
        if (onClaimSubmitted) onClaimSubmitted(result.claim);
        onClose();
      }, 1800);
    } catch (err) {
      console.error('[ClaimModal] Submission error:', err);
      setError(err.message || 'Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      id="claim-modal"
    >
      <div 
        className="glass-card modal-content-card" 
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '2rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-modal)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <div className="brand-icon-wrap" style={{ width: '28px', height: '28px' }}>
                <ShieldCheck size={16} color="#ffffff" />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Claim Found Item</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Claiming: <strong style={{ color: 'var(--text-main)' }}>{foundItem.title}</strong>
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
            aria-label="Close claim dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage ? (
          <div style={{ background: 'var(--found-subtle)', border: '1px solid var(--found-border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', textAlign: 'center', color: 'var(--found-accent)' }}>
            <CheckCircle2 size={36} style={{ margin: '0 auto 0.75rem', color: 'var(--found-accent)' }} />
            <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Claim Submitted</h4>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {error && (
              <div style={{ background: 'var(--lost-subtle)', border: '1px solid var(--lost-border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: 'var(--lost-accent)', fontSize: '0.88rem' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            {/* Select Associated Lost Report */}
            {preselectedLostItem ? (
              <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.25rem' }}>Linked Lost Report</div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{preselectedLostItem.title}</div>
              </div>
            ) : eligibleLostReports.length === 0 ? (
              <div style={{ background: 'var(--warning-subtle)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', color: 'var(--warning-accent)', fontSize: '0.88rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>No Active Lost Report Found</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  To establish legitimate ownership and prevent false claims, you must have an active Lost Report in the database matching this item.
                </p>
                <Link to="/report-lost" className="btn btn-lost btn-sm" style={{ display: 'inline-flex' }}>
                  Create Lost Report First
                </Link>
              </div>
            ) : (
              <div>
                <label className="form-label" htmlFor="select-lost-report">Select Your Matching Lost Report *</label>
                <select
                  id="select-lost-report"
                  className="form-input"
                  value={selectedLostItemId}
                  onChange={(e) => setSelectedLostItemId(e.target.value)}
                  required
                >
                  <option value="">-- Choose your lost report --</option>
                  {eligibleLostReports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.category} - {r.incident_date})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Explanation Message */}
            <div>
              <label className="form-label" htmlFor="claim-message">Claim Explanation *</label>
              <textarea
                id="claim-message"
                className="form-input"
                rows={3}
                placeholder="Explain why this item is yours, where you believe you lost it, and any matching context..."
                value={claimMessage}
                onChange={(e) => setClaimMessage(e.target.value)}
                required
              />
            </div>

            {/* Private Verification Proof Box */}
            <div style={{ border: '1px solid var(--primary-border)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'var(--primary-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                <Lock size={15} /> Private Ownership Proof (Restricted)
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.85rem', lineHeight: 1.45 }}>
                These proof clues will only be visible to the verified finder and platform reviewers. Never provide bank credentials or account passwords.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Serial Number / Partial Identifier (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                    placeholder="e.g. Serial ending in ...789X, IMEI prefix, card initials"
                    value={serialHint}
                    onChange={(e) => setSerialHint(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Distinctive Scratches, Stickers, or Marks (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                    placeholder="e.g. Small scratch on bottom rim, red sticker on case"
                    value={distinctiveMarks}
                    onChange={(e) => setDistinctiveMarks(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Lock Screen Wallpaper / Contents Clue (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                    placeholder="e.g. Photo of a golden retriever, green keychain inside"
                    value={lockScreenHint}
                    onChange={(e) => setLockScreenHint(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Safety policy notice */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Notice: Submitting false ownership claims is strictly prohibited. High-risk items (electronics, jewelry) or contested reports automatically require security administrator verification.
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={submitting}>
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary btn-sm" 
                disabled={submitting || (!preselectedLostItem && eligibleLostReports.length === 0)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {submitting ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
                Submit Verification Claim
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
