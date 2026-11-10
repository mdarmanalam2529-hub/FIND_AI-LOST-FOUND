import React, { useState } from 'react';
import { communityService } from '../services/communityService';
import {
  AlertTriangle,
  X,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  FileText,
  Lock,
} from 'lucide-react';

const REASON_OPTIONS = [
  {
    id: 'inappropriate',
    label: 'Inappropriate content',
    desc: 'Offensive language, images, or violation of campus conduct standards.',
  },
  {
    id: 'incorrect_info',
    label: 'Incorrect or misleading information',
    desc: 'Inaccurate description, false location, or fake photos.',
  },
  {
    id: 'duplicate',
    label: 'Duplicate listing',
    desc: 'This item is already reported elsewhere on the campus board.',
  },
  {
    id: 'suspicious',
    label: 'Suspicious or fraudulent activity',
    desc: 'Potential scam, impersonation, or suspicious recovery demands.',
  },
  {
    id: 'spam',
    label: 'Spam or advertising',
    desc: 'Commercial solicitation, marketing, or automated bot postings.',
  },
  {
    id: 'other',
    label: 'Other violation',
    desc: 'Other policy violation not listed above.',
  },
];

export default function ReportListingModal({ item, onClose, onReportSuccess }) {
  const [selectedReason, setSelectedReason] = useState('inappropriate');
  const [details, setDetails] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedReason) {
      setError('Please select a reason for reporting this listing.');
      return;
    }

    if (selectedReason === 'other' && details.trim().length < 5) {
      setError('Please provide at least 5 characters explaining the issue under "Other".');
      return;
    }

    setSubmitting(true);

    try {
      const res = await communityService.reportListing({
        itemId: item.id,
        reason: selectedReason,
        details: details.trim(),
        evidence: evidence.trim(),
      });

      setSuccess(true);
      setSuccessMessage(res.message || 'Report submitted. Our moderation team will review this listing.');
      if (onReportSuccess) {
        onReportSuccess(item.id);
      }
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('[ReportListingModal] Error:', err);
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          borderRadius: '16px',
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 id="report-modal-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main, #0f172a)' }}>
                Report Listing
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
                Item: <strong>{item?.title || 'Campus Report'}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '0.4rem',
              borderRadius: '8px',
              display: 'flex',
            }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main, #0f172a)', marginBottom: '0.5rem' }}>
              Report Received
            </h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748b)', maxWidth: '400px', margin: '0 auto' }}>
              {successMessage}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Error banner */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  fontSize: '0.88rem',
                  marginBottom: '1.25rem',
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Privacy notice banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'var(--primary-subtle, rgba(37, 99, 235, 0.05))',
                border: '1px solid var(--primary-border, rgba(37, 99, 235, 0.15))',
                fontSize: '0.82rem',
                color: 'var(--text-muted, #475569)',
                marginBottom: '1.25rem',
              }}
            >
              <Lock size={16} color="var(--primary, #2563eb)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Confidential Report:</strong> Your report is anonymous to the listing author. Only verified campus moderators and administrators review complaints.
              </div>
            </div>

            {/* Reasons selection */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.6rem', color: 'var(--text-main, #0f172a)' }}>
                Reason for reporting <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {REASON_OPTIONS.map((opt) => {
                  const isChecked = selectedReason === opt.id;
                  return (
                    <label
                      key={opt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        padding: '0.75rem 0.9rem',
                        borderRadius: '10px',
                        border: isChecked
                          ? '1.5px solid var(--primary, #2563eb)'
                          : '1px solid var(--border-subtle, #e2e8f0)',
                        background: isChecked ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={opt.id}
                        checked={isChecked}
                        onChange={() => setSelectedReason(opt.id)}
                        style={{ marginTop: '3px', accentColor: 'var(--primary, #2563eb)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isChecked ? 'var(--primary, #2563eb)' : 'var(--text-main, #0f172a)' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                          {opt.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Explanation Details */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--text-main, #0f172a)' }}>
                Detailed explanation {selectedReason === 'other' ? <span style={{ color: '#ef4444' }}>*</span> : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe why this listing is inappropriate, inaccurate, or suspicious..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  fontSize: '0.88rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Evidence / Additional Context */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-muted, #64748b)' }}>
                Additional link or evidence <span style={{ fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="text"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="E.g., duplicate listing title, student ID notice, or external context"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="btn btn-secondary"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-danger"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.4rem',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={16} />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

