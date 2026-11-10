import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Search, 
  UploadCloud, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  EyeOff, 
  CheckCircle2, 
  Sparkles,
  FileCheck2,
  ChevronDown,
  Layers,
  MapPin,
  Cpu,
} from 'lucide-react';
import TiltCard from '../components/TiltCard';
import AiOrb3D from '../components/AiOrb3D';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';

export default function Home() {
  const [openFaq, setOpenFaq] = useState(null);

  const location = useLocation();

  // Scroll to hash anchor smoothly when navigated to from any page
  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash);
      if (element) {
        const timer = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 80);
        return () => clearTimeout(timer);
      }
    }
  }, [location.hash]);

  const toggleFaq = (idx) => {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  };

  const faqs = [
    {
      q: 'How does the AI matching system work?',
      a: 'FindAI uses open-source multimodal vector embeddings (combining visual CLIP image embeddings and semantic sentence transformers). It evaluates title descriptions, colors, categories, campus zones, and timestamps to calculate a transparent similarity score without exposing personal identities.',
    },
    {
      q: 'Will my personal phone number or email be visible to others?',
      a: 'Never. FindAI enforces zero public contact leakage. All identification clues, serial numbers, and private ownership proofs are encrypted and only accessible to authorized moderators and verified claim parties during an active handover.',
    },
    {
      q: 'What is the Dual-Confirmation Handover process?',
      a: 'Once a claim is approved, the finder and claimant coordinate a physical handover at a designated campus safety hub (such as Campus Security or the Main Library desk). The return is officially closed only after both parties submit independent confirmations on their dashboards.',
    },
    {
      q: 'Who can register on FindAI?',
      a: 'FindAI is integrated with your university student registry. Only verified students with official campus email addresses and active enrollment credentials can submit claims and initiate handovers.',
    },
    {
      q: 'What should I do if I find a high-value item like a laptop or wallet?',
      a: 'Submit a Found Report with clear photos. You can immediately deposit the item at the nearest designated campus custody desk (e.g. Student Center or Campus Security) and record that location in the report so owners can claim it safely.',
    },
  ];

  return (
    <main className="landing-page" id="landing-page-main">
      {/* Flagship Enterprise AI Hero Section */}
      <section className="hero-section hero-section-futuristic" id="hero-section-futuristic">
        <HeroAnimatedBackground showOrb={false} />

        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="hero-grid">
            {/* Left Content Column */}
            <div style={{ textAlign: 'left', zIndex: 2 }}>
              {/* Trust Badge */}
              <div className="hero-fade-1" style={{ display: 'inline-flex', marginBottom: '1.25rem' }}>
                <span className="hero-badge-pill" id="hero-trust-badge">
                  <ShieldCheck size={16} /> Intelligent Campus Lost &amp; Found Platform
                </span>
              </div>

              {/* Exact Master Prompt Headline */}
              <h1 
                className="hero-fade-2" 
                style={{ 
                  fontSize: 'clamp(2.3rem, 4.2vw, 3.6rem)', 
                  fontWeight: 800, 
                  letterSpacing: '-0.035em', 
                  marginBottom: '1.25rem', 
                  lineHeight: 1.15,
                  color: 'var(--text-main)'
                }}
              >
                Lost Something on Campus? <span className="hero-gradient-text">Let AI Help You Find It.</span>
              </h1>

              {/* Exact Master Prompt Supporting Text */}
              <p 
                className="hero-fade-3" 
                style={{ 
                  fontSize: 'clamp(1.05rem, 1.5vw, 1.18rem)', 
                  color: 'var(--text-secondary)', 
                  maxWidth: '560px', 
                  margin: '0 0 2rem', 
                  lineHeight: 1.65 
                }}
              >
                FindAI connects lost belongings with their rightful owners through intelligent image and text matching, verified community members, and secure handovers.
              </p>

              {/* Action Buttons */}
              <div 
                className="hero-fade-4" 
                style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}
              >
                <Link 
                  to="/report-lost" 
                  className="btn btn-lost btn-lg" 
                  id="hero-btn-lost"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}
                >
                  <Search size={18} /> Report Lost Item
                </Link>
                <Link 
                  to="/report-found" 
                  className="btn btn-found btn-lg" 
                  id="hero-btn-found"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}
                >
                  <UploadCloud size={18} /> Report Found Item
                </Link>
                <Link 
                  to="/signup" 
                  className="btn btn-secondary btn-lg" 
                  id="hero-btn-register"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}
                >
                  Get Started <ArrowRight size={16} />
                </Link>
              </div>

              {/* Trust Highlights */}
              <div 
                className="hero-fade-5" 
                style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', color: 'var(--text-secondary)', fontSize: '0.88rem', flexWrap: 'wrap' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Lock size={16} color="var(--primary)" /> Private Proof Verification
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <EyeOff size={16} color="var(--accent-teal)" /> Zero Contact Leakage
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <CheckCircle2 size={16} color="var(--found-accent)" /> Dual-Confirmed Returns
                </span>
              </div>
            </div>

            {/* Right Column: Interactive AI Neural Match Visualization */}
            <div 
              className="hero-orb-showcase-column"
              style={{ 
                position: 'relative', 
                zIndex: 2, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                userSelect: 'none'
              }}
            >
              <TiltCard maxTilt={4} scale={1.02}>
                <div 
                  className="hero-orb-showcase-card"
                  style={{ 
                    position: 'relative', 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '1.75rem 1.5rem 1.5rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg-surface-translucent)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 20px 45px -10px rgba(99, 91, 255, 0.16), 0 0 30px -4px var(--cyan-glow-subtle)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    maxWidth: '460px',
                    width: '100%',
                  }}
                >
                  <AiOrb3D size={350} showBadge={true} showTitle={true} interactive={true} />
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: How FindAI Works */}
      <section style={{ padding: '4.5rem 0', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} id="how-it-works">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3.25rem' }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>
              <Sparkles size={13} /> Institutional Recovery Pipeline
            </span>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>How FindAI Works</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '620px', margin: '0 auto', fontSize: '1rem' }}>
              Reuniting lost belongings shouldn't depend on noisy chat groups or paper flyers. Our systematic workflow protects your privacy while making matching precise.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {/* Step 1 */}
            <TiltCard maxTilt={2}>
              <div className="glass-card" style={{ height: '100%', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.2rem', fontWeight: 800, color: 'var(--border-muted)', opacity: 0.6 }}>
                  01
                </div>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--lost-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Search size={22} color="var(--lost-accent)" />
                </div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.65rem' }}>1. Submit Clear Item Details</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Provide title, category, campus zone, and incident date. Attach a photo and leave distinctive serial numbers or marks in protected private fields.
                </p>
              </div>
            </TiltCard>

            {/* Step 2 */}
            <TiltCard maxTilt={2}>
              <div className="glass-card" style={{ height: '100%', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.2rem', fontWeight: 800, color: 'var(--border-muted)', opacity: 0.6 }}>
                  02
                </div>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Sparkles size={22} color="var(--primary)" />
                </div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.65rem' }}>2. Multimodal AI Assistance</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Our open-source language and vision embeddings calculate similarity between descriptions, incident timelines, and visual properties without sharing contact info.
                </p>
              </div>
            </TiltCard>

            {/* Step 3 */}
            <TiltCard maxTilt={2}>
              <div className="glass-card" style={{ height: '100%', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.2rem', fontWeight: 800, color: 'var(--border-muted)', opacity: 0.6 }}>
                  03
                </div>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--found-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <ShieldCheck size={22} color="var(--found-accent)" />
                </div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.65rem' }}>3. Private Proof & Handover</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Claimants provide private identifying details (such as wallpaper clues or serial numbers). Once confirmed, both parties schedule a safe handover with dual confirmation.
                </p>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* Section 2: AI-Powered Multimodal Intelligence */}
      <section style={{ padding: '5rem 0' }} id="ai-matching">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'center' }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '1rem' }}>
                <Cpu size={14} /> Neural Semantic Engine
              </span>
              <h2 style={{ fontSize: '2.3rem', marginBottom: '1rem', letterSpacing: '-0.025em' }}>
                Intelligent multimodal matching that understands context.
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.02rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Unlike basic keyword search, FindAI processes both descriptive natural language and visual feature vectors simultaneously to suggest high-confidence matches across the entire campus.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.2rem' }}>CLIP Visual Embeddings</h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                      Extracts invariant visual signatures from photos, allowing matching even if angles or lighting vary.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--ai-violet-subtle)', color: 'var(--ai-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <Layers size={16} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.2rem' }}>Semantic Similarity</h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                      Understands synonyms: "earbuds" matches "headphones", "macbook" matches "apple laptop".
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--found-subtle)', color: 'var(--found-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <MapPin size={16} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.2rem' }}>Spatiotemporal Proximity</h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                      Factors in campus building proximity and incident date windows to elevate genuine matches.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: AI Match Explainer Card Preview */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>AI Similarity Breakdown</span>
                </div>
                <span className="badge badge-found" style={{ fontSize: '0.8rem' }}>96.8% Overall</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Visual Embeddings (CLIP)</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>94%</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ width: '94%', height: '100%', background: 'var(--primary)', borderRadius: '4px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Semantic Text Similarity</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>98%</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ width: '98%', height: '100%', background: 'var(--ai-violet)', borderRadius: '4px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Campus Zone &amp; Timeline Proximity</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>91%</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
                    <div style={{ width: '91%', height: '100%', background: 'var(--accent-teal)', borderRadius: '4px' }} />
                  </div>
                </div>
              </div>

              {/* Exact Algorithmic Disclaimer */}
              <div 
                style={{ 
                  padding: '0.85rem', 
                  borderRadius: 'var(--radius-md)', 
                  background: 'var(--bg-subtle)', 
                  border: '1px solid var(--border-subtle)', 
                  fontSize: '0.78rem', 
                  color: 'var(--text-muted)',
                  lineHeight: 1.45
                }}
              >
                <strong>Algorithmic Notice:</strong> Suggested matches are algorithmic estimates based on text, visual, and metadata similarity. They do not constitute verified proof of ownership.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Genuine Trust & Privacy Commitments */}
      <section style={{ padding: '4.5rem 0', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} id="privacy">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>Responsible Architecture</span>
            <h2 style={{ fontSize: '2.1rem', marginBottom: '0.75rem' }}>Our Trust & Privacy Principles</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto', fontSize: '1rem' }}>
              We believe an institutional lost-and-found system must never put student safety, personal contact information, or sensitive data at risk.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.75rem' }}>
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <EyeOff size={20} color="var(--primary)" />
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No Public Contact Numbers</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                We automatically redact phone numbers and personal emails from public item feeds to prevent spam, scam calls, and harassment.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--accent-teal-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Lock size={20} color="var(--accent-teal)" />
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Protected Proof of Ownership</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                Identifying clues like serial numbers, engravements, and receipts are restricted to the finder and authorized moderators to prevent fraudulent claims.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--warning-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Sparkles size={20} color="var(--warning-accent)" />
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Transparent AI Suggestions</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                Our AI highlights candidate similarities but never makes unilateral decisions. Human review and explicit verification always control item return.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--found-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <FileCheck2 size={20} color="var(--found-accent)" />
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Dual-Confirmed Closures</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                A return is only marked resolved after both the finder and owner separately confirm completion, maintaining a clean audit trail.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Frequently Asked Questions */}
      <section style={{ padding: '5rem 0' }} id="faq">
        <div className="container" style={{ maxWidth: '800px' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>Got Questions?</span>
            <h2 style={{ fontSize: '2.1rem', marginBottom: '0.5rem' }}>Frequently Asked Questions</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Everything you need to know about reporting, matching, and recovering campus belongings.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx}
                  className="glass-card"
                  style={{ 
                    padding: '1.25rem 1.5rem', 
                    cursor: 'pointer',
                    borderColor: isOpen ? 'var(--primary-border)' : 'var(--border-subtle)',
                    transition: 'all 0.18s ease'
                  }}
                  onClick={() => toggleFaq(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.02rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                      {faq.q}
                    </h3>
                    <ChevronDown 
                      size={18} 
                      style={{ 
                        transform: isOpen ? 'rotate(180deg)' : 'none', 
                        transition: 'transform 0.2s ease',
                        color: 'var(--text-muted)',
                        flexShrink: 0
                      }} 
                    />
                  </div>
                  {isOpen && (
                    <p style={{ marginTop: '0.85rem', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, margin: '0.85rem 0 0' }}>
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section style={{ padding: '2rem 0 5rem' }}>
        <div className="container">
          <div 
            className="glass-card" 
            style={{ 
              textAlign: 'center', 
              padding: '3.5rem 2rem', 
              background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--primary-subtle) 100%)', 
              borderColor: 'var(--primary-border)',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            <h2 style={{ fontSize: 'clamp(1.7rem, 3vw, 2.3rem)', marginBottom: '0.85rem' }}>
              Need to find something or report a found item?
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '580px', margin: '0 auto 2rem', fontSize: '1.02rem' }}>
              Join your community lost-and-found system. File a report in two minutes with complete privacy controls.
            </p>
            <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/report-lost" className="btn btn-lost" id="cta-report-lost">
                <Search size={16} /> Report Lost Item
              </Link>
              <Link to="/report-found" className="btn btn-found" id="cta-report-found">
                <UploadCloud size={16} /> Report Found Item
              </Link>
              <Link to="/signup" className="btn btn-secondary" id="cta-signup">
                Create Free Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
