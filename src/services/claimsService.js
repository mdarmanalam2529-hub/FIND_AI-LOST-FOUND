import { supabase } from '../lib/supabase';

/**
 * Service for Hybrid Claim & Return System.
 * Connects to /api/claims, /api/handovers, and /api/notifications through the Vite proxy.
 * Obtains and sends the active Supabase session access token via Authorization: Bearer.
 */

async function getAuthHeader() {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('Authentication required: please log in to proceed.');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

export const claimsService = {
  /**
   * Submit a new claim for a found report
   */
  async submitClaim({ foundItemId, lostItemId, claimMessage, privateProof = {} }) {
    const headers = await getAuthHeader();

    const response = await fetch('/api/claims', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        foundItemId,
        lostItemId,
        claimMessage,
        privateProof,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to submit claim (HTTP ${response.status})`);
    }
    return data;
  },

  /**
   * Fetch user's incoming claims, outgoing claims, and admin queue
   */
  async fetchClaims() {
    const headers = await getAuthHeader();

    const response = await fetch('/api/claims', {
      method: 'GET',
      headers,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch claims (HTTP ${response.status})`);
    }
    return data; // { outgoing, incoming, adminQueue, isAdmin }
  },

  /**
   * Finder or Admin review action
   */
  async reviewClaim(claimId, { action, reason = '', adminNotes = '' }) {
    const headers = await getAuthHeader();

    const response = await fetch(`/api/claims/${claimId}/review`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action, reason, adminNotes }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to review claim (HTTP ${response.status})`);
    }
    return data;
  },

  /**
   * Coordinate handover location, date/time, and notes
   */
  async coordinateHandover(handoverId, { proposedLocation, scheduledAt = null, notes = '' }) {
    const headers = await getAuthHeader();

    const response = await fetch(`/api/handovers/${handoverId}/coordinate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ proposedLocation, scheduledAt, notes }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to coordinate handover (HTTP ${response.status})`);
    }
    return data;
  },

  /**
   * Confirm handover (Finder confirms handed over, Claimant confirms received)
   */
  async confirmHandover(handoverId, confirmationType) {
    const headers = await getAuthHeader();

    const response = await fetch(`/api/handovers/${handoverId}/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmationType }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to confirm handover (HTTP ${response.status})`);
    }
    return data;
  },

  /**
   * Fetch in-app notifications
   */
  async fetchNotifications() {
    const headers = await getAuthHeader();

    const response = await fetch('/api/notifications', {
      method: 'GET',
      headers,
    });

    const data = await response.json();
    if (!response.ok) {
      return { notifications: [], unreadCount: 0 };
    }
    return data; // { notifications, unreadCount }
  },

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId) {
    const headers = await getAuthHeader();

    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers,
    });

    return response.ok;
  },

  /**
   * Fetch suspicious handover incidents for administrator review
   */
  async fetchIncidents({ status = 'all', severity = 'all', incidentType = 'all', search = '' } = {}) {
    const headers = await getAuthHeader();
    const params = new URLSearchParams();
    if (status !== 'all') params.append('status', status);
    if (severity !== 'all') params.append('severity', severity);
    if (incidentType !== 'all') params.append('incidentType', incidentType);
    if (search) params.append('search', search);

    const url = `/api/admin/incidents${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch incidents (HTTP ${response.status})`);
    }
    return data; // { incidents, count }
  },

  /**
   * Fetch incident summary statistics
   */
  async fetchIncidentStats() {
    const headers = await getAuthHeader();
    const response = await fetch('/api/admin/incidents/stats', { method: 'GET', headers });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch incident stats (HTTP ${response.status})`);
    }
    return data.stats;
  },

  /**
   * Submit an administrative review decision on an incident
   */
  async reviewIncident(incidentId, { status, decisionNotes, releaseHold = false }) {
    const headers = await getAuthHeader();
    const response = await fetch(`/api/admin/incidents/${incidentId}/review`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, decisionNotes, releaseHold }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Failed to review incident (HTTP ${response.status})`);
    }
    return data;
  },
};
