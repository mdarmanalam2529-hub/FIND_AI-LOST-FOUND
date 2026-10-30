import express from 'express';
import { isAuthorizedAdmin } from './claimWorkflow.js';
import { rankCandidateMatches, DEFAULT_WEIGHTS } from './aiMatcher.js';

export const adminReportRouter = express.Router();

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = ['open', 'matched', 'returned', 'closed'];
const ALLOWED_ITEM_TYPES = ['lost', 'found'];
const ALLOWED_CATEGORIES = ['electronics', 'keys-wallets', 'clothing', 'documents', 'jewelry', 'other'];

/**
 * Middleware: Enforces that the caller is a verified administrator or security reviewer.
 * Strictly checks server-managed app_metadata and verified ADMIN_EMAILS.
 * Never trusts user_metadata or request body.
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
 * Helper to determine if the user has full 'admin' authority (vs read-only / reviewer).
 */
export function isFullAdmin(user) {
  if (!user || !isAuthorizedAdmin(user)) return false;
  // app_metadata role admin or verified admin email fallback
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
 * Records an entry into public.admin_audit_logs.
 * Strictly adheres to the schema constraints in 20261025120000_create_account_recovery_and_audit_logs.sql:
 * - actor_name >= 2 chars
 * - actor_email valid email regex
 * - action >= 2 chars
 * - reason >= 3 chars
 * - target_type, target_identifier, details
 */
export async function writeAdminAuditLog(serviceSupabase, {
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
    : 'Administrative moderation action performed';

  const entry = {
    actor_id: actor?.id || null,
    actor_name: actorName.length >= 2 ? actorName : 'Admin',
    actor_email: actorEmail,
    actor_role: actorRole,
    action: String(action).trim(),
    target_type: 'item_report',
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
      console.warn('[Admin Audit Log] Insertion warning:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[Admin Audit Log] Unexpected insertion error:', err.message);
    return null;
  }
}

/**
 * Validates report status transitions for moderation.
 */
export function isValidReportStatusTransition(currentStatus, newStatus, _action = null) {
  if (currentStatus === newStatus) return true;

  // Cannot transition away from 'returned' via standard moderation to preserve handover history
  if (currentStatus === 'returned' && newStatus !== 'returned') {
    return false;
  }

  const allowedTransitions = {
    open: ['closed', 'matched'],
    matched: ['open', 'closed', 'returned'],
    closed: ['open'], // restoration
    returned: [],     // immutable terminal state
  };

  const allowed = allowedTransitions[currentStatus] || [];
  return allowed.includes(newStatus);
}

/**
 * Strips private personal identifiable information (PII) from public/moderator match previews.
 */
export function redactPrivateReportDetails(item) {
  if (!item) return null;
  const copy = { ...item };
  // Redact any phone numbers or email patterns embedded in descriptions
  if (typeof copy.description === 'string') {
    copy.description = copy.description
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
      .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
  }
  if (typeof copy.location_description === 'string') {
    copy.location_description = copy.location_description
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
      .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
  }
  return copy;
}

/**
 * GET /api/admin/reports
 * Returns paginated lost and found reports with moderation metadata, claims summary, and audit indicators.
 */
adminReportRouter.get('/', requireAdminOrReviewer, async (req, res) => {
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

  const itemTypeFilter = req.query.item_type || 'all';
  const statusFilter = req.query.status || 'all';
  const categoryFilter = req.query.category || 'all';
  const indicatorFilter = req.query.indicator || 'all'; // 'all', 'disputed', 'suspicious', 'competing', 'duplicate', 'reviewed'
  const searchQuery = (req.query.search || '').trim().toLowerCase();

  try {
    // 1. Fetch total count & reports
    let query = serviceSupabase
      .from('items')
      .select('*', { count: 'exact' });

    if (itemTypeFilter !== 'all' && ALLOWED_ITEM_TYPES.includes(itemTypeFilter)) {
      query = query.eq('item_type', itemTypeFilter);
    }
    if (statusFilter !== 'all' && ALLOWED_STATUSES.includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }
    if (categoryFilter !== 'all' && ALLOWED_CATEGORIES.includes(categoryFilter)) {
      query = query.eq('category', categoryFilter);
    }

    // Default sorting: created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: rawItems, error: fetchErr } = await query;
    if (fetchErr) {
      console.error('[Admin Reports] DB fetch error:', fetchErr.message);
      return res.status(500).json({ error: 'Database Error', message: fetchErr.message });
    }

    const allItems = rawItems || [];

    // 2. Fetch supplementary metadata in parallel:
    // a) Active claims & disputes for these items
    // b) Handover incidents referencing found items
    // c) Audit logs for reports
    const itemIds = allItems.map((i) => i.id);

    const [claimsRes, incidentsRes, auditsRes] = await Promise.all([
      itemIds.length > 0
        ? serviceSupabase
            .from('item_claims')
            .select('id, found_item_id, lost_item_id, status, requires_admin_review')
            .or(`found_item_id.in.(${itemIds.join(',')}),lost_item_id.in.(${itemIds.join(',')})`)
        : { data: [] },
      itemIds.length > 0
        ? serviceSupabase
            .from('handover_incidents')
            .select('id, incident_id, found_item_id, incident_type, severity, status')
            .in('found_item_id', itemIds)
        : { data: [] },
      itemIds.length > 0
        ? serviceSupabase
            .from('admin_audit_logs')
            .select('id, actor_name, actor_role, action, target_identifier, reason, details, created_at')
            .eq('target_type', 'item_report')
            .in('target_identifier', itemIds)
            .order('created_at', { ascending: false })
        : { data: [] },
    ]);

    const claimsList = claimsRes.data || [];
    const incidentsList = incidentsRes.data || [];
    const auditsList = auditsRes.data || [];

    // Map audit logs by report id
    const auditsByReport = new Map();
    for (const log of auditsList) {
      if (!auditsByReport.has(log.target_identifier)) {
        auditsByReport.set(log.target_identifier, []);
      }
      auditsByReport.get(log.target_identifier).push(log);
    }

    // Map claims by report id
    const claimsByReport = new Map();
    for (const c of claimsList) {
      const fId = c.found_item_id;
      const lId = c.lost_item_id;
      if (fId) {
        if (!claimsByReport.has(fId)) claimsByReport.set(fId, []);
        claimsByReport.get(fId).push(c);
      }
      if (lId) {
        if (!claimsByReport.has(lId)) claimsByReport.set(lId, []);
        claimsByReport.get(lId).push(c);
      }
    }

    // Map incidents by found item id
    const incidentsByFoundItem = new Map();
    for (const inc of incidentsList) {
      if (inc.found_item_id) {
        if (!incidentsByFoundItem.has(inc.found_item_id)) {
          incidentsByFoundItem.set(inc.found_item_id, []);
        }
        incidentsByFoundItem.get(inc.found_item_id).push(inc);
      }
    }

    // 3. Compute indicators and enrich report items
    const enrichedItems = allItems.map((item) => {
      const associatedClaims = claimsByReport.get(item.id) || [];
      const associatedIncidents = incidentsByFoundItem.get(item.id) || [];
      const associatedAudits = auditsByReport.get(item.id) || [];

      const activeClaims = associatedClaims.filter((c) =>
        ['pending', 'under_review', 'approved'].includes(c.status)
      );

      const hasDispute = associatedClaims.some(
        (c) => c.is_disputed || c.status === 'disputed'
      );
      const competingClaimsCount = activeClaims.length;
      const hasSecurityIncidents = associatedIncidents.some(
        (i) => !['cleared'].includes(i.status)
      );
      const isFlaggedSuspicious = associatedAudits.some(
        (a) => a.action === 'report_flagged_suspicious'
      );
      const isReviewed = associatedAudits.some(
        (a) => a.action === 'report_reviewed' || a.action === 'report_approved'
      );
      const duplicateAudit = associatedAudits.find(
        (a) => a.action === 'report_resolved_duplicate'
      );

      return {
        ...item,
        claims_count: associatedClaims.length,
        active_claims_count: activeClaims.length,
        indicators: {
          is_disputed: hasDispute,
          competing_claims_count: competingClaimsCount,
          has_competing_claims: competingClaimsCount > 1,
          has_security_incidents: hasSecurityIncidents,
          is_flagged_suspicious: isFlaggedSuspicious,
          is_reviewed: isReviewed,
          is_duplicate_resolved: Boolean(duplicateAudit),
          duplicate_of_id: duplicateAudit?.details?.duplicateOfId || null,
        },
        latest_audit: associatedAudits[0] || null,
      };
    });

    // 4. In-Memory Search & Indicator Filtering (across enriched fields)
    let filtered = enrichedItems;

    if (searchQuery) {
      filtered = filtered.filter((i) => {
        const text = `${i.id} ${i.title} ${i.description} ${i.location_description} ${i.color || ''} ${i.category}`.toLowerCase();
        return text.includes(searchQuery);
      });
    }

    if (indicatorFilter !== 'all') {
      if (indicatorFilter === 'disputed') {
        filtered = filtered.filter((i) => i.indicators.is_disputed || i.indicators.has_competing_claims);
      } else if (indicatorFilter === 'suspicious') {
        filtered = filtered.filter((i) => i.indicators.is_flagged_suspicious || i.indicators.has_security_incidents);
      } else if (indicatorFilter === 'competing') {
        filtered = filtered.filter((i) => i.indicators.has_competing_claims);
      } else if (indicatorFilter === 'duplicate') {
        filtered = filtered.filter((i) => i.indicators.is_duplicate_resolved);
      } else if (indicatorFilter === 'reviewed') {
        filtered = filtered.filter((i) => i.indicators.is_reviewed);
      } else if (indicatorFilter === 'needs_review') {
        filtered = filtered.filter((i) => !i.indicators.is_reviewed && i.status === 'open');
      }
    }

    // 5. Aggregate statistics across entire catalog
    const stats = {
      total: allItems.length,
      lost: allItems.filter((i) => i.item_type === 'lost').length,
      found: allItems.filter((i) => i.item_type === 'found').length,
      open: allItems.filter((i) => i.status === 'open').length,
      matched: allItems.filter((i) => i.status === 'matched').length,
      returned: allItems.filter((i) => i.status === 'returned').length,
      closed: allItems.filter((i) => i.status === 'closed').length,
      disputed: enrichedItems.filter((i) => i.indicators.is_disputed || i.indicators.has_competing_claims).length,
      suspicious: enrichedItems.filter((i) => i.indicators.is_flagged_suspicious || i.indicators.has_security_incidents).length,
    };

    // 6. Pagination slice
    const totalMatching = filtered.length;
    const paginatedItems = filtered.slice(offset, offset + limit);

    // 7. Generate safe signed image URLs for returned page items
    const itemsWithSignedUrls = await Promise.all(
      paginatedItems.map(async (item) => {
        let signedImageUrl = null;
        if (item.image_path) {
          try {
            const { data: urlData } = await serviceSupabase.storage
              .from('item-images')
              .createSignedUrl(item.image_path, 3600);
            signedImageUrl = urlData?.signedUrl || null;
          } catch (storageErr) {
            console.warn(`[Admin Reports] Could not sign image for ${item.id}:`, storageErr.message);
          }
        }
        return {
          ...item,
          signed_image_url: signedImageUrl,
        };
      })
    );

    return res.json({
      success: true,
      reports: itemsWithSignedUrls,
      pagination: {
        total: totalMatching,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalMatching / limit)),
      },
      stats,
    });
  } catch (err) {
    console.error('[Admin Reports] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * GET /api/admin/reports/:id
 * Fetches deep report details with audit history, associated claims, and incidents.
 */
adminReportRouter.get('/:id', requireAdminOrReviewer, async (req, res) => {
  const { id } = req.params;
  const serviceSupabase = req.serviceSupabase;

  if (!id || !UUID_V4_REGEX.test(id.trim())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid report ID format. Expected UUID v4.',
    });
  }

  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Database service client not configured.' });
  }

  try {
    // 1. Fetch item
    const { data: item, error: itemErr } = await serviceSupabase
      .from('items')
      .select('*')
      .eq('id', id.trim())
      .maybeSingle();

    if (itemErr || !item) {
      return res.status(404).json({ error: 'Not Found', message: 'Report not found.' });
    }

    // 2. Fetch associated claims, incidents, audit logs, and student profile in parallel
    const [claimsRes, incidentsRes, auditsRes, profileRes] = await Promise.all([
      serviceSupabase
        .from('item_claims')
        .select('id, claimant_id, found_item_id, lost_item_id, status, requires_admin_review, created_at, updated_at')
        .or(`found_item_id.eq.${item.id},lost_item_id.eq.${item.id}`),
      serviceSupabase
        .from('handover_incidents')
        .select('*')
        .eq('found_item_id', item.id),
      serviceSupabase
        .from('admin_audit_logs')
        .select('*')
        .eq('target_type', 'item_report')
        .eq('target_identifier', item.id)
        .order('created_at', { ascending: false }),
      serviceSupabase
        .from('student_profiles')
        .select('registration_number, branch, academic_year, verification_status')
        .eq('user_id', item.user_id)
        .maybeSingle(),
    ]);

    // 3. Generate signed image URL
    let signedImageUrl = null;
    if (item.image_path) {
      try {
        const { data: urlData } = await serviceSupabase.storage
          .from('item-images')
          .createSignedUrl(item.image_path, 3600);
        signedImageUrl = urlData?.signedUrl || null;
      } catch (err) {
        console.warn(`[Admin Reports] Could not sign image for ${item.id}:`, err.message);
      }
    }

    const claims = (claimsRes.data || []).map((c) => ({
      id: c.id,
      status: c.status,
      claimant_id: c.claimant_id,
      is_disputed: c.status === 'disputed' || Boolean(c.is_disputed),
      requires_admin_review: c.requires_admin_review,
      created_at: c.created_at,
    }));

    return res.json({
      success: true,
      report: {
        ...item,
        signed_image_url: signedImageUrl,
        reporter_profile: profileRes.data || null,
        claims,
        incidents: incidentsRes.data || [],
        audit_history: auditsRes.data || [],
      },
    });
  } catch (err) {
    console.error('[Admin Reports] Detail error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * GET /api/admin/reports/:id/matches
 * Retrieves candidate AI matches for this report without exposing private claimant information.
 */
adminReportRouter.get('/:id/matches', requireAdminOrReviewer, async (req, res) => {
  const { id } = req.params;
  const serviceSupabase = req.serviceSupabase;

  if (!id || !UUID_V4_REGEX.test(id.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid report UUID is required.' });
  }

  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Supabase client not configured.' });
  }

  try {
    const { data: targetItem, error: targetErr } = await serviceSupabase
      .from('items')
      .select('*')
      .eq('id', id.trim())
      .maybeSingle();

    if (targetErr || !targetItem) {
      return res.status(404).json({ error: 'Not Found', message: 'Target report not found.' });
    }

    const oppositeType = targetItem.item_type === 'lost' ? 'found' : 'lost';

    // Fetch candidate pool
    const { data: candidates, error: candErr } = await serviceSupabase
      .from('items')
      .select('id, user_id, item_type, title, description, category, color, location_description, incident_date, image_path, status, created_at')
      .eq('item_type', oppositeType)
      .neq('id', targetItem.id);

    if (candErr) {
      return res.status(500).json({ error: 'Database Error', message: candErr.message });
    }

    if (!candidates || candidates.length === 0) {
      return res.json({
        success: true,
        targetReport: {
          id: targetItem.id,
          title: targetItem.title,
          item_type: targetItem.item_type,
          category: targetItem.category,
        },
        matches: [],
        totalCandidates: 0,
      });
    }

    // Rank candidates using AI matcher
    const rankedMatches = await rankCandidateMatches(targetItem, candidates, {
      weights: DEFAULT_WEIGHTS,
      userSupabase: serviceSupabase,
    });

    const topMatches = rankedMatches.slice(0, 10).map((m) => {
      // Redact any PII from candidates
      const safeCandidate = redactPrivateReportDetails(m.item);
      return {
        item: safeCandidate,
        score: m.score,
        similarityPercent: m.similarityPercent,
        breakdown: m.breakdown,
        explanation: m.explanation,
      };
    });

    return res.json({
      success: true,
      targetReport: {
        id: targetItem.id,
        title: targetItem.title,
        item_type: targetItem.item_type,
        category: targetItem.category,
      },
      matches: topMatches,
      totalCandidates: candidates.length,
    });
  } catch (err) {
    console.error('[Admin Reports] AI Matches error:', err);
    return res.status(500).json({ error: 'Matching Error', message: err.message });
  }
});

/**
 * PATCH /api/admin/reports/:id/moderate
 * Executes a verified administrative moderation action.
 * Supported actions:
 * - 'mark_reviewed': Admin or reviewer marks report as inspected.
 * - 'approve': Approves/reopens report (sets status = 'open'). Full admin only.
 * - 'reject': Rejects report (sets status = 'closed'). Full admin only. Requires reason.
 * - 'flag_suspicious': Flags report with documented reason. Admin or reviewer.
 * - 'hide_report' / 'restrict': Hides report from public view (sets status = 'closed'). Full admin only. Requires reason.
 * - 'restore': Restores previously closed report back to 'open'. Full admin only. Requires reason.
 * - 'resolve_duplicate': Marks report as duplicate of another item and closes it. Full admin only. Requires duplicateOfId & reason.
 */
adminReportRouter.patch('/:id/moderate', requireAdminOrReviewer, async (req, res) => {
  const { id } = req.params;
  const { action, reason, details = {} } = req.body || {};
  const serviceSupabase = req.serviceSupabase;

  if (!id || !UUID_V4_REGEX.test(id.trim())) {
    return res.status(400).json({ error: 'Bad Request', message: 'Valid report UUID is required.' });
  }

  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Database service client not configured.' });
  }

  if (!action || typeof action !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Field "action" is required and must be a string.',
    });
  }

  const normalizedAction = action.trim().toLowerCase();
  const validActions = [
    'mark_reviewed',
    'approve',
    'reject',
    'flag_suspicious',
    'hide_report',
    'restrict',
    'restore',
    'resolve_duplicate',
  ];

  if (!validActions.includes(normalizedAction)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid action "${action}". Valid actions: ${validActions.join(', ')}.`,
    });
  }

  // Role authorization check: consequential mutations require full admin
  const userIsFullAdmin = isFullAdmin(req.user);
  const adminOnlyActions = ['approve', 'reject', 'hide_report', 'restrict', 'restore', 'resolve_duplicate'];

  if (adminOnlyActions.includes(normalizedAction) && !userIsFullAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `Access denied: Action "${action}" requires full administrator privileges. Security reviewers have read and review authority only.`,
    });
  }

  // Reason requirements: consequential actions mandate a clear reason
  const requiresReason = ['reject', 'flag_suspicious', 'hide_report', 'restrict', 'restore', 'resolve_duplicate'];
  if (requiresReason.includes(normalizedAction)) {
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Action "${action}" requires a valid explanation reason of at least 3 characters.`,
      });
    }
  }

  try {
    // 1. Fetch current item
    const { data: currentItem, error: fetchErr } = await serviceSupabase
      .from('items')
      .select('*')
      .eq('id', id.trim())
      .maybeSingle();

    if (fetchErr || !currentItem) {
      return res.status(404).json({ error: 'Not Found', message: 'Report not found.' });
    }

    let newStatus = currentItem.status;
    const auditDetails = {
      ...details,
      previous_status: currentItem.status,
      action: normalizedAction,
    };

    // 2. State transition evaluation
    if (normalizedAction === 'approve') {
      newStatus = 'open';
    } else if (normalizedAction === 'reject') {
      newStatus = 'closed';
    } else if (normalizedAction === 'hide_report' || normalizedAction === 'restrict') {
      newStatus = 'closed';
    } else if (normalizedAction === 'restore') {
      if (currentItem.status === 'returned') {
        return res.status(400).json({
          error: 'Invalid Transition',
          message: 'Cannot restore an item that has already been returned and finalized.',
        });
      }
      newStatus = 'open';
    } else if (normalizedAction === 'resolve_duplicate') {
      const duplicateOfId = details.duplicateOfId || req.body.duplicateOfId;
      if (!duplicateOfId || !UUID_V4_REGEX.test(String(duplicateOfId).trim())) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Field "duplicateOfId" is required and must be a valid report UUID v4.',
        });
      }
      if (String(duplicateOfId).trim() === currentItem.id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'A report cannot be marked as a duplicate of itself.',
        });
      }

      // Verify primary report exists
      const { data: primaryReport, error: primErr } = await serviceSupabase
        .from('items')
        .select('id, title, status')
        .eq('id', String(duplicateOfId).trim())
        .maybeSingle();

      if (primErr || !primaryReport) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Referenced primary report not found in database.',
        });
      }

      newStatus = 'closed';
      auditDetails.duplicateOfId = primaryReport.id;
      auditDetails.primaryReportTitle = primaryReport.title;
    }

    // 3. Verify transition validity against schema
    if (!isValidReportStatusTransition(currentItem.status, newStatus, normalizedAction)) {
      return res.status(400).json({
        error: 'Invalid Transition',
        message: `Status transition from "${currentItem.status}" to "${newStatus}" is not permitted.`,
      });
    }

    // 4. Update item status if changed
    let updatedItem = currentItem;
    if (newStatus !== currentItem.status) {
      const { data: updData, error: updErr } = await serviceSupabase
        .from('items')
        .update({ status: newStatus })
        .eq('id', currentItem.id)
        .select()
        .single();

      if (updErr) {
        console.error('[Admin Moderation] Update error:', updErr.message);
        return res.status(500).json({ error: 'Database Error', message: updErr.message });
      }
      updatedItem = updData;
    }

    // 5. Write audit entry into public.admin_audit_logs
    auditDetails.new_status = newStatus;
    const auditRecord = await writeAdminAuditLog(serviceSupabase, {
      actor: req.user,
      action: `report_${normalizedAction}`,
      targetId: currentItem.id,
      reason: reason || `Report ${normalizedAction} executed`,
      details: auditDetails,
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Report successfully updated with action "${normalizedAction}".`,
      report: updatedItem,
      audit: auditRecord,
    });
  } catch (err) {
    console.error('[Admin Moderation] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});
