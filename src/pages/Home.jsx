import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  UploadCloud, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  EyeOff, 
  CheckCircle2, 
  Sparkles,
  FileCheck2
} from 'lucide-react';
import TiltCard from '../components/TiltCard';
import AiOrb3D from '../components/AiOrb3D';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';

export default function Home() {
  return (
    <main className="landing-page" id="landing-page-main">
      {/* Futuristic 3D AI Hero Section */}
      <section className="hero-section hero-section-futuristic" id="hero-section-futuristic">
        {/* Multi-Layer Animated AI Neural Background */}
        <HeroAnimatedBackground showOrb={false} />

        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="hero-grid">
            {/* Left Content Column */}
            <div style={{ textAlign: 'left', zIndex: 2 }}>
              {/* Trust Badge */}
              <div className="hero-fade-1" style={{ display: 'inline-flex', marginBottom: '1.25rem' }}>
                <span className="hero-badge-pill" id="hero-trust-badge">
                  <ShieldCheck size={16} /> Privacy-First Lost &amp; Found Platform
                </span>
              </div>

              {/* Hero Heading with Electric Blue / Cyan Gradient Accent */}
              <h1 
                className="hero-fade-2" 
                style={{ 
                  fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)', 
                  fontWeight: 800, 
                  letterSpacing: '-0.03em', 
                  marginBottom: '1.25rem', 
                  lineHeight: 1.15,
                  color: 'var(--text-main)'
                }}
              >
                Reunite lost belongings with <span className="hero-gradient-text">clarity and trust.</span>
              </h1>

              {/* Hero Subtitle */}
              <p 
                className="hero-fade-3" 
                style={{ 
                  fontSize: 'clamp(1.05rem, 1.6vw, 1.18rem)', 
                  color: 'var(--text-secondary)', 
                  maxWidth: '560px', 
                  margin: '0 0 2rem', 
                  lineHeight: 1.65 
                }}
              >
                Say goodbye to scattered group chats and paper flyers. FindAI connects finders and owners with multimodal AI suggestions, private proof verification, and safe handover tracking.
              </p>

              {/* Hero Action Buttons */}
              <div 
                className="hero-fade-4" 
                style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}
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
                  className="btn btn-hero-secondary btn-lg" 
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
                  <EyeOff size={16} color="var(--accent-teal)" /> Zero Public Contact Leakage
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <CheckCircle2 size={16} color="var(--found-accent)" /> Dual-Confirmed Handovers
                </span>
              </div>
            </div>

            {/* Right Column: Interactive 3D AI Holographic Neural Orb Showcase */}
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
                  style={{ 
                    position: 'relative', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '2rem 1.75rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'rgba(255, 255, 255, 0.88)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 20px 45px -10px rgba(37, 99, 235, 0.12), 0 0 30px -4px rgba(34, 211, 238, 0.22)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    maxWidth: '440px',
                    width: '100%',
                  }}
                >
                  <AiOrb3D size={380} showBadge={true} interactive={true} />

                  <div 
                    style={{ 
                      marginTop: '1.5rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      gap: '0.4rem', 
                      textAlign: 'center' 
                    }}
                  >
                    <span 
                      className="badge badge-primary" 
                      style={{ 
                        background: 'var(--primary-subtle)', 
                        border: '1px solid var(--primary-border)', 
                        color: 'var(--primary)',
                        fontSize: '0.82rem',
                        padding: '0.35rem 0.9rem'
                      }}
                    >
                      <Sparkles size={13} /> Multimodal Neural Engine Active
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '320px', lineHeight: 1.45 }}>
                      Private semantic &amp; visual vector matching accessible in your dashboard
                    </span>
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Step Process */}
      <section style={{ padding: '4.5rem 0', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} id="how-it-works">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3.25rem' }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>Simple, Protected Workflow</span>
            <h2 style={{ fontSize: '2.1rem', marginBottom: '0.75rem' }}>How FindAI Works</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '620px', margin: '0 auto', fontSize: '1rem' }}>
              Reuniting lost items shouldn't depend on pure luck. Our workflow protects your identity while making matching systematic.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {/* Step 1 */}
            <TiltCard maxTilt={2}>
              <div className="glass-card how-it-works-card" style={{ height: '100%', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.2rem', fontWeight: 800, color: 'var(--border-muted)', opacity: 0.6 }}>
                  01
                </div>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--lost-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Search size={22} color="var(--lost-accent)" />
                </div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.65rem' }}>1. Submit Clear Item Details</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  Provide item title, category, date, and general location. You can attach a photo or leave distinctive serial numbers in private fields.
                </p>
              </div>
            </TiltCard>

            {/* Step 2 */}
            <TiltCard maxTilt={2}>
              <div className="glass-card how-it-works-card" style={{ height: '100%', position: 'relative' }}>
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
              <div className="glass-card how-it-works-card" style={{ height: '100%', position: 'relative' }}>
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

      {/* Genuine Trust & Privacy Commitments */}
      <section style={{ padding: '5rem 0' }} id="privacy">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>Responsible Design</span>
            <h2 style={{ fontSize: '2.1rem', marginBottom: '0.75rem' }}>Our Trust & Privacy Principles</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto', fontSize: '1rem' }}>
              We believe a lost-and-found system must never put user safety or sensitive personal data at risk.
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

      {/* Call to Action Banner */}
      <section style={{ padding: '3.5rem 0 5rem' }}>
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
