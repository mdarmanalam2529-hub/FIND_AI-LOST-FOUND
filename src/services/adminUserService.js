import { supabase } from '../lib/supabase.js';

async function getAuthHeaders() {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('Authentication required: please log in to proceed.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export const adminUserService = {
  /**
   * Fetch all staff and administrator accounts.
   */
  async listUsers() {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/users', { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch administrative users.');
    }
    return data;
  },

  /**
   * Create a new staff or admin account.
   */
  async createUser({ email, password, fullName, role }) {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, fullName, role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create account.');
    }
    return data;
  },

  /**
   * Update an account's role.
   */
  async updateRole(userId, newRole) {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ newRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update account role.');
    }
    return data;
  },

  /**
   * Update account active status (activate/deactivate).
   */
  async updateStatus(userId, isActive) {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update account status.');
    }
    return data;
  },

  /**
   * Delete an account.
   */
  async deleteUser(userId) {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to delete account.');
    }
    return data;
  },

  /**
   * Fetch audit logs for role and account administration.
   */
  async fetchAuditLogs() {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/admin/users/audit-logs', { method: 'GET', headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch audit logs.');
    }
    return data;
  },
};

