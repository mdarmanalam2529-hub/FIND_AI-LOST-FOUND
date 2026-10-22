import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Activity
} from 'lucide-react';
import TiltCard from './TiltCard';

/**
 * AiMatchingVisualizer - High-tech futuristic AI matching animation & results component.
 * Features:
 * - 3D Gyroscopic radar and animated laser scanning line
 * - Real-time diagnostic phase ticker during matching computation
 * - Glowing vector neural bridge connecting items
 * - Respects prefers-reduced-motion and preserves real API scores
 */
export default function AiMatchingVisualizer({
  isLoading = false,
  results = [],
  expandedBreakdowns = {},
  onToggleBreakdown,
  renderCandidateActions,
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Diagnostic phases for scanning state
  const scanPhases = [
    { label: 'Tokenizing Semantic Description', detail: 'Generating 384-dimensional dense text vectors' },
    { label: 'CLIP Computer Vision Attention', detail: 'Extracting visual features and perceptual signatures' },
    { label: 'Cross-Modal Vector Projection', detail: 'Aligning multi-modal embeddings across lost & found indices' },
    { label: 'Evaluating Spatial & Temporal Proximity', detail: 'Filtering candidate clusters by incident coordinate bounds' },
    { label: 'Computing Cosine Similarity Scores', detail: 'Finalizing weighted confidence matrix ranking' },
  ];

  useEffect(() => {
    if (!isLoading) {
      return;
    }
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 5);
    }, 1200);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Loading State with 3D Radar and Laser Scanner
  if (isLoading) {
    return (
      <div className="ai-matching-scanning-wrap" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        {/* Holographic 3D Radar Scanner */}
        <div 
          className="radar-scanner-core"
          style={{
            position: 'relative',
            width: '140px',
            height: '140px',
            margin: '0 auto 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: '600px',
          }}
        >
          {/* Outer Pulsing Glow */}
          <div 
            style={{
              position: 'absolute',
              inset: '-15%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(99, 102, 241, 0.1) 60%, transparent 80%)',
              filter: 'blur(16px)',
              pointerEvents: 'none',
            }}
          />

          {/* Gyroscopic Outer Ring */}
          <div 
            className="radar-ring-outer"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px dashed rgba(6, 182, 212, 0.45)',
              transformStyle: 'preserve-3d',
              animation: reducedMotion ? 'none' : 'radarSpin3D 6s linear infinite',
            }}
          />

          {/* Middle Ring */}
          <div 
            className="radar-ring-middle"
            style={{
              position: 'absolute',
              inset: '16px',
              borderRadius: '50%',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              transform: 'rotateX(55deg)',
              animation: reducedMotion ? 'none' : 'counterSpin3D 8s linear infinite',
            }}
          />

          {/* Central Holographic Core */}
          <div 
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(6, 182, 212, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.4)',
              zIndex: 3,
            }}
          >
            <Activity size={26} color="#ffffff" className={reducedMotion ? '' : 'spin-pulse'} />
          </div>

          {/* Radar Sweep Line */}
          {!reducedMotion && (
            <div 
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '64px',
                height: '2px',
                background: 'linear-gradient(90deg, #06b6d4, transparent)',
                transformOrigin: '0 0',
                animation: 'radarSweep 2.2s linear infinite',
                boxShadow: '0 0 8px #06b6d4',
              }}
            />
          )}
        </div>

        {/* Dynamic Diagnostics Ticker */}
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.45rem', 
              background: 'rgba(6, 182, 212, 0.12)', 
              color: '#38bdf8', 
              padding: '0.35rem 0.85rem', 
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '0.85rem',
              border: '1px solid rgba(6, 182, 212, 0.3)'
            }}
          >
            <Sparkles size={14} /> Stage {activeStep + 1} of {scanPhases.length}
          </div>

          <h4 style={{ fontSize: '1.2rem', marginBottom: '0.35rem', color: '#fff' }}>
            {scanPhases[activeStep].label}
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', minHeight: '40px', lineHeight: 1.5 }}>
            {scanPhases[activeStep].detail}
          </p>

          {/* Progress Track */}
          <div 
            style={{ 
              width: '100%', 
              height: '4px', 
              background: 'rgba(255, 255, 255, 0.08)', 
              borderRadius: '4px', 
              overflow: 'hidden', 
              marginTop: '1rem',
              position: 'relative'
            }}
          >
            <div 
              style={{
                height: '100%',
                width: `${((activeStep + 1) / scanPhases.length) * 100}%`,
                background: 'var(--primary-gradient)',
                borderRadius: '4px',
                transition: 'width 0.4s ease',
                boxShadow: '0 0 10px #06b6d4',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Real Results Reveal with 3D Tilt Cards & Confidence Rings
  return (
    <div className="ai-results-reveal-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {results.map((candidate, idx) => {
        const isExpanded = Boolean(expandedBreakdowns[candidate.id]);
        const score = candidate.score || 0;
        
        // Exact real API score colors
        const scoreColor = score >= 70 ? '#34d399' : score >= 50 ? '#818cf8' : '#facc15';
        const scoreBg = score >= 70 ? 'rgba(16, 185, 129, 0.12)' : score >= 50 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(234, 179, 8, 0.12)';
        const scoreBorder = score >= 70 ? 'rgba(16, 185, 129, 0.35)' : score >= 50 ? 'rgba(99, 102, 241, 0.35)' : 'rgba(234, 179, 8, 0.35)';

        // SVG Radial Progress parameters
        const radius = 22;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (score / 100) * circumference;

        return (
          <TiltCard
            key={candidate.id}
            maxTilt={4}
            scale={1.01}
            style={{
              animation: reducedMotion ? 'none' : `cardFadeInUp 0.4s ease-out ${idx * 0.08}s both`,
            }}
          >
            <div 
              className="glass-card" 
              style={{ 
                padding: '1.35rem', 
                border: '1px solid var(--border-subtle)',
                background: 'rgba(15, 20, 32, 0.85)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Subtle animated edge highlight on high-confidence matches */}
              {score >= 70 && (
                <div 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '3px',
                    height: '100%',
                    background: 'linear-gradient(180deg, #10b981 0%, #06b6d4 100%)',
                    boxShadow: '0 0 10px #10b981',
                  }}
                />
              )}

              {/* Card Header with Score Ring */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  
                  {/* SVG Circular Confidence Ring */}
                  <div style={{ position: 'relative', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        cx="28"
                        cy="28"
                        r={radius}
                        fill="transparent"
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeWidth="4"
                      />
                      <circle
                        cx="28"
                        cy="28"
                        r={radius}
                        fill="transparent"
                        stroke={scoreColor}
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{
                          transition: 'stroke-dashoffset 0.8s ease-out',
                        }}
                      />
                    </svg>
                    <div 
                      style={{ 
                        position: 'absolute', 
                        fontSize: '0.82rem', 
                        fontWeight: 800, 
                        color: scoreColor,
                        fontFamily: 'var(--font-heading)',
                      }}
                    >
                      {score}%
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span 
                        style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          color: scoreColor, 
                          background: scoreBg, 
                          border: `1px solid ${scoreBorder}`,
                          padding: '0.2rem 0.55rem', 
                          borderRadius: '9999px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Sparkles size={11} /> {score >= 70 ? 'High Confidence' : score >= 50 ? 'Moderate Match' : 'Potential Match'}
                      </span>
                      <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        #{idx + 1} Candidate
                      </span>
                    </div>
                    <h4 style={{ fontSize: '1.12rem', color: '#fff', fontWeight: 600 }}>
                      {candidate.title}
                    </h4>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                  {candidate.incident_date && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={13} /> {candidate.incident_date}
                    </span>
                  )}
                  {candidate.location_description && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={13} color="#38bdf8" /> {candidate.location_description}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1rem' }}>
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
                      color: 'var(--primary-light)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: 0,
                    }}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isExpanded ? 'Hide Similarity Vectors' : 'Inspect Similarity Breakdown'}
                  </button>
                )}

                {/* Candidate Action Buttons passed from Dashboard */}
                {renderCandidateActions && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {renderCandidateActions(candidate)}
                  </div>
                )}
              </div>

              {/* Vector Breakdown Details Drawer */}
              {isExpanded && candidate.breakdown && (
                <div 
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.85rem',
                    background: 'rgba(9, 13, 22, 0.6)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Semantic Text:</span>
                    <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                      {Math.round((candidate.breakdown.text_similarity || 0) * 100)}%
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Visual CLIP:</span>
                    <div style={{ fontWeight: 700, color: '#a78bfa' }}>
                      {candidate.breakdown.image_similarity != null ? `${Math.round(candidate.breakdown.image_similarity * 100)}%` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Category Match:</span>
                    <div style={{ fontWeight: 700, color: candidate.breakdown.category_match ? '#34d399' : '#94a3b8' }}>
                      {candidate.breakdown.category_match ? 'Exact Match' : 'Unmatched'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Location Match:</span>
                    <div style={{ fontWeight: 700, color: candidate.breakdown.location_match ? '#34d399' : '#94a3b8' }}>
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
