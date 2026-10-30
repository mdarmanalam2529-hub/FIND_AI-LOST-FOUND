// Frontend service for fetching the unified admin dashboard statistics

import { supabase } from '../lib/supabase';

/**
 * Retrieves the authentication header using the same logic as other services.
 * Returns an object suitable for fetch headers.
 */
async function getAuthHeader() {
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

export const adminService = {
  /**
   * Fetch aggregated dashboard data from the backend.
   * Returns the inner metrics object (stats) for the UI.
   */
  async fetchDashboard() {
    const headers = await getAuthHeader();
    const response = await fetch('/api/admin/dashboard', {
      method: 'GET',
      headers,
    });

    // Ensure we get JSON even on error pages
    let payload;
    try {
      payload = await response.json();
    } catch (e) {
      throw new Error('Failed to parse server response as JSON.');
    }

    if (!response.ok) {
      const msg = payload?.message || payload?.error || `Failed to fetch admin dashboard (HTTP ${response.status})`;
      throw new Error(msg);
    }

    if (!payload?.success) {
      throw new Error(payload?.message || 'Unexpected dashboard response format.');
    }

    const stats = payload.stats || payload.dashboard;
    if (!stats) {
      throw new Error('Dashboard payload missing expected data.');
    }
    // Flatten the stats for easier consumption in the UI
    const data = {
      totalStudents: stats.students?.total ?? 0,
      totalLostReports: stats.reports?.lost ?? 0,
      totalFoundReports: stats.reports?.found ?? 0,
      totalClaims: stats.claims?.open ?? 0,
      totalHandovers: stats.handovers?.active ?? 0,
      totalIncidents: stats.incidents?.open ?? 0,
      recentAudits: stats.recentAudits ?? [],
    };
    return data;
  },
};
