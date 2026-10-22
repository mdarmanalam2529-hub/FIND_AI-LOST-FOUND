import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  Search, 
  UploadCloud, 
  Cpu, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  MapPin, 
  Clock,
  Zap,
  Activity
} from 'lucide-react';
import AiOrb3D from '../components/AiOrb3D';
import TiltCard from '../components/TiltCard';

export default function Home() {
  const [simulationActive, setSimulationActive] = useState(false);

  const toggleSimulation = () => {
    setSimulationActive(true);
    setTimeout(() => {
      setSimulationActive(false);
    }, 3500);
  };

  return (
    <main className="landing-page" id="landing-page-main">
      {/* Hero Section */}
      <section className="hero-section" style={{ padding: '4.5rem 0 3.5rem', position: 'relative', overflow: 'hidden' }}>
        <div className="container">
          <div className="hero-grid">
            {/* Left Content Column */}
            <div style={{ textAlign: 'left', zIndex: 2 }}>
              {/* AI Badge */}
              <div style={{ display: 'inline-flex', marginBottom: '1.25rem' }} className="float-badge">
                <span className="badge badge-primary" style={{ padding: '0.45rem 1.1rem', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} /> Intelligent Multimodal Matching Engine
                </span>
              </div>

              {/* Hero Heading: "Lost Something? Let AI Find It." */}
              <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.2rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                Lost Something? <br />
                Let <span className="gradient-text">AI Find It.</span>
              </h1>

              {/* Hero Subtitle */}
              <p style={{ fontSize: 'clamp(1.05rem, 1.8vw, 1.2rem)', color: 'var(--text-muted)', maxWidth: '560px', margin: '0 0 2.25rem', lineHeight: 1.6 }}>
                Say goodbye to endless physical boards and scattered posts. FindAI combines natural language understanding with computer vision to connect lost belongings to their owners instantly.
              </p>

              {/* Hero Action Buttons - Prominent & Engaging */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
                <Link 
                  to="/report-lost" 
                  className="btn btn-lost" 
                  id="hero-btn-lost" 
                  style={{ 
                    padding: '0.95rem 1.8rem', 
                    fontSize: '1rem', 
                    fontWeight: 700,
                    boxShadow: '0 4px 20px rgba(244, 63, 94, 0.35)',
                  }}
                >
                  <Search size={19} /> Report Lost Item
                </Link>
                <Link 
                  to="/report-found" 
                  className="btn btn-found" 
                  id="hero-btn-found" 
                  style={{ 
                    padding: '0.95rem 1.8rem', 
                    fontSize: '1rem', 
                    fontWeight: 700,
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <UploadCloud size={19} /> Report Found Item
                </Link>
                <Link 
                  to="/signup" 
                  className="btn btn-secondary" 
                  id="hero-btn-register" 
                  style={{ padding: '0.95rem 1.6rem', fontSize: '1rem' }}
                >
                  Join Community <ArrowRight size={16} />
                </Link>
              </div>

              {/* Trust highlights */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', color: 'var(--text-dim)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={16} color="#10b981" /> Verified Proof Handover
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Zap size={16} color="#38bdf8" /> Real-time Vector Matching
                </span>
              </div>
            </div>

            {/* Right 3D AI Orb Column */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              <AiOrb3D size={420} />
            </div>
          </div>

          {/* Quick Metrics Strip with 3D Tilt */}
          <div style={{ marginTop: '4rem' }}>
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                gap: '1.25rem', 
                maxWidth: '920px', 
                margin: '0 auto' 
              }}
            >
              <TiltCard maxTilt={6}>
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.1rem', fontWeight: 800 }} className="gradient-text">98.4%</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.2rem' }}>Semantic Match Accuracy</div>
                </div>
              </TiltCard>

              <TiltCard maxTilt={6}>
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#38bdf8' }}>&lt; 2 Mins</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.2rem' }}>Average Report Time</div>
                </div>
              </TiltCard>

              <TiltCard maxTilt={6}>
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#10b981' }}>100% Free</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.2rem' }}>Open Community Platform</div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Simulation / Mock AI Match Showcase */}
      <section style={{ padding: '4.5rem 0', background: 'rgba(255, 255, 255, 0.015)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>
              Real-time Preview
            </span>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>How AI Bridges Lost & Found</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 1.5rem' }}>
              Even if descriptions differ in phrasing, our semantic vector model recognizes true intent and physical attributes.
            </p>

            <button
              type="button"
              onClick={toggleSimulation}
              className="btn btn-secondary btn-sm"
              id="btn-simulate-ai-match"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                background: simulationActive ? 'rgba(6, 182, 212, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                color: '#38bdf8',
                padding: '0.5rem 1.25rem',
                borderRadius: '9999px',
                transition: 'all 0.3s ease',
              }}
            >
              <Activity size={15} className={simulationActive ? 'spin-pulse' : ''} />
              {simulationActive ? 'Scanning Vectors in 3D Space...' : 'Simulate AI Neural Scan'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'stretch', position: 'relative' }}>
            {/* Lost Card with 3D Tilt */}
            <TiltCard maxTilt={5}>
              <div 
                className="glass-card" 
                style={{ 
                  borderTop: '3px solid var(--lost-accent)', 
                  display: 'flex', 
                  flexDirection: 'column',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Laser scanning beam during simulation */}
                {simulationActive && <div className="scanner-laser-bar" />}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <span className="badge badge-lost">Reported as Lost</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={14} /> 2 hours ago
                  </span>
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Matte Black Wireless Earbuds</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', flex: 1 }}>
                  "Lost my Sony noise-canceling earbuds in the black charging case near the 3rd floor quiet study library."
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                  <MapPin size={15} color="#fb7185" /> Central Campus Library
                </div>
              </div>
            </TiltCard>

            {/* AI Vector Connection Node with 3D Tilt */}
            <TiltCard maxTilt={6}>
              <div 
                className="glass-card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  textAlign: 'center', 
                  background: 'rgba(99, 102, 241, 0.08)', 
                  borderColor: 'rgba(99, 102, 241, 0.3)',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Pulsing Aura */}
                <div 
                  style={{ 
                    width: '64px', 
                    height: '64px', 
                    borderRadius: '50%', 
                    background: 'var(--primary-gradient)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    marginBottom: '1rem', 
                    boxShadow: simulationActive ? '0 0 35px #06b6d4' : 'var(--shadow-glow)',
                    transition: 'box-shadow 0.4s ease',
                  }}
                  className={simulationActive ? 'spin-pulse' : ''}
                >
                  <Cpu size={30} color="#ffffff" />
                </div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>
                  {simulationActive ? 'Analyzing Neural Similarity...' : 'Vector Match Detected'}
                </h3>
                <div 
                  className="badge badge-found" 
                  style={{ 
                    fontSize: '0.95rem', 
                    padding: '0.4rem 1rem', 
                    marginBottom: '0.75rem',
                    boxShadow: simulationActive ? '0 0 15px rgba(16, 185, 129, 0.5)' : 'none',
                  }}
                >
                  96.8% Similarity Confidence
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '260px' }}>
                  Cross-referenced text embeddings, time proximity, and CLIP visual signatures.
                </p>
              </div>
            </TiltCard>

            {/* Found Card with 3D Tilt */}
            <TiltCard maxTilt={5}>
              <div 
                className="glass-card" 
                style={{ 
                  borderTop: '3px solid var(--found-accent)', 
                  display: 'flex', 
                  flexDirection: 'column',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Laser scanning beam during simulation */}
                {simulationActive && <div className="scanner-laser-bar" />}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <span className="badge badge-found">Reported as Found</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={14} /> 30 mins ago
                  </span>
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Dark Oval Headphone Case</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', flex: 1 }}>
                  "Picked up a black audio case left on the desk near the bookshelves on floor 3. Turned in to desk staff."
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                  <MapPin size={15} color="#34d399" /> Library Reception Desk
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* 3 Step Workflow */}
      <section style={{ padding: '5rem 0' }} id="how-it-works">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>Simple 3-Step Process</span>
            <h2 style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>How FindAI Works</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>
              Reconnecting lost items used to depend on luck. We make it an automated, deterministic process.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {/* Step 1 with 3D Tilt */}
            <TiltCard maxTilt={5}>
              <div className="glass-card" style={{ position: 'relative', height: '100%' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.5rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.06)' }}>
                  01
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Search size={24} color="#fb7185" />
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Submit Details</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                  Report an item with title, category, description, location, and photos. No complicated forms.
                </p>
              </div>
            </TiltCard>

            {/* Step 2 with 3D Tilt */}
            <TiltCard maxTilt={5}>
              <div className="glass-card" style={{ position: 'relative', height: '100%' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.5rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.06)' }}>
                  02
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <Cpu size={24} color="#818cf8" />
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>AI Multimodal Scan</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                  Our backend generates vector embeddings from keywords, semantic text, and image characteristics.
                </p>
              </div>
            </TiltCard>

            {/* Step 3 with 3D Tilt */}
            <TiltCard maxTilt={5}>
              <div className="glass-card" style={{ position: 'relative', height: '100%' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '2.5rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.06)' }}>
                  03
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <ShieldCheck size={24} color="#34d399" />
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Secure Verification</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                  Receive instant match alerts. Owners verify unique proof of ownership before safe handoff.
                </p>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section style={{ padding: '4rem 0 6rem' }}>
        <div className="container">
          <div 
            className="glass-card" 
            style={{ 
              textAlign: 'center', 
              padding: '4rem 2rem', 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)', 
              borderColor: 'rgba(99, 102, 241, 0.3)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', marginBottom: '1rem' }}>
              Ready to recover what matters most?
            </h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '550px', margin: '0 auto 2rem', fontSize: '1.05rem' }}>
              Join hundreds of community members reuniting lost belongings with their rightful owners every day.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn btn-primary" id="cta-get-started" style={{ padding: '0.85rem 1.8rem' }}>
                Create Free Account
              </Link>
              <Link to="/report-lost" className="btn btn-secondary" id="cta-browse-report" style={{ padding: '0.85rem 1.8rem' }}>
                Report an Item Now
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
