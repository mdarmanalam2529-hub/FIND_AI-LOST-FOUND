import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  UploadCloud,
  FileText,
  Handshake,
  GraduationCap,
  Users,
  RefreshCw,
  AlertCircle,
  Activity,
  Cpu,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/adminService';
import { isAdminUser, isPrimaryAdminUser, getUserRoleTitle } from '../lib/roleHelpers';
import StatCard from '../components/ui/StatCard';
import HeroAnimatedBackground from '../components/HeroAnimatedBackground';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isPrimaryAdmin = isPrimaryAdminUser(user);
  const isAdmin = isAdminUser(user);
  const roleTitle = getUserRoleTitle(user);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.fetchDashboard();
      setAdminStats(data);
    } catch (err) {
      console.error('[AdminDashboard] Fetch stats error:', err);
      setError(err.message || 'Failed to load administrative statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <>
      <HeroAnimatedBackground variant="ambient" />
      <div
        style={{ position: 'relative', zIndex: 1, maxWidth: '1280px', margin: '0 auto' }}
        id="admin-dashboard-page"
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          <div>
            <div
              className="badge badge-primary"
              style={{
                marginBottom: '0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ShieldCheck size={14} />
              <span>Administrative Console</span>
              <span
                style={{
                  background: isPrimaryAdmin ? '#7c3aed' : 'var(--primary)',
                  color: '#ffffff',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  marginLeft: '0.25rem',
                }}
              >
                {roleTitle}
              </span>
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.35rem', color: 'var(--text-main)' }}>
              Operations & Administration Dashboard
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, maxWidth: '750px' }}>
              Real-time platform metrics, report moderation, custody verification, and campus community safety.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchStats}
            disabled={loading}
            id="admin-dashboard-refresh-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh Metrics'}</span>
          </button>
        </div>

        {/* Error Notification Alert */}
        {error && (
          <div
            className="glass-card"
            style={{
              padding: '1rem 1.25rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-lg, 12px)',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <AlertCircle size={20} color="var(--lost-accent)" />
            <div style={{ flex: 1, color: 'var(--text-main)', fontSize: '0.9rem' }}>
              <strong>Error loading metrics:</strong> {error}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchStats}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '2.5rem',
          }}
          id="admin-kpi-grid"
        >
          <StatCard
            title="Enrolled Students"
            value={adminStats?.totalStudents ?? (loading ? '—' : 0)}
            icon={GraduationCap}
            accentColor="primary"
            description="Verified campus directory"
          />
          <StatCard
            title="Lost Reports"
            value={adminStats?.totalLostReports ?? (loading ? '—' : 0)}
            icon={Search}
            accentColor="lost"
            description="Active lost item inquiries"
          />
          <StatCard
            title="Found Reports"
            value={adminStats?.totalFoundReports ?? (loading ? '—' : 0)}
            icon={UploadCloud}
            accentColor="found"
            description="Physical items cataloged"
          />
          <StatCard
            title="Open Claims"
            value={adminStats?.totalClaims ?? (loading ? '—' : 0)}
            icon={ShieldCheck}
            accentColor="violet"
            description="Awaiting proof verification"
          />
          <StatCard
            title="Active Handovers"
            value={adminStats?.totalHandovers ?? (loading ? '—' : 0)}
            icon={Handshake}
            accentColor="cyan"
            description="Pending physical returns"
          />
          <StatCard
            title="Security Incidents"
            value={adminStats?.totalIncidents ?? (loading ? '—' : 0)}
            icon={ShieldAlert}
            accentColor="amber"
            description="Abuse reports & holds"
          />
        </div>

        {/* Operational Modules Section */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-main)' }}>
              Operational Management Workspaces
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
              Access specialized administrative consoles for content moderation, claims, custody handovers, and identity.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* 1. Report Moderation */}
            <div
              className="glass-card"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'rgba(234, 179, 8, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileText size={20} color="#eab308" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      Report Moderation
                    </h3>
                  </div>
                  <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                    Moderation
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.25rem' }}>
                  Inspect reported lost and found items across campus, review automated AI match confidence, flag abusive listings, and manage item visibility.
                </p>
              </div>
              <Link
                to="/admin/reports"
                className="btn btn-secondary btn-sm"
                id="admin-card-reports-btn"
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <span>Open Report Moderation</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* 2. Claims Management */}
            <div
              className="glass-card"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'rgba(16, 185, 129, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ShieldCheck size={20} color="#10b981" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      Claims Management
                    </h3>
                  </div>
                  <span className="badge badge-found" style={{ fontSize: '0.72rem' }}>
                    Verification
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.25rem' }}>
                  Audit student ownership assertions, examine private proof answers, resolve conflicting multi-party claims, and approve custody transitions.
                </p>
              </div>
              <Link
                to="/admin/claims"
                className="btn btn-secondary btn-sm"
                id="admin-card-claims-btn"
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <span>Open Claims Console</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* 3. Handover Operations */}
            <div
              className="glass-card"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'rgba(6, 182, 212, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Handshake size={20} color="#06b6d4" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      Handover Operations
                    </h3>
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                    Custody
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.25rem' }}>
                  Supervise dual-confirmation physical handovers, generate tamper-proof 6-digit tokens, enforce security holds, and finalize return chains.
                </p>
              </div>
              <Link
                to="/admin/handovers"
                className="btn btn-secondary btn-sm"
                id="admin-card-handovers-btn"
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <span>Open Handover Operations</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* 4. Incident Investigation */}
            <div
              className="glass-card"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'rgba(245, 158, 11, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ShieldAlert size={20} color="#f59e0b" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                      Incident Investigation
                    </h3>
                  </div>
                  <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                    Security
                  </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.25rem' }}>
                  Investigate reported listing abuse, brute-force token burst attempts, suspicious ownership claims, and student safety notifications.
                </p>
              </div>
              <Link
                to="/admin/incidents"
                className="btn btn-secondary btn-sm"
                id="admin-card-incidents-btn"
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <span>Investigate Incidents</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* 5. Student Registry (Admin Only) */}
            {isAdmin && (
              <div
                className="glass-card"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-md, 8px)',
                          background: 'rgba(59, 130, 246, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <GraduationCap size={20} color="#3b82f6" />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                        Student Registry
                      </h3>
                    </div>
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                      Directory
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.25rem' }}>
                    Search institutional enrollment, verify registration numbers, check portal onboarding eligibility, and activate or suspend student accounts.
                  </p>
                </div>
                <Link
                  to="/admin/students"
                  className="btn btn-primary btn-sm"
                  id="admin-card-students-btn"
                  style={{ justifyContent: 'space-between', width: '100%' }}
                >
                  <span>Manage Student Registry</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {/* 6. Staff & Access Management (Admin Only) */}
            {isAdmin && (
              <div
                className="glass-card"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-md, 8px)',
                          background: 'rgba(139, 92, 246, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Users size={20} color="#8b5cf6" />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                        Staff & User Access
                      </h3>
                    </div>
                    <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontSize: '0.72rem', fontWeight: 600 }}>
                      Access Control
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.25rem' }}>
                    Appoint staff officers, configure administrative roles, inspect audit trail events, and manage security permissions.
                  </p>
                </div>
                <Link
                  to="/admin/users"
                  className="btn btn-secondary btn-sm"
                  id="admin-card-users-btn"
                  style={{ justifyContent: 'space-between', width: '100%' }}
                >
                  <span>Manage Staff & Admins</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Platform Integrity & Architecture Health */}
        <section
          className="glass-card"
          style={{
            padding: '1.75rem',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg, 12px)',
            marginBottom: '2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <Activity size={22} color="var(--primary)" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 700 }}>
                Platform Integrity & Security Systems
              </h3>
              <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Operational status of AI inference models, custody verification rules, and security controls.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Cpu size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>AI Semantic Matching</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>all-MiniLM-L6-v2 (Online)</span>
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Cpu size={16} color="#06b6d4" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>CLIP Vision Embeddings</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>512-dim Cosine (Online)</span>
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Lock size={16} color="#8b5cf6" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Custody Tokens</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dual-Confirmed (Enforced)</span>
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <ShieldCheck size={16} color="#10b981" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>Database & RLS</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Row Level Security (Active)</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

