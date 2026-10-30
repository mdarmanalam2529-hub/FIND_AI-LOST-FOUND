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

export const adminHandoverService = {
  /**
   * Fetch paginated handovers with confirmation status and filters
   */
  async fetchHandovers({
    page = 1,
    limit = 20,
    status = 'all',
    confirmationStatus = 'all',
    isFlagged = 'all',
    search = '',
  } = {}) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    if (status && status !== 'all') params.set('status', status);
    if (confirmationStatus && confirmationStatus !== 'all') params.set('confirmation_status', confirmationStatus);
    if (isFlagged && isFlagged !== 'all') params.set('is_flagged', isFlagged);
    if (search && search.trim()) params.set('search', search.trim());

    const response = await fetch(`/api/admin/handovers?${params.toString()}`, {
      method: 'GET',
      headers,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Failed to parse server response as JSON.');
    }

    if (!response.ok) {
      if (response.status === 401) throw new Error('Your session has expired. Please log in again.');
      if (response.status === 403) throw new Error('Access denied: Administrator or reviewer privileges required.');
      throw new Error(payload?.message || payload?.error || `Failed to fetch handovers (HTTP ${response.status})`);
    }

    return payload;
  },

  /**
   * Fetch single handover deep detail with timeline and audit trail
   */
  async fetchHandover(id) {
    if (!id) throw new Error('Handover ID is required.');
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/admin/handovers/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Failed to parse server response as JSON.');
    }

    if (!response.ok) {
      if (response.status === 401) throw new Error('Authentication required.');
      if (response.status === 403) throw new Error('Access denied: Administrator privileges required.');
      if (response.status === 404) throw new Error('Handover record not found.');
      throw new Error(payload?.message || payload?.error || 'Failed to fetch handover details.');
    }

    return payload.handover;
  },

  /**
   * Suspend a suspicious handover and place on administrative hold
   */
  async suspendHandover(id, { reason }) {
    if (!id) throw new Error('Handover ID is required.');
    if (!reason || reason.trim().length < 3) throw new Error('Mandatory reason of at least 3 characters is required.');

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/admin/handovers/${encodeURIComponent(id)}/suspend`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ reason: reason.trim() }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Failed to parse server response as JSON.');
    }

    if (!response.ok) {
      if (response.status === 401) throw new Error('Session expired. Please log in again.');
      if (response.status === 403) throw new Error(payload?.message || 'Access denied.');
      throw new Error(payload?.message || payload?.error || 'Failed to suspend handover.');
    }

    return payload;
  },

  /**
   * Release an administrative hold on a suspended handover
   */
  async releaseHold(id, { reason }) {
    if (!id) throw new Error('Handover ID is required.');
    if (!reason || reason.trim().length < 3) throw new Error('Mandatory explanation reason of at least 3 characters is required.');

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/admin/handovers/${encodeURIComponent(id)}/release-hold`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ reason: reason.trim() }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Failed to parse server response as JSON.');
    }

    if (!response.ok) {
      if (response.status === 401) throw new Error('Session expired. Please log in again.');
      if (response.status === 403) throw new Error(payload?.message || 'Access denied.');
      throw new Error(payload?.message || payload?.error || 'Failed to release hold.');
    }

    return payload;
  },
};

