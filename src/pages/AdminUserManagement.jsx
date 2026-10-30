import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminUserService } from '../services/adminUserService';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  UserX,
  UserCheck,
  History,
  X,
  Mail,
  Lock,
  User as UserIcon,
} from 'lucide-react';

export default function AdminUserManagement() {
  const { user: authUser, loading: authLoading } = useAuth();

  const [users, setUsers] = useState([]);
  const [currentUserMeta, setCurrentUserMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // Modals & Panels
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Add User Form State
  const [newUserData, setNewUserData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'staff',
  });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState(null);

  // Action State (Role update, Status change, Deletion)
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminUserService.listUsers();
      setUsers(data.users || []);
      setCurrentUserMeta(data.currentUser || null);
    } catch (err) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && authUser) {
      fetchUsers();
    }
  }, [authLoading, authUser, fetchUsers]);

  const showToast = (message) => {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const isPrimary = currentUserMeta?.isPrimaryAdmin || false;

  // Add Privileged Account
  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddUserError(null);
    setAddUserLoading(true);

    try {
      await adminUserService.createUser(newUserData);
      showToast(`${newUserData.role === 'admin' ? 'Administrator' : 'Staff member'} added successfully.`);
      setShowAddModal(false);
      setNewUserData({ fullName: '', email: '', password: '', role: 'staff' });
      await fetchUsers();
    } catch (err) {
      setAddUserError(err.message || 'Failed to create privileged user.');
    } finally {
      setAddUserLoading(false);
    }
  };

  // Change Role
  const handleRoleChange = async (userId, newRole) => {
    setActionLoadingId(userId);
    try {
      await adminUserService.updateRole(userId, newRole);
      showToast('Account role updated successfully.');
      await fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update role.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (userId, currentStatus) => {
    setActionLoadingId(userId);
    try {
      await adminUserService.updateStatus(userId, !currentStatus);
      showToast(`Account ${!currentStatus ? 'reactivated' : 'deactivated'} successfully.`);
      await fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update account status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId, email) => {
    if (!window.confirm(`Are you sure you want to remove the privileged account for ${email}?`)) {
      return;
    }
    setActionLoadingId(userId);
    try {
      await adminUserService.deleteUser(userId);
      showToast('Account deleted successfully.');
      await fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Fetch Audit Logs
  const loadAuditLogs = async () => {
    setShowAuditLogs(true);
    setAuditLoading(true);
    try {
      const data = await adminUserService.fetchAuditLogs();
      setAuditLogs(data.logs || []);
    } catch (err) {
      alert(err.message || 'Failed to fetch audit history.');
    } finally {
      setAuditLoading(false);
    }
  };

  // Stats calculation
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === 'admin' || u.role === 'primary_admin' || u.isPrimaryAdmin).length;
  const staffCount = users.filter((u) => u.role === 'staff').length;
  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '1200px' }}>
      {/* Toast Notification */}
      {successToast && (
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
            animation: 'fadeIn 0.2s ease',
          }}
          id="admin-users-toast"
        >
          <CheckCircle2 size={18} />
          <span style={{ fontSize: '0.92rem', fontWeight: 500 }}>{successToast}</span>
        </div>
      )}

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <div className="brand-icon-wrap" style={{ width: '38px', height: '38px' }}>
              <Shield size={20} color="#ffffff" />
            </div>
            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Admin Management</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
            Manage staff members, administrator privileges, and access delegation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadAuditLogs}
            id="admin-users-audit-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <History size={16} /> Audit Logs
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchUsers}
            disabled={loading}
            id="admin-users-refresh-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setAddUserError(null);
              setShowAddModal(true);
            }}
            id="admin-users-add-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <UserPlus size={16} /> Add Privileged User
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Users size={18} color="var(--primary)" />
            <span>Total Privileged Users</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem' }}>{totalUsers}</div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <ShieldCheck size={18} color="var(--primary-dark, #1e40af)" />
            <span>Administrators</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--primary-dark, #1e40af)' }}>
            {adminCount}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Shield size={18} color="var(--found-accent, #059669)" />
            <span>Staff Members</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--found-accent, #059669)' }}>
            {staffCount}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <CheckCircle2 size={18} color="var(--found-accent, #059669)" />
            <span>Active Accounts</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem' }}>{activeCount}</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card" style={{ padding: '1.5rem', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading staff and administrator accounts...</p>
          </div>
        ) : error ? (
          <div
            style={{
              padding: '1.5rem',
              background: 'var(--lost-subtle)',
              border: '1px solid var(--lost-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--lost-accent)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
            <p style={{ margin: 0 }}>No privileged accounts registered yet.</p>
          </div>
        ) : (
          <div className="table-responsive" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem', minWidth: '660px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle, #e2e8f0)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>User & Email</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Assigned Role</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Account Status</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Created / Last Active</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((account) => {
                  const isAccountPrimary = account.isPrimaryAdmin || account.role === 'primary_admin';
                  const isSelf = currentUserMeta?.id === account.id;
                  const isBusy = actionLoadingId === account.id;

                  return (
                    <tr
                      key={account.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Name & Email */}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main, #1e293b)' }}>
                          {account.fullName} {isSelf && <span style={{ fontSize: '0.78rem', color: 'var(--primary)', marginLeft: '0.35rem' }}>(You)</span>}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{account.email}</div>
                      </td>

                      {/* Role Badge */}
                      <td style={{ padding: '1rem' }}>
                        {isAccountPrimary ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              background: '#fef3c7',
                              color: '#92400e',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                            }}
                          >
                            <ShieldCheck size={14} /> Primary Administrator
                          </span>
                        ) : account.role === 'admin' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              background: 'var(--primary-subtle, #eff6ff)',
                              color: 'var(--primary-dark, #1e40af)',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                            }}
                          >
                            <Shield size={14} /> Administrator
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              background: 'var(--found-subtle, #ecfdf5)',
                              color: 'var(--found-accent, #059669)',
                              fontWeight: 500,
                              fontSize: '0.8rem',
                            }}
                          >
                            <Shield size={14} /> Staff Member
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '1rem' }}>
                        {account.isActive ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              background: 'var(--found-subtle, #ecfdf5)',
                              color: 'var(--found-accent, #059669)',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                            }}
                          >
                            <CheckCircle2 size={13} /> Active
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '999px',
                              background: 'var(--lost-subtle, #fef2f2)',
                              color: 'var(--lost-accent, #dc2626)',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                            }}
                          >
                            <ShieldAlert size={13} /> Deactivated
                          </span>
                        )}
                      </td>

                      {/* Dates */}
                      <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        <div>Added: {new Date(account.createdAt).toLocaleDateString()}</div>
                        {account.lastSignInAt && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            Active: {new Date(account.lastSignInAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {isBusy ? (
                          <Loader2 size={16} className="spin" style={{ color: 'var(--primary)' }} />
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            {/* Role selector: Only Primary Admin can modify roles between Staff and Admin */}
                            {isPrimary && !isAccountPrimary && (
                              <select
                                value={account.role}
                                onChange={(e) => handleRoleChange(account.id, e.target.value)}
                                style={{
                                  padding: '0.3rem 0.5rem',
                                  fontSize: '0.82rem',
                                  borderRadius: 'var(--radius-sm, 6px)',
                                  border: '1px solid var(--border-subtle, #cbd5e1)',
                                  background: '#ffffff',
                                  cursor: 'pointer',
                                }}
                                title="Change role"
                                id={`admin-user-role-select-${account.id}`}
                              >
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                              </select>
                            )}

                            {/* Deactivate / Reactivate button */}
                            {!isAccountPrimary && (isPrimary || account.role === 'staff') && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleToggleStatus(account.id, account.isActive)}
                                title={account.isActive ? 'Deactivate account' : 'Reactivate account'}
                                id={`admin-user-toggle-status-${account.id}`}
                                style={{
                                  padding: '0.35rem 0.55rem',
                                  color: account.isActive ? 'var(--lost-accent, #dc2626)' : 'var(--found-accent, #059669)',
                                }}
                              >
                                {account.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                              </button>
                            )}

                            {/* Delete button: Not allowed for Primary Admin; Ordinary admin can only delete staff */}
                            {!isAccountPrimary && (isPrimary || account.role === 'staff') && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleDeleteUser(account.id, account.email)}
                                title="Delete account"
                                id={`admin-user-delete-${account.id}`}
                                style={{ padding: '0.35rem 0.55rem', color: 'var(--lost-accent, #dc2626)' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Privileged User Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          id="admin-user-add-modal-overlay"
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '2rem',
              background: '#ffffff',
              borderRadius: 'var(--radius-lg, 12px)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserPlus size={20} color="var(--primary)" />
                <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Add Privileged User</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {addUserError && (
              <div
                style={{
                  background: 'var(--lost-subtle)',
                  border: '1px solid var(--lost-border)',
                  color: 'var(--lost-accent)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1rem',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{addUserError}</span>
              </div>
            )}

            <form onSubmit={handleAddUser}>
              {/* Full Name */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Officer James Smith"
                    value={newUserData.fullName}
                    onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    id="admin-add-user-name"
                  />
                  <UserIcon
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Staff / University Email</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    required
                    placeholder="e.g. security@university.edu"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    id="admin-add-user-email"
                  />
                  <Mail
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Initial Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem' }}
                    id="admin-add-user-password"
                  />
                  <Lock
                    size={16}
                    color="var(--text-muted)"
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Assigned Role</label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="form-input"
                  id="admin-add-user-role-select"
                >
                  <option value="staff">Staff Member (Reports, Claims, Handovers)</option>
                  {isPrimary && <option value="admin">Administrator (Full Admin & Staff Control)</option>}
                </select>
                {!isPrimary && (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Only Primary Administrators can appoint new Administrator accounts.
                  </p>
                )}
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={addUserLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addUserLoading}
                  id="admin-add-user-submit-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {addUserLoading ? (
                    <>
                      <Loader2 size={16} className="spin" /> Creating Account...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} /> Create Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Logs Drawer / Modal */}
      {showAuditLogs && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          id="admin-audit-logs-modal-overlay"
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '750px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <History size={20} color="var(--primary)" />
                <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Privileged Action Audit Logs</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditLogs(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {auditLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <Loader2 size={28} className="spin" style={{ color: 'var(--primary)', margin: '0 auto 0.75rem' }} />
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading audit records...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <History size={36} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0 }}>No audit log entries recorded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'var(--bg-subtle, #f8fafc)',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main, #0f172a)' }}>
                          {log.action}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.84rem', color: 'var(--text-secondary, #475569)' }}>
                        {log.reason || 'No description provided.'}
                      </p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        <span>Role: <strong>{log.actor_role}</strong></span>
                        {log.actor_id && <span>Actor ID: {log.actor_id.slice(0, 8)}...</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAuditLogs(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

