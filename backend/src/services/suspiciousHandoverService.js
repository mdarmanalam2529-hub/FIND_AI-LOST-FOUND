/**
-- ==============================================================================
-- Module: suspiciousHandoverService.js
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 1: Suspicious Handover Detection & Security Verification Engine
-- ==============================================================================
*/

import crypto from 'node:crypto';
import { isAuthorizedAdmin } from './claimWorkflow.js';

export const BURST_WINDOW_MS = 10 * 60 * 1000;          // 10 minutes
export const BURST_THRESHOLD = 5;                       // 5 unusual attempts in 10 mins

export const INCIDENT_TYPES = [
  'unauthorized_attempt',
  'premature_confirmation',
  'conflicting_claims',
  'unusual_attempt_burst',
];

export const INCIDENT_STATUSES = [
  'pending_review',
  'under_review',
  'cleared',
  'confirmed_violation',
];

export const INCIDENT_SEVERITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// In-Memory tracker for rapid anomalous attempt bursts
export const attemptTracker = new Map();

// In-Memory store for incident records (used as resilient fallback / cache)
export const inMemoryIncidents = new Map();

/**
 * Periodically purge stale entries from attemptTracker
 */
const trackerCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of attemptTracker.entries()) {
    const fresh = timestamps.filter((t) => now - t <= BURST_WINDOW_MS);
    if (fresh.length === 0) {
      attemptTracker.delete(key);
    } else {
      attemptTracker.set(key, fresh);
    }
  }
}, 5 * 60 * 1000);
if (trackerCleanup.unref) trackerCleanup.unref();


/**
 * Records an unusual attempt timestamp and detects rapid bursts.
 */
export function trackAttempt(key) {
  const now = Date.now();
  const existing = attemptTracker.get(key) || [];
  const fresh = existing.filter((t) => now - t <= BURST_WINDOW_MS);
  fresh.push(now);
  attemptTracker.set(key, fresh);

  return {
    count: fresh.length,
    isBurst: fresh.length >= BURST_THRESHOLD,
  };
}

/**
 * Sanitizes metadata to ensure zero passwords, plaintext OTPs, or tokens are logged.
 */
export function sanitizeIncidentMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') return {};

  const clean = {};
  const SENSITIVE_KEYS = ['password', 'otp', 'token', 'secret', 'credential', 'pin', 'key'];

  for (const [k, v] of Object.entries(metadata)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s));
    if (isSensitive) {
      clean[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      clean[k] = sanitizeIncidentMetadata(v);
    } else {
      clean[k] = v;
    }
  }

  return clean;
}

/**
 * Generates unique incident identifier.
 */
export function generateIncidentId() {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INC-${timestamp}-${randomPart}`;
}

/**
 * Records a suspicious handover incident securely with deduplication.
 * If an active incident for the same handover and type exists, increments attempt_count.
 */
export async function recordSuspiciousIncident({
  supabaseClient,
  handoverId,
  claimId = null,
  foundItemId = null,
  userId = null,
  registrationNumber = null,
  incidentType,
  reason,
  severity = INCIDENT_SEVERITIES.MEDIUM,
  metadata = {},
}) {
  const nowIso = new Date().toISOString();
  const sanitizedMeta = sanitizeIncidentMetadata(metadata);

  // 1. In-Memory Deduplication / Registration
  let existingIncident = null;

  for (const inc of inMemoryIncidents.values()) {
    if (
      inc.handover_id === handoverId &&
      inc.incident_type === incidentType &&
      (inc.status === 'pending_review' || inc.status === 'under_review')
    ) {
      existingIncident = inc;
      break;
    }
  }

  if (existingIncident) {
    existingIncident.attempt_count += 1;
    existingIncident.last_attempt_at = nowIso;
    existingIncident.metadata = { ...existingIncident.metadata, ...sanitizedMeta, lastAttempt: nowIso };
  } else {
    const newInc = {
      id: crypto.randomUUID(),
      incident_id: generateIncidentId(),
      handover_id: handoverId || null,
      claim_id: claimId || null,
      found_item_id: foundItemId || null,
      user_id: userId || null,
      registration_number: registrationNumber || null,
      incident_type: incidentType,
      severity,
      status: 'pending_review',
      reason: String(reason).trim(),
      attempt_count: 1,
      first_attempt_at: nowIso,
      last_attempt_at: nowIso,
      reviewed_by: null,
      reviewed_at: null,
      decision_notes: null,
      resolution_action: null,
      metadata: sanitizedMeta,
      created_at: nowIso,
      updated_at: nowIso,
    };
    inMemoryIncidents.set(newInc.id, newInc);
    existingIncident = newInc;
  }

  // 2. Database persistence via Supabase if client available
  if (supabaseClient) {
    try {
      // Check if open incident exists in DB
      let query = supabaseClient
        .from('handover_incidents')
        .select('*')
        .eq('incident_type', incidentType)
        .in('status', ['pending_review', 'under_review']);

      if (handoverId) {
        query = query.eq('handover_id', handoverId);
      }

      const { data: dbExisting, error: findError } = await query.maybeSingle();

      if (!findError && dbExisting) {
        // Increment existing incident in DB
        await supabaseClient
          .from('handover_incidents')
          .update({
            attempt_count: (dbExisting.attempt_count || 1) + 1,
            last_attempt_at: nowIso,
            metadata: { ...dbExisting.metadata, ...sanitizedMeta },
          })
          .eq('id', dbExisting.id);
        existingIncident.id = dbExisting.id;
        existingIncident.incident_id = dbExisting.incident_id;
      } else {
        // Insert new record into DB
        const { data: inserted, error: insertError } = await supabaseClient
          .from('handover_incidents')
          .insert({
            incident_id: existingIncident.incident_id,
            handover_id: handoverId || null,
            claim_id: claimId || null,
            found_item_id: foundItemId || null,
            user_id: userId || null,
            registration_number: registrationNumber || null,
            incident_type: incidentType,
            severity,
            status: 'pending_review',
            reason: String(reason).trim(),
            attempt_count: 1,
            first_attempt_at: nowIso,
            last_attempt_at: nowIso,
            metadata: sanitizedMeta,
          })
          .select()
          .maybeSingle();

        if (!insertError && inserted) {
          existingIncident.id = inserted.id;
        }
      }
    } catch (err) {
      console.warn('[Handover Incident] Database log notice (fallback to in-memory):', err.message);
    }
  }

  return existingIncident;
}

/**
 * Places a handover on administrative hold due to suspicious activity.
 * Sets status = 'suspended', is_flagged = true.
 */
export async function applyHandoverHold(supabaseClient, { handoverId, reason, actorId: _actorId = 'system' }) {
  const nowIso = new Date().toISOString();

  // In-memory hold update
  for (const inc of inMemoryIncidents.values()) {
    if (inc.handover_id === handoverId) {
      inc.hold_applied = true;
    }
  }

  if (supabaseClient && handoverId) {
    try {
      await supabaseClient
        .from('item_handovers')
        .update({
          status: 'suspended',
          is_flagged: true,
          flagged_reason: reason,
          updated_at: nowIso,
        })
        .eq('id', handoverId);
    } catch (err) {
      console.warn('[Handover Hold] Failed to apply hold in DB:', err.message);
    }
  }

  return { holdApplied: true, handoverId, reason };
}

/**
 * Releases administrative hold after security review.
 * Only authorized admins can perform this action.
 */
export async function releaseHandoverHold(supabaseClient, { handoverId, adminUser, decisionNotes }) {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized: Requires administrator or security reviewer privileges.');
  }

  if (!decisionNotes || !String(decisionNotes).trim()) {
    throw new Error('Mandatory decision notes are required to release an administrative hold.');
  }

  const nowIso = new Date().toISOString();

  // Update DB handover record
  if (supabaseClient && handoverId) {
    try {
      await supabaseClient
        .from('item_handovers')
        .update({
          status: 'scheduled',
          is_flagged: false,
          flagged_reason: null,
          updated_at: nowIso,
        })
        .eq('id', handoverId);
    } catch (err) {
      console.warn('[Handover Release] DB update error:', err.message);
    }
  }

  return { holdReleased: true, handoverId, decisionNotes };
}
