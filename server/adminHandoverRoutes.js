import express from 'express';
import { isAuthorizedAdmin } from './claimWorkflow.js';

export const adminHandoverRouter = express.Router();

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = ['proposed', 'scheduled', 'handover_pending', 'completed', 'suspended', 'cancelled'];

/**
 * Middleware: Verify authorized admin or security reviewer.
 */
export function requireAdminOrReviewer(req, res, next) {
  if (!req.user || !isAuthorizedAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied: Requires administrator or security reviewer privileges.',
    });
  }
  next();
}

/**
 * Helper to determine full admin authority.
 */
export function isFullAdmin(user) {
  if (!user || !isAuthorizedAdmin(user)) return false;
  if (user.app_metadata?.role === 'admin') return true;
  if (user.email && user.email_confirmed_at) {
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.includes(user.email.toLowerCase())) return true;
  }
  return false;
}

/**
 * Writes an immutable entry into public.admin_audit_logs.
 */
async function writeHandoverAuditLog(serviceSupabase, {
  actor,
  action,
  targetId,
  reason,
  details = {},
  ipAddress = null,
}) {
  if (!serviceSupabase) return null;

  const actorName = (
    actor?.user_metadata?.full_name ||
    actor?.email?.split('@')[0] ||
    'Administrator'
  ).trim();

  const actorEmail = (
    actor?.email && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(actor.email)
      ? actor.email
      : 'admin@university.edu'
  );

  const actorRole = actor?.app_metadata?.role || (isFullAdmin(actor) ? 'admin' : 'security_reviewer');

  const cleanReason = (reason && String(reason).trim().length >= 3)
    ? String(reason).trim()
    : 'Administrative handover action performed';

  const entry = {
    actor_id: actor?.id || null,
    actor_name: actorName.length >= 2 ? actorName : 'Admin',
    actor_email: actorEmail,
    actor_role: actorRole,
    action: String(action).trim(),
    target_type: 'item_handover',
    target_identifier: String(targetId).trim(),
    reason: cleanReason,
    details: typeof details === 'object' && details !== null ? details : {},
    ip_address: ipAddress || null,
  };

  try {
    const { data, error } = await serviceSupabase
      .from('admin_audit_logs')
      .insert([entry])
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Handover Audit Log] Insertion warning:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[Handover Audit Log] Unexpected insertion error:', err.message);
    return null;
  }
}

/**
 * Helper to compute confirmation state
 */
export function determineConfirmationState(handover) {
  const finderDone = Boolean(handover.finder_confirmed_at);
  const claimantDone = Boolean(handover.claimant_confirmed_at);

  if (handover.status === 'completed' || (finderDone && claimantDone)) {
    return 'completed';
  }
  if (finderDone && !claimantDone) {
    return 'awaiting_claimant';
  }
  if (!finderDone && claimantDone) {
    return 'awaiting_finder';
  }
  return 'pending_both';
}

/**
 * GET /api/admin/handovers
 * Retrieves paginated list of handovers with enriched claims, participant profiles,
 * confirmation statuses, and linked incidents.
 */
adminHandoverRouter.get('/', requireAdminOrReviewer, async (req, res) => {
  const serviceSupabase = req.serviceSupabase;
  if (!serviceSupabase) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Supabase service client not configured.',
    });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const statusFilter = req.query.status || 'all';
  const confirmationFilter = req.query.confirmation_status || 'all'; // 'all', 'pending_both', 'awaiting_claimant', 'awaiting_finder', 'completed'
  const isFlaggedFilter = req.query.is_flagged || 'all';
  const searchQuery = (req.query.search || '').trim().toLowerCase();

  try {
    // 1. Fetch handovers with joined claims and item details
    let query = serviceSupabase
      .from('item_handovers')
      .select(`
        *,
        claim:item_claims!claim_id (
          id,
          claimant_id,
          status,
          requires_admin_review,
          found_item:items!found_item_id (id, user_id, title, category, status, image_path, location_description),
          lost_item:items!lost_item_id (id, user_id, title, category, status, image_path, location_description)
        )
      `, { count: 'exact' });

    if (statusFilter !== 'all' && ALLOWED_STATUSES.includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }
    if (isFlaggedFilter === 'true') {
      query = query.eq('is_flagged', true);
    } else if (isFlaggedFilter === 'false') {
      query = query.eq('is_flagged', false);
    }

    query = query.order('created_at', { ascending: false });

    const { data: rawHandovers, error: fetchErr } = await query;
    if (fetchErr) {
      console.error('[Admin Handovers] DB fetch error:', fetchErr.message);
      return res.status(500).json({ error: 'Database Error', message: fetchErr.message });
    }

    const allHandovers = rawHandovers || [];
    const handoverIds = allHandovers.map((h) => h.id);

    // 2. Fetch linked incidents & audit logs in parallel
    const [incidentsRes, auditsRes] = await Promise.all([
      handoverIds.length > 0
        ? serviceSupabase
            .from('handover_incidents')
            .select('id, incident_id, handover_id, incident_type, severity, status, reason, created_at')
            .in('handover_id', handoverIds)
        : { data: [] },
      handoverIds.length > 0
        ? serviceSupabase
            .from('admin_audit_logs')
            .select('id, actor_name, actor_role, action, target_identifier, reason, details, created_at')
            .eq('target_type', 'item_handover')
            .in('target_identifier', handoverIds)
            .order('created_at', { ascending: false })
        : { data: [] },
    ]);

    const incidentsList = incidentsRes.data || [];
    const auditsList = auditsRes.data || [];

    const incidentsByHandover = new Map();
    for (const inc of incidentsList) {
      if (!incidentsByHandover.has(inc.handover_id)) {
        incidentsByHandover.set(inc.handover_id, []);
      }
      incidentsByHandover.get(inc.handover_id).push(inc);
    }

    const auditsByHandover = new Map();
    for (const log of auditsList) {
      if (!auditsByHandover.has(log.target_identifier)) {
        auditsByHandover.set(log.target_identifier, []);
      }
      auditsByHandover.get(log.target_identifier).push(log);
    }

    // 3. Enrich handovers with confirmation states and metadata
    const enriched = allHandovers.map((h) => {
      const confirmationState = determineConfirmationState(h);
      const linkedIncidents = incidentsByHandover.get(h.id) || [];
      const linkedAudits = auditsByHandover.get(h.id) || [];

      return {
        ...h,
        confirmation_state: confirmationState,
        incidents_count: linkedIncidents.length,
        has_incidents: linkedIncidents.some((i) => i.status !== 'cleared'),
        incidents: linkedIncidents,
        audit_history: linkedAudits,
      };
    });

    // 4. In-Memory Search & Confirmation Filter
    let filtered = enriched;

    if (confirmationFilter !== 'all') {
      filtered = filtered.filter((h) => h.confirmation_state === confirmationFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter((h) => {
        const text = `
          ${h.id}
          ${h.proposed_location || ''}
          ${h.notes || ''}
          ${h.flagged_reason || ''}
          ${h.claim?.found_item?.title || ''}
          ${h.claim?.lost_item?.title || ''}
          ${h.claim?.found_item?.category || ''}
        `.toLowerCase();
        return text.includes(searchQuery);
      });
    }

    // 5. Aggregate metrics
    const stats = {
      total: allHandovers.length,
      proposed: allHandovers.filter((h) => h.status === 'proposed').length,
      scheduled: allHandovers.filter((h) => h.status === 'scheduled').length,
      handover_pending: allHandovers.filter((h) => h.status === 'handover_pending').length,
      completed: allHandovers.filter((h) => h.status === 'completed').length,
      suspended: allHandovers.filter((h) => h.status === 'suspended').length,
      flagged: allHandovers.filter((h) => h.is_flagged).length,
    };

    // 6. Pagination
    const totalMatching = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return res.json({
      success: true,
      handovers: paginated,
      pagination: {
        total: totalMatching,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalMatching / limit)),
      },
      stats,
    });
  } catch (err) {
    console.error('[Admin Handovers] Error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * GET /api/admin/handovers/:id
 * Deep inspection of a single handover record.
 */
adminHandoverRouter.get('/:id', requireAdminOrReviewer, async (req, res) => {
  const { id } = req.params;
  const serviceSupabase = req.serviceSupabase;

  if (!id || !UUID_V4_REGEX.test(id.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid handover UUID v4 is required.' });
  }

  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Database service client not configured.' });
  }

  try {
    const { data: handover, error: hErr } = await serviceSupabase
      .from('item_handovers')
      .select(`
        *,
        claim:item_claims!claim_id (
          id,
          claimant_id,
          status,
          requires_admin_review,
          created_at,
          found_item:items!found_item_id (*),
          lost_item:items!lost_item_id (*)
        )
      `)
      .eq('id', id.trim())
      .maybeSingle();

    if (hErr || !handover) {
      return res.status(404).json({ error: 'Not Found', message: 'Handover record not found.' });
    }

    // Fetch linked incidents, audit logs, and participant profiles
    const [incidentsRes, auditsRes, claimantProfileRes, finderProfileRes] = await Promise.all([
      serviceSupabase
        .from('handover_incidents')
        .select('*')
        .eq('handover_id', handover.id)
        .order('created_at', { ascending: false }),
      serviceSupabase
        .from('admin_audit_logs')
        .select('*')
        .eq('target_type', 'item_handover')
        .eq('target_identifier', handover.id)
        .order('created_at', { ascending: false }),
      handover.claim?.claimant_id
        ? serviceSupabase
            .from('student_profiles')
            .select('registration_number, branch, academic_year, verification_status')
            .eq('user_id', handover.claim.claimant_id)
            .maybeSingle()
        : { data: null },
      handover.claim?.found_item?.user_id
        ? serviceSupabase
            .from('student_profiles')
            .select('registration_number, branch, academic_year, verification_status')
            .eq('user_id', handover.claim.found_item.user_id)
            .maybeSingle()
        : { data: null },
    ]);

    return res.json({
      success: true,
      handover: {
        ...handover,
        confirmation_state: determineConfirmationState(handover),
        claimant_profile: claimantProfileRes.data || null,
        finder_profile: finderProfileRes.data || null,
        incidents: incidentsRes.data || [],
        audit_history: auditsRes.data || [],
      },
    });
  } catch (err) {
    console.error('[Admin Handover Detail] Error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * PATCH /api/admin/handovers/:id/suspend
 * Suspends an active handover due to fraud, dispute, or safety concerns.
 */
adminHandoverRouter.patch('/:id/suspend', requireAdminOrReviewer, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const serviceSupabase = req.serviceSupabase;

  if (!id || !UUID_V4_REGEX.test(id.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid handover UUID v4 is required.' });
  }

  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Database client not configured.' });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A mandatory explanation reason of at least 3 characters is required to suspend a handover.',
    });
  }

  try {
    const { data: handover, error: hErr } = await serviceSupabase
      .from('item_handovers')
      .select('*, claim:item_claims!claim_id(id, claimant_id, found_item:items!found_item_id(user_id, title))')
      .eq('id', id.trim())
      .maybeSingle();

    if (hErr || !handover) {
      return res.status(404).json({ error: 'Not Found', message: 'Handover record not found.' });
    }

    if (handover.status === 'completed') {
      return res.status(400).json({
        error: 'Invalid Transition',
        message: 'Cannot suspend a handover that has already been finalized and completed.',
      });
    }

    const nowIso = new Date().toISOString();

    // 1. Update handover status to suspended
    const { data: updatedHandover, error: upErr } = await serviceSupabase
      .from('item_handovers')
      .update({
        status: 'suspended',
        is_flagged: true,
        flagged_reason: reason.trim(),
        notes: `Suspended by administration: ${reason.trim()}`,
        updated_at: nowIso,
      })
      .eq('id', handover.id)
      .select()
      .single();

    if (upErr) throw upErr;

    // 2. Put associated claim under review
    if (handover.claim_id) {
      await serviceSupabase
        .from('item_claims')
        .update({
          status: 'under_review',
          requires_admin_review: true,
          admin_notes: `Handover suspended: ${reason.trim()}`,
        })
        .eq('id', handover.claim_id);
    }

    // 3. Write immutable audit entry
    await writeHandoverAuditLog(serviceSupabase, {
      actor: req.user,
      action: 'handover_suspended',
      targetId: handover.id,
      reason: reason.trim(),
      details: {
        claimId: handover.claim_id,
        previousStatus: handover.status,
        newStatus: 'suspended',
      },
      ipAddress: req.ip,
    });

    // 4. Notify both participants
    if (handover.claim) {
      const title = handover.claim.found_item?.title || 'item';
      await Promise.all([
        serviceSupabase.from('user_notifications').insert({
          recipient_id: handover.claim.claimant_id,
          type: 'admin_action',
          claim_id: handover.claim_id,
          message: `URGENT: Handover for "${title}" has been placed on administrative hold. Reason: ${reason.trim()}`,
        }),
        serviceSupabase.from('user_notifications').insert({
          recipient_id: handover.claim.found_item?.user_id,
          type: 'admin_action',
          claim_id: handover.claim_id,
          message: `URGENT: Handover for "${title}" has been placed on administrative hold. Reason: ${reason.trim()}`,
        }),
      ]).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Handover successfully suspended and placed on administrative hold.',
      handover: updatedHandover,
    });
  } catch (err) {
    console.error('[Admin Handover Suspend] Error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * PATCH /api/admin/handovers/:id/release-hold
 * Releases an administrative hold after inspection.
 */
adminHandoverRouter.patch('/:id/release-hold', requireAdminOrReviewer, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const serviceSupabase = req.serviceSupabase;

  if (!id || !UUID_V4_REGEX.test(id.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid handover UUID v4 is required.' });
  }

  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Database client not configured.' });
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A mandatory explanation reason of at least 3 characters is required to release an administrative hold.',
    });
  }

  try {
    const { data: handover, error: hErr } = await serviceSupabase
      .from('item_handovers')
      .select('*, claim:item_claims!claim_id(id, claimant_id, found_item:items!found_item_id(user_id, title))')
      .eq('id', id.trim())
      .maybeSingle();

    if (hErr || !handover) {
      return res.status(404).json({ error: 'Not Found', message: 'Handover record not found.' });
    }

    if (handover.status !== 'suspended') {
      return res.status(400).json({
        error: 'Invalid Transition',
        message: `Handover status is "${handover.status}". Only suspended handovers can have their hold released.`,
      });
    }

    const nowIso = new Date().toISOString();

    // 1. Release hold: return to 'scheduled' (or 'handover_pending' if a confirmation existed)
    const newStatus = (handover.finder_confirmed_at || handover.claimant_confirmed_at)
      ? 'handover_pending'
      : 'scheduled';

    const { data: updatedHandover, error: upErr } = await serviceSupabase
      .from('item_handovers')
      .update({
        status: newStatus,
        is_flagged: false,
        flagged_reason: null,
        updated_at: nowIso,
      })
      .eq('id', handover.id)
      .select()
      .single();

    if (upErr) throw upErr;

    // 2. Write immutable audit log
    await writeHandoverAuditLog(serviceSupabase, {
      actor: req.user,
      action: 'handover_hold_released',
      targetId: handover.id,
      reason: reason.trim(),
      details: {
        claimId: handover.claim_id,
        previousStatus: 'suspended',
        newStatus,
      },
      ipAddress: req.ip,
    });

    // 3. Notify participants
    if (handover.claim) {
      const title = handover.claim.found_item?.title || 'item';
      await Promise.all([
        serviceSupabase.from('user_notifications').insert({
          recipient_id: handover.claim.claimant_id,
          type: 'handover_scheduled',
          claim_id: handover.claim_id,
          message: `The administrative hold on handover for "${title}" has been cleared. Handover coordination is resumed.`,
        }),
        serviceSupabase.from('user_notifications').insert({
          recipient_id: handover.claim.found_item?.user_id,
          type: 'handover_scheduled',
          claim_id: handover.claim_id,
          message: `The administrative hold on handover for "${title}" has been cleared. Handover coordination is resumed.`,
        }),
      ]).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'Administrative hold released. Handover coordination resumed.',
      handover: updatedHandover,
    });
  } catch (err) {
    console.error('[Admin Handover Release] Error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

