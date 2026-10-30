/**
-- ==============================================================================
-- Module: incidentRoutes.js
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 1: Protected Admin / Security Reviewer Incident Verification Endpoints
-- ==============================================================================
*/

import express from 'express';
import { isAuthorizedAdmin, createAuditEntry } from './claimWorkflow.js';
import {
  inMemoryIncidents,
  releaseHandoverHold,
  INCIDENT_STATUSES,
} from './suspiciousHandoverService.js';

export const adminIncidentRouter = express.Router();

/**
 * Middleware: Verify authorized admin or security reviewer.
 */
function requireAdmin(req, res, next) {
  if (!req.user || !isAuthorizedAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied: Requires administrator or security reviewer privileges.',
    });
  }
  next();
}

/**
 * GET /api/admin/incidents
 * Retrieves list of suspicious handover incidents with filtering options.
 */
adminIncidentRouter.get('/', requireAdmin, async (req, res) => {
  const { status, severity, incidentType, search } = req.query;
  const serviceSupabase = req.serviceSupabase;

  let incidents = [];

  // 1. Fetch from Supabase database if available
  if (serviceSupabase) {
    try {
      let query = serviceSupabase
        .from('handover_incidents')
        .select('*, handover:item_handovers!handover_id(id, status, proposed_location, is_flagged), claim:item_claims!claim_id(id, status, found_item:items!found_item_id(id, title, category))')
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status.trim());
      }
      if (severity && severity !== 'all') {
        query = query.eq('severity', severity.trim());
      }
      if (incidentType && incidentType !== 'all') {
        query = query.eq('incident_type', incidentType.trim());
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        incidents = data;
      }
    } catch (err) {
      console.warn('[Admin Incidents API] DB fetch warning (falling back to memory):', err.message);
    }
  }

  // 2. If DB returned empty or wasn't configured, merge from inMemoryIncidents
  if (incidents.length === 0 && inMemoryIncidents.size > 0) {
    incidents = Array.from(inMemoryIncidents.values());

    if (status && status !== 'all') {
      incidents = incidents.filter((i) => i.status === status.trim());
    }
    if (severity && severity !== 'all') {
      incidents = incidents.filter((i) => i.severity === severity.trim());
    }
    if (incidentType && incidentType !== 'all') {
      incidents = incidents.filter((i) => i.incident_type === incidentType.trim());
    }
  }

  // 3. Apply optional search filter across incident_id, reason, registration_number
  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    incidents = incidents.filter(
      (inc) =>
        (inc.incident_id && inc.incident_id.toLowerCase().includes(s)) ||
        (inc.reason && inc.reason.toLowerCase().includes(s)) ||
        (inc.registration_number && inc.registration_number.toLowerCase().includes(s)) ||
        (inc.claim_id && inc.claim_id.toLowerCase().includes(s))
    );
  }

  return res.json({
    success: true,
    count: incidents.length,
    incidents,
  });
});

/**
 * GET /api/admin/incidents/stats
 * Returns aggregate metrics for the incident dashboard.
 */
adminIncidentRouter.get('/stats', requireAdmin, async (req, res) => {
  const serviceSupabase = req.serviceSupabase;

  let total = 0;
  let pendingReview = 0;
  let underReview = 0;
  let cleared = 0;
  let confirmedViolation = 0;

  if (serviceSupabase) {
    try {
      const [
        { count: tCount },
        { count: pCount },
        { count: uCount },
        { count: cCount },
        { count: vCount },
      ] = await Promise.all([
        serviceSupabase.from('handover_incidents').select('*', { count: 'exact', head: true }),
        serviceSupabase.from('handover_incidents').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        serviceSupabase.from('handover_incidents').select('*', { count: 'exact', head: true }).eq('status', 'under_review'),
        serviceSupabase.from('handover_incidents').select('*', { count: 'exact', head: true }).eq('status', 'cleared'),
        serviceSupabase.from('handover_incidents').select('*', { count: 'exact', head: true }).eq('status', 'confirmed_violation'),
      ]);

      total = tCount || 0;
      pendingReview = pCount || 0;
      underReview = uCount || 0;
      cleared = cCount || 0;
      confirmedViolation = vCount || 0;
    } catch {
      // Fallback to in-memory stats
    }
  }

  // Fallback to in-memory stats if total is 0
  if (total === 0 && inMemoryIncidents.size > 0) {
    const list = Array.from(inMemoryIncidents.values());
    total = list.length;
    pendingReview = list.filter((i) => i.status === 'pending_review').length;
    underReview = list.filter((i) => i.status === 'under_review').length;
    cleared = list.filter((i) => i.status === 'cleared').length;
    confirmedViolation = list.filter((i) => i.status === 'confirmed_violation').length;
  }

  return res.json({
    success: true,
    stats: {
      total,
      pendingReview,
      underReview,
      cleared,
      confirmedViolation,
    },
  });
});

/**
 * PATCH /api/admin/incidents/:id/review
 * Updates incident review status and optionally releases or maintains administrative hold.
 * Consequential decisions ('cleared', 'confirmed_violation') mandate documented decision notes.
 */
adminIncidentRouter.patch('/:id/review', requireAdmin, async (req, res) => {
  const incidentId = req.params.id;
  const { status, decisionNotes, releaseHold = false } = req.body;
  const adminUser = req.user;
  const serviceSupabase = req.serviceSupabase;

  if (!incidentId) {
    return res.status(400).json({ error: 'Bad Request', message: 'Incident ID is required.' });
  }

  if (!status || !INCIDENT_STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'Invalid Status',
      message: `Status must be one of: ${INCIDENT_STATUSES.join(', ')}`,
    });
  }

  // Consequential decisions require a reason
  const isConsequential = status === 'cleared' || status === 'confirmed_violation';
  if (isConsequential && (!decisionNotes || !String(decisionNotes).trim())) {
    return res.status(400).json({
      error: 'Decision Notes Required',
      message: 'Documented decision notes/justification are mandatory for resolving or confirming an incident.',
    });
  }

  const nowIso = new Date().toISOString();
  let updatedIncident = null;

  // 1. Update in memory
  for (const inc of inMemoryIncidents.values()) {
    if (inc.id === incidentId || inc.incident_id === incidentId) {
      inc.status = status;
      inc.decision_notes = decisionNotes ? String(decisionNotes).trim() : null;
      inc.reviewed_by = adminUser.id;
      inc.reviewed_at = nowIso;
      inc.updated_at = nowIso;
      if (status === 'cleared' && releaseHold) {
        inc.resolution_action = 'hold_released';
      } else if (status === 'confirmed_violation') {
        inc.resolution_action = 'hold_maintained';
      }
      updatedIncident = inc;
      break;
    }
  }

  // 2. Update database record if available
  if (serviceSupabase) {
    try {
      const updatePayload = {
        status,
        decision_notes: decisionNotes ? String(decisionNotes).trim() : null,
        reviewed_by: adminUser.id,
        reviewed_at: nowIso,
        updated_at: nowIso,
      };

      if (status === 'cleared' && releaseHold) {
        updatePayload.resolution_action = 'hold_released';
      } else if (status === 'confirmed_violation') {
        updatePayload.resolution_action = 'hold_maintained';
      }

      const { data: dbUpdated, error: upError } = await serviceSupabase
        .from('handover_incidents')
        .update(updatePayload)
        .or(`id.eq.${incidentId},incident_id.eq.${incidentId}`)
        .select()
        .maybeSingle();

      if (!upError && dbUpdated) {
        updatedIncident = dbUpdated;
      }
    } catch (err) {
      console.warn('[Admin Review Incident] DB update error:', err.message);
    }
  }

  if (!updatedIncident) {
    return res.status(404).json({ error: 'Not Found', message: 'Incident record not found.' });
  }

  // 3. If clearing incident and requested to release hold on handover
  if (status === 'cleared' && releaseHold && updatedIncident.handover_id) {
    try {
      await releaseHandoverHold(serviceSupabase, {
        handoverId: updatedIncident.handover_id,
        adminUser,
        decisionNotes: decisionNotes || 'Administrative hold released after incident review cleared.',
      });
    } catch (releaseErr) {
      console.error('[Admin Review Incident] Failed to release handover hold:', releaseErr.message);
    }
  }

  // 4. Record action in admin audit trail
  try {
    const _auditRecord = createAuditEntry({
      actorId: adminUser.id,
      actorEmail: adminUser.email,
      actorRole: adminUser.app_metadata?.role || 'admin',
      action: `incident_${status}`,
      reason: decisionNotes || `Incident status updated to ${status}`,
      details: {
        incidentId: updatedIncident.incident_id || incidentId,
        incidentType: updatedIncident.incident_type,
        releaseHold: Boolean(releaseHold),
      },
    });

    if (serviceSupabase) {
      await serviceSupabase.from('admin_audit_logs').insert({
        actor_id: adminUser.id,
        actor_name: adminUser.user_metadata?.full_name || 'Administrator',
        actor_email: adminUser.email || 'admin@university.edu',
        actor_role: adminUser.app_metadata?.role || 'admin',
        action: `incident_${status}`,
        target_type: 'handover_incident',
        target_identifier: updatedIncident.incident_id || incidentId,
        reason: decisionNotes || `Status updated to ${status}`,
        details: { releaseHold: Boolean(releaseHold), incidentType: updatedIncident.incident_type },
      }).catch(() => {});
    }
  } catch (auditErr) {
    console.warn('[Admin Incident Audit] Warning recording audit log:', auditErr.message);
  }

  return res.json({
    success: true,
    message: `Incident review decision recorded: ${status}.`,
    incident: updatedIncident,
  });
});
