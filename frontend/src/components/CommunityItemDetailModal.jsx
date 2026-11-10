import React, { useState } from 'react';
import {
  X,
  MapPin,
  Calendar,
  Tag,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  ZoomIn,
  Package,
  CheckCircle2,
  Clock,
  Lock,
} from 'lucide-react';

export default function CommunityItemDetailModal({
  item,
  onClose,
  onOpenClaim,
  onOpenAiMatches,
  onOpenReportAbuse,
  onNavigateToMyReports,
}) {
  const [imageZoomed, setImageZoomed] = useState(false);

  if (!item) return null;

  const isFound = item.item_type === 'found';
  const isLost = item.item_type === 'lost';
  const isResolved = item.status === 'returned' || item.status === 'matched';

  const categoryLabels = {
    electronics: 'Electronics',
    'keys-wallets': 'Keys & Wallets',
    clothing: 'Clothing & Apparel',
    documents: 'Documents & IDs',
    jewelry: 'Jewelry & Watches',
    other: 'Other Items',
  };

  const formattedCategory = categoryLabels[item.category] || item.category || 'General';

  const formattedDate = item.incident_date
    ? new Date(item.incident_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : item.created_at
    ? new Date(item.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recent';

  return (
    <>
      <div
        className="modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-item-detail-title"
      >
        <div
          className="glass-card"
          style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 0,
            borderRadius: '18px',
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.75rem',
              borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
              background: 'var(--bg-subtle, #f8fafc)',
              borderTopLeftRadius: '18px',
              borderTopRightRadius: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span
                className={isLost ? 'badge badge-lost' : 'badge badge-found'}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem', fontWeight: 600 }}
              >
                {isLost ? 'Lost Item' : 'Found Item'}
              </span>
              <span
                style={{
                  fontSize: '0.78rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '20px',
                  background: isResolved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                  color: isResolved ? '#10b981' : 'var(--primary, #2563eb)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {isResolved ? (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Resolved</span>
                  </>
                ) : (
                  <>
                    <Clock size={13} />
                    <span>Active Listing</span>
                  </>
                )}
              </span>
              {item.is_own_listing && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '12px',
                    background: 'rgba(99, 102, 241, 0.12)',
                    color: '#6366f1',
                    fontWeight: 600,
                  }}
                >
                  Your Listing
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted, #64748b)',
                padding: '0.4rem',
                borderRadius: '8px',
                display: 'flex',
              }}
              aria-label="Close detail modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top Section: Photo and Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: item.signed_image_url ? '180px 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
              {item.signed_image_url ? (
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '180px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#0f172a',
                    cursor: 'pointer',
                  }}
                  onClick={() => setImageZoomed(true)}
                  title="Click to view full photo"
                >
                  <img
                    src={item.signed_image_url}
                    alt={item.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      color: '#ffffff',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ZoomIn size={14} />
                    <span>Zoom</span>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '120px',
                    borderRadius: '12px',
                    background: 'var(--bg-subtle, #f1f5f9)',
                    border: '1px dashed var(--border-subtle, #cbd5e1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-dim, #94a3b8)',
                    gap: '0.35rem',
                  }}
                >
                  <Package size={32} />
                  <span style={{ fontSize: '0.78rem' }}>No photo attached</span>
                </div>
              )}

              {/* Title & Core Details */}
              <div>
                <h2
                  id="community-item-detail-title"
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 700,
                    margin: '0 0 0.75rem 0',
                    color: 'var(--text-main, #0f172a)',
                    lineHeight: 1.3,
                  }}
                >
                  {item.title}
                </h2>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', fontSize: '0.88rem', color: 'var(--text-muted, #64748b)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Tag size={16} color="var(--primary, #2563eb)" />
                    <span>{formattedCategory}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={16} color="#ef4444" />
                    <span>{item.location_description || 'Campus Grounds'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={16} color="#10b981" />
                    <span>{formattedDate}</span>
                  </div>
                </div>

                {/* Reporter verification pill */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '1rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    background: 'rgba(37, 99, 235, 0.06)',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                    fontSize: '0.82rem',
                    color: 'var(--text-main, #0f172a)',
                  }}
                >
                  <ShieldCheck size={16} color="var(--primary, #2563eb)" />
                  <span>
                    Reported by <strong>{item.reporter_name || 'Verified Student'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main, #0f172a)', marginBottom: '0.5rem' }}>
                Description & Distinguishing Features
              </h4>
              <div
                style={{
                  background: 'var(--bg-subtle, #f8fafc)',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  fontSize: '0.92rem',
                  lineHeight: 1.6,
                  color: 'var(--text-main, #334155)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {item.description || 'No detailed description provided.'}
              </div>
            </div>

            {/* Privacy & Safe Recovery Assurance */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.9rem 1.1rem',
                borderRadius: '10px',
                background: 'rgba(37, 99, 235, 0.04)',
                border: '1px solid rgba(37, 99, 235, 0.14)',
                fontSize: '0.84rem',
                color: 'var(--text-muted, #475569)',
              }}
            >
              <Lock size={18} color="var(--primary, #2563eb)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Secure Campus Verification:</strong> To protect student privacy, direct phone and email contact are hidden. 
                Claims and handovers are securely processed through FindAI campus verification.
              </div>
            </div>
          </div>

          {/* Modal Footer / Actions */}
          <div
            style={{
              padding: '1.25rem 1.75rem',
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
              background: 'var(--bg-subtle, #f8fafc)',
              borderBottomLeftRadius: '18px',
              borderBottomRightRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Left: Report abuse button */}
            {!item.is_own_listing ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenReportAbuse) onOpenReportAbuse(item);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                }}
                title="Report inappropriate or suspicious listing"
              >
                <ShieldAlert size={16} />
                <span>Report Listing</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToMyReports) onNavigateToMyReports();
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
              >
                Manage My Report
              </button>
            )}

            {/* Right: Primary actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {/* AI Matches button */}
              {onOpenAiMatches && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAiMatches(item);
                  }}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem' }}
                >
                  <Sparkles size={16} color="var(--primary, #2563eb)" />
                  <span>AI Matches</span>
                </button>
              )}

              {/* For Found Items: Claim This Item */}
              {isFound && !item.is_own_listing && !isResolved && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenClaim) onOpenClaim(item);
                  }}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
                >
                  <ShieldCheck size={17} />
                  <span>Claim This Item</span>
                </button>
              )}

              {/* For Lost Items: I Found This / Helpful info */}
              {isLost && !item.is_own_listing && !isResolved && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenAiMatches) onOpenAiMatches(item);
                  }}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
                >
                  <Sparkles size={16} />
                  <span>Check Matching Found Items</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Lightbox */}
      {imageZoomed && item.signed_image_url && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
          onClick={() => setImageZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setImageZoomed(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Close zoom"
          >
            <X size={24} />
          </button>
          <img
            src={item.signed_image_url}
            alt={item.title}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

