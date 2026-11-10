import express from 'express';
import { redactPrivateReportDetails, writeAdminAuditLog } from './adminReportRoutes.js';

export const communityRouter = express.Router();

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ITEM_TYPES = ['lost', 'found'];
const ALLOWED_CATEGORIES = ['electronics', 'keys-wallets', 'clothing', 'documents', 'jewelry', 'other'];
const ALLOWED_REPORT_REASONS = [
  'inappropriate',
  'incorrect_info',
  'duplicate',
  'suspicious',
  'spam',
  'other',
];

/**
 * Formats a user's full name into a safe, privacy-preserving public display name.
 * Example: "John Doe" -> "John D."
 * If no valid name is available, falls back to "Student".
 */
export function formatPublicReporterName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'Student';
  const trimmed = rawName.trim();
  if (trimmed.length === 0) return 'Student';

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  }
  const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

/**
 * Computes live community feed statistics from items in database.
 */
export async function computeCommunityStats(serviceSupabase) {
  const defaultStats = {
    totalActive: 0,
    totalLost: 0,
    totalFound: 0,
    totalResolved: 0,
  };

  if (!serviceSupabase) return defaultStats;

  try {
    const [openLostRes, openFoundRes, resolvedRes] = await Promise.all([
      serviceSupabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .eq('item_type', 'lost'),
      serviceSupabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .eq('item_type', 'found'),
      serviceSupabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .in('status', ['returned', 'matched']),
    ]);

    const totalLost = openLostRes.count || 0;
    const totalFound = openFoundRes.count || 0;
    const totalResolved = resolvedRes.count || 0;
    const totalActive = totalLost + totalFound;

    return {
      totalActive,
      totalLost,
      totalFound,
      totalResolved,
    };
  } catch (err) {
    console.warn('[Community API] Could not compute stats:', err.message);
    return defaultStats;
  }
}

/**
 * GET /api/community/stats
 * Returns live counts of active lost, active found, and resolved reports across campus.
 */
communityRouter.get('/stats', async (req, res) => {
  const serviceSupabase = req.serviceSupabase || req.userSupabase;
  const stats = await computeCommunityStats(serviceSupabase);
  return res.json({ success: true, stats });
});

/**
 * GET /api/community/items
 * Fetches server-paginated, sanitized community lost-and-found listings.
 * Enforces strict PII redaction and public privacy restrictions.
 */
communityRouter.get('/items', async (req, res) => {
  const serviceSupabase = req.serviceSupabase || req.userSupabase;
  if (!serviceSupabase) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database service client not configured.',
    });
  }

  const currentUserId = req.user?.id || null;

  // 1. Query parameters & pagination limits
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const offset = (page - 1) * limit;

  const itemType = (req.query.type || 'all').toLowerCase();
  const category = (req.query.category || 'all').toLowerCase();
  const statusFilter = (req.query.status || 'all_active').toLowerCase();
  const dateFilter = (req.query.date || 'all').toLowerCase();
  const sort = (req.query.sort || 'newest').toLowerCase();
  const searchQuery = (req.query.search || '').trim().toLowerCase();

  try {
    // 2. Build base query - strictly exclude 'closed' (hidden/rejected/deleted) items
    let query = serviceSupabase
      .from('items')
      .select('id, user_id, item_type, title, description, category, color, location_description, incident_date, image_path, status, created_at, updated_at', { count: 'exact' });

    // Status filtering:
    // 'all_active' (default): open items only
    // 'resolved': returned or matched items
    // 'all': open, returned, or matched items (closed is ALWAYS excluded)
    if (statusFilter === 'resolved') {
      query = query.in('status', ['returned', 'matched']);
    } else if (statusFilter === 'all') {
      query = query.in('status', ['open', 'returned', 'matched']);
    } else {
      query = query.eq('status', 'open');
    }

    // Type filter
    if (itemType !== 'all' && ALLOWED_ITEM_TYPES.includes(itemType)) {
      query = query.eq('item_type', itemType);
    }

    // Category filter
    if (category !== 'all' && ALLOWED_CATEGORIES.includes(category)) {
      query = query.eq('category', category);
    }

    // Date range filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoffDate = null;

      if (dateFilter === 'today') {
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (dateFilter === 'week') {
        const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        cutoffDate = pastWeek.toISOString();
      } else if (dateFilter === 'month') {
        const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        cutoffDate = pastMonth.toISOString();
      }

      if (cutoffDate) {
        query = query.gte('created_at', cutoffDate);
      }
    }

    // Sorting
    query = query.order('created_at', { ascending: sort === 'oldest' });

    // Execute query
    const { data: rawItems, error: fetchErr } = await query;
    if (fetchErr) {
      console.error('[Community Feed] Query error:', fetchErr.message);
      return res.status(500).json({ error: 'Database Error', message: fetchErr.message });
    }

    let itemsPool = rawItems || [];

    // 3. Search query evaluation (title, description, category, location)
    if (searchQuery) {
      itemsPool = itemsPool.filter((item) => {
        const titleMatch = (item.title || '').toLowerCase().includes(searchQuery);
        const descMatch = (item.description || '').toLowerCase().includes(searchQuery);
        const catMatch = (item.category || '').toLowerCase().includes(searchQuery);
        const locMatch = (item.location_description || '').toLowerCase().includes(searchQuery);
        const colorMatch = (item.color || '').toLowerCase().includes(searchQuery);
        return titleMatch || descMatch || catMatch || locMatch || colorMatch;
      });
    }

    const totalMatching = itemsPool.length;
    const paginatedItems = itemsPool.slice(offset, offset + limit);

    // 4. Batch query student profiles for reporter public display names (NO email/phone/reg number)
    const userIds = [...new Set(paginatedItems.map((i) => i.user_id).filter(Boolean))];
    const profileMap = new Map();

    if (userIds.length > 0) {
      try {
        const { data: profiles } = await serviceSupabase
          .from('student_profiles')
          .select('user_id, student_name')
          .in('user_id', userIds);

        if (profiles) {
          for (const p of profiles) {
            profileMap.set(p.user_id, p.student_name);
          }
        }
      } catch (profErr) {
        console.warn('[Community Feed] Could not batch fetch student profiles:', profErr.message);
      }
    }

    // 5. Generate signed image URLs and sanitize PII from all response records
    const sanitizedItems = await Promise.all(
      paginatedItems.map(async (item) => {
        // Redact any phone numbers or email patterns in descriptions
        const redacted = redactPrivateReportDetails(item);

        // Sign image URL if present
        let signedImageUrl = null;
        if (item.image_path) {
          try {
            const { data: urlData } = await serviceSupabase.storage
              .from('item-images')
              .createSignedUrl(item.image_path, 3600);
            signedImageUrl = urlData?.signedUrl || null;
          } catch (storageErr) {
            console.warn(`[Community Feed] Signed URL warning for ${item.id}:`, storageErr.message);
          }
        }

        const rawReporterName = profileMap.get(item.user_id) || null;
        const publicDisplayName = formatPublicReporterName(rawReporterName);
        const isOwnListing = Boolean(currentUserId && item.user_id === currentUserId);

        return {
          id: redacted.id,
          item_type: redacted.item_type,
          title: redacted.title,
          description: redacted.description,
          category: redacted.category,
          color: redacted.color,
          location_description: redacted.location_description,
          incident_date: redacted.incident_date,
          status: redacted.status,
          created_at: redacted.created_at,
          updated_at: redacted.updated_at,
          signed_image_url: signedImageUrl,
          reporter_name: publicDisplayName,
          is_own_listing: isOwnListing,
        };
      })
    );

    // 6. Compute live header stats
    const stats = await computeCommunityStats(serviceSupabase);

    return res.json({
      success: true,
      items: sanitizedItems,
      pagination: {
        page,
        limit,
        total: totalMatching,
        totalPages: Math.max(1, Math.ceil(totalMatching / limit)),
      },
      stats,
    });
  } catch (err) {
    console.error('[Community Feed] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * POST /api/community/items/:id/report
 * Allows an authenticated student to flag/report a listing for moderator review.
 * Prevents duplicate reports from the same student and records audit log.
 */
communityRouter.post('/items/:id/report', async (req, res) => {
  const { id } = req.params;
  const { reason, details, evidence } = req.body || {};
  const serviceSupabase = req.serviceSupabase || req.userSupabase;
  const user = req.user;

  if (!user || !user.id) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be signed in to report a community listing.',
    });
  }

  if (!id || !UUID_V4_REGEX.test(id.trim())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid item ID. Must be a valid UUID v4.',
    });
  }

  if (!reason || !ALLOWED_REPORT_REASONS.includes(reason.trim())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Invalid reason. Allowed reasons: ${ALLOWED_REPORT_REASONS.join(', ')}.`,
    });
  }

  const cleanReason = reason.trim();
  const cleanDetails = (details && typeof details === 'string') ? details.trim() : '';
  const cleanEvidence = (evidence && typeof evidence === 'string') ? evidence.trim() : '';

  if (cleanReason === 'other' && cleanDetails.length < 5) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'When selecting "Other", please provide a brief explanation of at least 5 characters.',
    });
  }

  if (!serviceSupabase) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database service client not configured.',
    });
  }

  try {
    // 1. Verify target item exists and is not closed
    const { data: targetItem, error: itemErr } = await serviceSupabase
      .from('items')
      .select('id, user_id, title, status')
      .eq('id', id.trim())
      .maybeSingle();

    if (itemErr || !targetItem) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'The requested listing does not exist.',
      });
    }

    if (targetItem.status === 'closed') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'This listing has already been closed or removed by moderators.',
      });
    }

    // 2. Prevent user from reporting their own listing
    if (targetItem.user_id === user.id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'You cannot report your own listing. You can edit or close it from your workspace.',
      });
    }

    // 3. Duplicate Prevention: Check if this user has already reported this listing
    let alreadyReported = false;

    // Check community_item_reports table if it exists
    try {
      const { data: existingReport } = await serviceSupabase
        .from('community_item_reports')
        .select('id')
        .eq('item_id', targetItem.id)
        .eq('reporter_id', user.id)
        .maybeSingle();

      if (existingReport) {
        alreadyReported = true;
      }
    } catch {
      // Table may not exist yet; fallback to audit logs check
    }

    if (!alreadyReported) {
      // Check admin_audit_logs for duplicate submission
      try {
        const { data: auditEntries } = await serviceSupabase
          .from('admin_audit_logs')
          .select('id, target_identifier, details')
          .eq('action', 'community_reported')
          .eq('target_identifier', targetItem.id)
          .eq('actor_id', user.id)
          .limit(1);

        if (auditEntries && auditEntries.length > 0) {
          alreadyReported = true;
        }
      } catch {
        // Continue
      }
    }

    if (alreadyReported) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already reported this listing. Our campus moderation team has been notified and is reviewing it.',
      });
    }

    // 4. Insert into community_item_reports table (if exists)
    try {
      await serviceSupabase
        .from('community_item_reports')
        .insert([{
          item_id: targetItem.id,
          reporter_id: user.id,
          reason: cleanReason,
          details: cleanDetails || null,
          evidence: cleanEvidence || null,
          status: 'pending',
        }]);
    } catch (insertErr) {
      console.warn('[Community Report] community_item_reports table insert notice:', insertErr.message);
    }

    // 5. Always record an immutable entry into admin_audit_logs for moderator review
    const reasonTitles = {
      inappropriate: 'Inappropriate content',
      incorrect_info: 'Incorrect or misleading information',
      duplicate: 'Duplicate listing',
      suspicious: 'Suspicious or fraudulent activity',
      spam: 'Spam or advertising',
      other: 'Other community violation',
    };

    const auditReason = reasonTitles[cleanReason] || `Community flag: ${cleanReason}`;

    await writeAdminAuditLog(serviceSupabase, {
      actor: user,
      action: 'community_reported',
      targetId: targetItem.id,
      reason: auditReason,
      details: {
        reason: cleanReason,
        explanation: cleanDetails,
        evidence: cleanEvidence,
        reporter_id: user.id,
        item_title: targetItem.title,
        reported_at: new Date().toISOString(),
      },
      ipAddress: req.ip || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for keeping our campus safe. Our moderation team has been notified and will review this listing promptly.',
    });
  } catch (err) {
    console.error('[Community Report] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

