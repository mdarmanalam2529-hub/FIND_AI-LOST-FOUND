import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shield, Cpu, Mail, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer" id="main-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Info */}
          <div className="footer-col">
            <div className="brand-logo" style={{ marginBottom: '1rem' }}>
              <div className="brand-icon-wrap">
                <Sparkles size={18} color="#ffffff" />
              </div>
              <span>Find<span className="gradient-text">AI</span></span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '320px', lineHeight: 1.6 }}>
              Next-generation lost and found intelligence platform powered by multimodal AI and semantic vector matching.
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/report-lost">Report Lost Item</Link></li>
              <li><Link to="/report-found">Report Found Item</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div className="footer-col">
            <h4>Account</h4>
            <ul className="footer-links">
              <li><Link to="/login">Sign In</Link></li>
              <li><Link to="/signup">Create Account</Link></li>
              <li><a href="#how-it-works">How AI Works</a></li>
              <li><a href="#privacy">Privacy & Security</a></li>
            </ul>
          </div>

          {/* Technology & Status */}
          <div className="footer-col">
            <h4>Technology</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Cpu size={16} color="#6366f1" />
                <span>Multimodal Embeddings</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Shield size={16} color="#10b981" />
                <span>Supabase Protected</span>
              </div>
              <div className="badge badge-primary" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
                System Ready • v1.0
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} FindAI - AI Lost-and-Found Matcher. All rights reserved.</p>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            Built with precision & Care
          </p>
        </div>
      </div>
    </footer>
  );
}
