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

export const adminReportService = {
  /**
   * Fetch paginated reports with moderation indicators and filters
   */
  async fetchReports({
    page = 1,
    limit = 20,
    itemType = 'all',
    status = 'all',
    category = 'all',
    indicator = 'all',
    search = '',
  } = {}) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    if (itemType && itemType !== 'all') params.set('item_type', itemType);
    if (status && status !== 'all') params.set('status', status);
    if (category && category !== 'all') params.set('category', category);
    if (indicator && indicator !== 'all') params.set('indicator', indicator);
    if (search && search.trim()) params.set('search', search.trim());

    const response = await fetch(`/api/admin/reports?${params.toString()}`, {
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
      if (response.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      }
      if (response.status === 403) {
        throw new Error('Access denied: Administrator or reviewer privileges required.');
      }
      throw new Error(payload?.message || payload?.error || `Failed to fetch reports (HTTP ${response.status})`);
    }

    return payload;
  },

  /**
   * Fetch deep report detail, audit trail, and associated claims
   */
  async fetchReport(id) {
    if (!id) throw new Error('Report ID is required.');
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/admin/reports/${encodeURIComponent(id)}`, {
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
      if (response.status === 404) throw new Error('Report not found.');
      throw new Error(payload?.message || payload?.error || 'Failed to fetch report details.');
    }

    return payload.report;
  },

  /**
   * Fetch candidate AI matches for this report
   */
  async fetchMatches(id) {
    if (!id) throw new Error('Report ID is required.');
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/admin/reports/${encodeURIComponent(id)}/matches`, {
      method: 'GET',
      headers,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Failed to parse match response as JSON.');
    }

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Failed to fetch candidate matches.');
    }

    return payload.matches || [];
  },

  /**
   * Execute moderation action on a report
   */
  async moderateReport(id, { action, reason = '', details = {} } = {}) {
    if (!id) throw new Error('Report ID is required.');
    if (!action) throw new Error('Moderation action is required.');

    const headers = await getAuthHeaders();
    const response = await fetch(`/api/admin/reports/${encodeURIComponent(id)}/moderate`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action, reason, details }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Failed to parse server response as JSON.');
    }

    if (!response.ok) {
      if (response.status === 401) throw new Error('Session expired. Please log in again.');
      if (response.status === 403) throw new Error(payload?.message || 'Access denied: insufficient permissions.');
      if (response.status === 400) throw new Error(payload?.message || 'Invalid request parameters or status transition.');
      throw new Error(payload?.message || payload?.error || `Moderation action failed (HTTP ${response.status})`);
    }

    return payload;
  },
};
