// Admin Dashboard aggregated statistics route

import express from 'express';
import { isAuthorizedAdmin } from './claimWorkflow.js';

function safeSelect(supabase, table, ...args) {
  const query = supabase.from(table);
  if (typeof query.select === 'function') {
    return query.select(...args);
  }
  return query;
}

// Helper to fetch a count and propagate any Supabase error.
async function fetchCount(query) {
  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export const adminDashboardRouter = express.Router();

/**
 * Middleware: Verify admin or security reviewer using existing helper.
 */
function requireAdmin(req, res, next) {
  if (!req.user || !isAuthorizedAdmin(req.user)) {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin access required.' });
  }
  next();
}

/**
 * GET /api/admin/dashboard
 * Returns aggregated metrics for the admin dashboard.
 */
adminDashboardRouter.get('/', requireAdmin, async (req, res) => {
  const serviceSupabase = req.serviceSupabase;
  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Supabase service client not configured.' });
  }
  try {
    // 1. Student counts
    const [totalStudents, eligibleStudents, pendingStudents] = await Promise.all([
      fetchCount(safeSelect(serviceSupabase, 'student_registry', '*', { count: 'exact', head: true })),
      fetchCount(safeSelect(serviceSupabase, 'student_registry', '*', { count: 'exact', head: true }).eq('is_eligible', true)),
      fetchCount(safeSelect(serviceSupabase, 'student_profiles', '*', { count: 'exact', head: true }).eq('is_active', false)),
    ]);

    // 2. Item reports
    const [totalLost, totalFound] = await Promise.all([
      fetchCount(safeSelect(serviceSupabase, 'items', '*', { count: 'exact', head: true }).eq('item_type', 'lost')),
      fetchCount(safeSelect(serviceSupabase, 'items', '*', { count: 'exact', head: true }).eq('item_type', 'found')),
    ]);

    // 3. Claims
    const [openClaims, pendingReviewClaims] = await Promise.all([
      fetchCount(
        safeSelect(serviceSupabase, 'item_claims', '*', { count: 'exact', head: true })
          .not('status', 'in', '(completed,cancelled,rejected)')
          .neq('status', null)
      ),
      fetchCount(safeSelect(serviceSupabase, 'item_claims', '*', { count: 'exact', head: true }).eq('requires_admin_review', true)),
    ]);

    // 4. Handovers
    const [activeHandovers, suspendedHandovers] = await Promise.all([
      fetchCount(
        safeSelect(serviceSupabase, 'item_handovers', '*', { count: 'exact', head: true })
          .not('status', 'in', '(completed,cancelled,suspended)')
          .neq('status', null)
      ),
      fetchCount(safeSelect(serviceSupabase, 'item_handovers', '*', { count: 'exact', head: true }).eq('status', 'suspended')),
    ]);

    // 5. Incidents
    const [openIncidents, resolvedIncidents] = await Promise.all([
      fetchCount(
        safeSelect(serviceSupabase, 'handover_incidents', '*', { count: 'exact', head: true })
          .not('status', 'in', '(cleared,confirmed_violation)')
          .neq('status', null)
      ),
      fetchCount(safeSelect(serviceSupabase, 'handover_incidents', '*', { count: 'exact', head: true }).in('status', ['cleared', 'confirmed_violation'])),
    ]);

    // 6. Recent audit log entries (latest 10)
    const { data: auditLogs, error: auditError } = await safeSelect(
      serviceSupabase,
      'admin_audit_logs',
      'id, created_at, actor_id, actor_role, action, reason'
    )
      .order('created_at', { ascending: false })
      .limit(10);

    if (auditError) {
      console.warn('[Admin Dashboard] Audit log fetch error:', auditError.message);
    }

    // Ensure audit logs are limited to 10 entries regardless of query result
    const recentAudits = (auditLogs || []).slice(0, 10);
    return res.json({
      success: true,
      stats: {
        students: {
          total: totalStudents || 0,
          eligible: eligibleStudents || 0,
          pendingVerification: pendingStudents || 0,
        },
        reports: {
          lost: totalLost || 0,
          found: totalFound || 0,
        },
        claims: {
          open: openClaims || 0,
          pendingReview: pendingReviewClaims || 0,
        },
        handovers: {
          active: activeHandovers || 0,
          suspended: suspendedHandovers || 0,
        },
        incidents: {
          open: openIncidents || 0,
          resolved: resolvedIncidents || 0,
        },
        recentAudits: recentAudits,
      },
    });
  } catch (err) {
    console.error('[Admin Dashboard] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message || 'Failed to compute dashboard.' });
  }
});
