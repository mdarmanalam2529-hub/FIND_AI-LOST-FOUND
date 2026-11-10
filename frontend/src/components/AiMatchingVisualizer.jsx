import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  Info,
  Loader2,
  Lock,
  Tag
} from 'lucide-react';
import TiltCard from './TiltCard';

/**
 * AiMatchingVisualizer - Clean, professional AI match analysis component.
 * Features:
 * - Transparent AI scoring with explicit ownership disclaimer
 * - Detailed breakdown explaining why items match (text, visual, category, timeline)
 * - Clear distinction between algorithmic similarity and verified ownership
 * - Fully accessible with prefers-reduced-motion respect
 */
export default function AiMatchingVisualizer({
  isLoading = false,
  results = [],
  expandedBreakdowns = {},
  onToggleBreakdown,
  renderCandidateActions,
}) {
  const [activeStep, setActiveStep] = useState(0);

  // Diagnostic phases for scanning state
  const scanPhases = [
    { label: 'Analyzing Description Semantics', detail: 'Evaluating semantic text meaning and physical attributes' },
    { label: 'Evaluating Visual Features', detail: 'Comparing photograph characteristics with CLIP vision embeddings' },
    { label: 'Checking Temporal & Spatial Proximity', detail: 'Cross-referencing reported dates and general location proximity' },
    { label: 'Ranking Candidate Matches', detail: 'Finalizing weighted similarity scores across open reports' },
  ];

  useEffect(() => {
    if (!isLoading) {
      return;
    }
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % scanPhases.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [isLoading, scanPhases.length]);

  // Loading State - Clean, professional, trustworthy
  if (isLoading) {
    return (
      <div className="ai-matching-scanning-wrap" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <div 
          style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            background: 'var(--primary-subtle)', 
            border: '2px solid var(--primary-border)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: 'var(--primary)',
          }}
        >
          <Loader2 size={30} className="spin" />
        </div>

        <div style={{ maxWidth: '440px', margin: '0 auto' }}>
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.45rem', 
              background: 'var(--primary-subtle)', 
              color: 'var(--primary)', 
              padding: '0.3rem 0.85rem', 
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '0.85rem',
              border: '1px solid var(--primary-border)'
            }}
          >
            <Sparkles size={13} /> Step {activeStep + 1} of {scanPhases.length}
          </div>

          <h4 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', color: 'var(--text-main)', fontWeight: 700 }}>
            {scanPhases[activeStep].label}
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', minHeight: '38px', lineHeight: 1.5 }}>
            {scanPhases[activeStep].detail}
          </p>

          {/* Progress Track */}
          <div 
            style={{ 
              width: '100%', 
              height: '5px', 
              background: 'var(--border-subtle)', 
              borderRadius: 'var(--radius-full)', 
              overflow: 'hidden', 
              marginTop: '1.25rem',
            }}
          >
            <div 
              style={{
                height: '100%',
                width: `${((activeStep + 1) / scanPhases.length) * 100}%`,
                background: 'var(--primary)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // No Candidates Found
  if (!results || results.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--text-dim)' }}>
          <Info size={24} />
        </div>
        <h4 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
          No Candidate Matches Found
        </h4>
        <p style={{ fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
          There are currently no open reports with matching characteristics. We continue scanning as new community reports are submitted.
        </p>
      </div>
    );
  }

  // Real Results Reveal
  return (
    <div className="ai-results-reveal-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Mandatory Trust & Privacy Disclaimer Banner */}
      <div 
        className="trust-banner"
        style={{
          background: 'var(--warning-subtle)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          padding: '0.95rem 1.15rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start',
        }}
      >
        <ShieldAlert size={18} style={{ color: 'var(--warning-accent)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.15rem' }}>
            AI Similarity Notice: Suggestions are not proof of ownership
          </strong>
          Similarity scores reflect algorithmic comparisons of descriptions, categories, and photos. To safeguard rightful owners, submitting a claim requires verifiable private proof (such as serial numbers or unique identifying marks).
        </div>
      </div>

      {results.map((candidate, idx) => {
        const isExpanded = Boolean(expandedBreakdowns[candidate.id]);
        const score = candidate.score || 0;
        
        // Exact real API score colors
        const scoreColor = score >= 70 ? 'var(--found-accent)' : score >= 50 ? 'var(--primary)' : 'var(--warning-accent)';
        const scoreBadgeClass = score >= 70 ? 'badge-found' : score >= 50 ? 'badge-primary' : 'badge-warning';
        const confidenceLabel = score >= 70 ? 'High Similarity' : score >= 50 ? 'Moderate Match' : 'Potential Match';

        return (
          <TiltCard
            key={candidate.id}
            maxTilt={2}
            scale={1.01}
          >
            <div 
              className="glass-card" 
              style={{ 
                padding: '1.35rem', 
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                position: 'relative',
              }}
            >
              {/* Card Header with Score Ring */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  
                  {/* Score Pill */}
                  <div 
                    style={{ 
                      padding: '0.5rem 0.85rem', 
                      borderRadius: 'var(--radius-md)',
                      background: score >= 70 ? 'var(--found-subtle)' : score >= 50 ? 'var(--primary-subtle)' : 'var(--warning-subtle)',
                      border: `1px solid ${score >= 70 ? 'var(--found-border)' : score >= 50 ? 'var(--primary-border)' : 'var(--warning-border)'}`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                      {score}%
                    </div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                      Match
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <span className={`badge ${scoreBadgeClass}`}>
                        <Sparkles size={12} /> {confidenceLabel}
                      </span>
                      <span className="badge badge-neutral">
                        #{idx + 1} Candidate
                      </span>
                      {candidate.category && (
                        <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                          <Tag size={11} /> {candidate.category}
                        </span>
                      )}
                    </div>
                    <h4 style={{ fontSize: '1.12rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      {candidate.title}
                    </h4>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {candidate.incident_date && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={13} /> {candidate.incident_date}
                    </span>
                  )}
                  {candidate.location_description && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={13} color="var(--primary)" /> {candidate.location_description}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, marginBottom: '1rem' }}>
                {candidate.description}
              </p>

              {/* Action Buttons & Breakdown Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                {/* Breakdown Toggle */}
                {onToggleBreakdown && (
                  <button
                    type="button"
                    onClick={() => onToggleBreakdown(candidate.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: 0,
                    }}
                  >
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    {isExpanded ? 'Hide Similarity Breakdown' : 'Inspect Similarity Breakdown'}
                  </button>
                )}

                {/* Candidate Action Buttons passed from Dashboard */}
                {renderCandidateActions && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {renderCandidateActions(candidate)}
                  </div>
                )}
              </div>

              {/* Detailed Breakdown Drawer */}
              {isExpanded && candidate.breakdown && (
                <div 
                  style={{
                    marginTop: '0.85rem',
                    padding: '1rem',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.85rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Text Similarity:</span>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                      {Math.round((candidate.breakdown.text_similarity || 0) * 100)}%
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Visual CLIP Similarity:</span>
                    <div style={{ fontWeight: 700, color: 'var(--accent-teal)', fontSize: '0.95rem' }}>
                      {candidate.breakdown.image_similarity != null ? `${Math.round(candidate.breakdown.image_similarity * 100)}%` : 'No Photo'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Category Agreement:</span>
                    <div style={{ fontWeight: 700, color: candidate.breakdown.category_match ? 'var(--found-accent)' : 'var(--text-dim)', fontSize: '0.95rem' }}>
                      {candidate.breakdown.category_match ? 'Exact Match' : 'Unmatched'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>Location Proximity:</span>
                    <div style={{ fontWeight: 700, color: candidate.breakdown.location_match ? 'var(--found-accent)' : 'var(--text-dim)', fontSize: '0.95rem' }}>
                      {candidate.breakdown.location_match ? 'In Radius' : 'Distant'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TiltCard>
        );
      })}
    </div>
  );
}
