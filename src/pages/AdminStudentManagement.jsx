// src/pages/AdminStudentManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Filter,
  Users,
} from 'lucide-react';

export default function AdminStudentManagement() {
  const { user, session, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'eligible' | 'ineligible' | 'active' | 'inactive'
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const limit = 20;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchStudents = useCallback(async (q = searchTerm, p = page, status = statusFilter) => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/admin/student-registry/search', window.location.origin);
      if (q && q.trim()) url.searchParams.append('q', q.trim());
      url.searchParams.append('page', p);
      url.searchParams.append('limit', limit);
      if (status && status !== 'all') url.searchParams.append('status', status);

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to load student registry records.');

      setStudents(data.students || []);
      setTotal(data.pagination?.total ?? 0);
    } catch (e) {
      console.error('[AdminStudentManagement] fetch error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, searchTerm, page, statusFilter]);

  // Initial load & refetch when page or statusFilter changes
  useEffect(() => {
    if (!authLoading && user && session?.access_token) {
      fetchStudents(searchTerm, page, statusFilter);
    }
  }, [authLoading, user, session, page, statusFilter, fetchStudents]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchStudents(searchTerm, 1, statusFilter);
  };

  // Toggle institutional eligibility in student_registry
  const handleToggleEligibility = async (regNumber, currentEligible) => {
    if (actionLoading) return;
    const actionLabel = currentEligible ? 'revoke eligibility for' : 'grant eligibility to';
    if (!window.confirm(`Are you sure you want to ${actionLabel} student ${regNumber}?`)) return;

    setActionLoading(true);
    try {
      const resp = await fetch(`/api/admin/student-registry/${encodeURIComponent(regNumber)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ is_eligible: !currentEligible }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to update eligibility.');
      showToast(`Eligibility successfully ${!currentEligible ? 'granted to' : 'revoked from'} ${regNumber}.`);
      await fetchStudents(searchTerm, page, statusFilter);
    } catch (e) {
      alert(`Error updating eligibility: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle profile activation
  const handleToggleActive = async (regNumber, currentActive) => {
    if (actionLoading) return;
    const actionLabel = currentActive ? 'suspend / deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} the profile for ${regNumber}?`)) return;

    setActionLoading(true);
    try {
      const resp = await fetch(`/api/admin/student-registry/${encodeURIComponent(regNumber)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_active: !currentActive,
          verification_status: !currentActive ? 'verified' : 'suspended',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Failed to update profile status.');
      showToast(`Student profile ${!currentActive ? 'activated' : 'suspended'} for ${regNumber}.`);
      await fetchStudents(searchTerm, page, statusFilter);
    } catch (e) {
      alert(`Error updating account status: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  if (authLoading) {
    return (
      <div className="container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" /> Checking authorization…
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '1200px' }} id="admin-student-management">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '2rem',
            right: '2rem',
            background: 'var(--found-accent, #059669)',
            color: '#ffffff',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            zIndex: 9999,
          }}
        >
          <CheckCircle2 size={18} />
          <span style={{ fontSize: '0.92rem', fontWeight: 500 }}>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <div className="brand-icon-wrap" style={{ width: '38px', height: '38px' }}>
              <GraduationCap size={20} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Student Management</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
            Inspect institutional registry records, manage account eligibility, and control student access.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => fetchStudents(searchTerm, page, statusFilter)}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh List
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flexGrow: 1, minWidth: '260px' }}>
            <input
              type="text"
              placeholder="Search by registration number (e.g. 251FA04G44) or student name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              id="student-search-input"
            />
            <Search
              size={18}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="form-input"
              style={{ width: 'auto', padding: '0.55rem 0.85rem', cursor: 'pointer' }}
              id="student-filter-select"
            >
              <option value="all">All Records</option>
              <option value="eligible">Eligible Only</option>
              <option value="ineligible">Ineligible Only</option>
              <option value="active">Active Profiles Only</option>
              <option value="inactive">Inactive Profiles Only</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} id="student-search-btn">
            <Search size={16} /> Search
          </button>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'var(--lost-subtle)',
            border: '1px solid var(--lost-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--lost-accent)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          role="alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchStudents(searchTerm, page, statusFilter)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="glass-card" style={{ padding: '1.25rem', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <Loader2 size={36} className="spin" style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Querying student registry records...</p>
          </div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No student records found matching your query.</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem', minWidth: '680px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle, #e2e8f0)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Reg. Number</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Student Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Academic Details</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Registry Eligibility</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Account Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.registration_number} style={{ borderBottom: '1px solid var(--border-subtle, #f1f5f9)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                      {s.registration_number}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 500 }}>{s.student_name}</div>
                      {s.official_email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.official_email}</div>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                      <div>{s.branch} • Sec {s.section}</div>
                      <div style={{ fontSize: '0.78rem' }}>{s.academic_year}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {s.is_eligible ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '999px', background: '#ecfdf5', color: '#059669', fontSize: '0.78rem', fontWeight: 600 }}>
                          <CheckCircle2 size={13} /> Eligible
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '999px', background: '#fef2f2', color: '#dc2626', fontSize: '0.78rem', fontWeight: 600 }}>
                          <XCircle size={13} /> Ineligible
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {s.is_active ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '999px', background: '#ecfdf5', color: '#059669', fontSize: '0.78rem', fontWeight: 500 }}>
                          <ShieldCheck size={13} /> Active
                        </span>
                      ) : s.is_registered ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '999px', background: '#fffbeb', color: '#b45309', fontSize: '0.78rem', fontWeight: 500 }}>
                          <ShieldAlert size={13} /> Suspended
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: '999px', background: '#f1f5f9', color: '#64748b', fontSize: '0.78rem' }}>
                          Unregistered
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        {/* Toggle Eligibility Button */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={actionLoading}
                          onClick={() => handleToggleEligibility(s.registration_number, s.is_eligible)}
                          title={s.is_eligible ? 'Revoke student eligibility' : 'Grant student eligibility'}
                          style={{
                            fontSize: '0.78rem',
                            padding: '0.3rem 0.65rem',
                            color: s.is_eligible ? 'var(--lost-accent, #dc2626)' : 'var(--found-accent, #059669)',
                          }}
                        >
                          {s.is_eligible ? <UserX size={14} /> : <UserCheck size={14} />}
                          <span style={{ marginLeft: '0.25rem' }}>{s.is_eligible ? 'Revoke' : 'Grant'}</span>
                        </button>

                        {/* Toggle Active Button (if registered) */}
                        {s.is_registered && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={actionLoading}
                            onClick={() => handleToggleActive(s.registration_number, s.is_active)}
                            title={s.is_active ? 'Suspend student account' : 'Reactivate student account'}
                            style={{
                              fontSize: '0.78rem',
                              padding: '0.3rem 0.65rem',
                              color: s.is_active ? 'var(--lost-accent, #dc2626)' : 'var(--found-accent, #059669)',
                            }}
                          >
                            {s.is_active ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {total > limit && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle, #f1f5f9)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <div>
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total} students
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </button>
              <span style={{ alignSelf: 'center', padding: '0 0.5rem' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
