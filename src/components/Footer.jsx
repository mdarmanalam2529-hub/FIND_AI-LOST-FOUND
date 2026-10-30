import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Cpu, Lock, CheckCircle2 } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="footer" id="main-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Info */}
          <div className="footer-col">
            <div className="brand-logo" style={{ marginBottom: '0.85rem' }}>
              <div className="brand-icon-wrap" style={{ width: '32px', height: '32px' }}>
                <ShieldCheck size={18} color="#ffffff" />
              </div>
              <span>Find<span className="gradient-text">AI</span></span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '320px', lineHeight: 1.6 }}>
              A privacy-conscious community lost-and-found platform. We assist recovery with open-source AI embeddings and verified proof handovers.
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/report-lost">Report Lost Item</Link></li>
              <li><Link to="/report-found">Report Found Item</Link></li>
              <li><Link to="/dashboard">Community Dashboard</Link></li>
            </ul>
          </div>

          {/* Account & Trust */}
          <div className="footer-col">
            <h4>Account & Trust</h4>
            <ul className="footer-links">
              <li><Link to="/login">Sign In</Link></li>
              <li><Link to="/signup">Create Account</Link></li>
              <li><a href="#how-it-works">How Matching Works</a></li>
              <li><a href="#privacy">Privacy Principles</a></li>
            </ul>
          </div>

          {/* Platform Standards */}
          <div className="footer-col">
            <h4>Platform Commitments</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                <Lock size={15} color="var(--primary)" />
                <span>Restricted Proof Verification</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                <CheckCircle2 size={15} color="var(--found-accent)" />
                <span>Dual-Confirmation Handover</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                <Cpu size={15} color="var(--accent-teal)" />
                <span>Open-Source Embeddings</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p>© {CURRENT_YEAR} FindAI. Transparent Community Lost & Found System.</p>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
            All private user data protected under Row Level Security.
          </p>
        </div>
      </div>
    </footer>
  );
}
