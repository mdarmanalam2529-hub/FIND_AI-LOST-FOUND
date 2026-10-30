/**
 * ==============================================================================
 * Module: adminUserRoutes.js
 * Project: FindAI - University Lost-and-Found Platform
 * Part 2: Staff & Administrator Account Management Endpoints
 * ==============================================================================
 */

import express from 'express';
import { isAuthorizedAdmin, isPrimaryAdmin } from './claimWorkflow.js';
import { EMAIL_REGEX } from './studentValidation.js';

export const adminUserRouter = express.Router();

/**
 * Middleware: Verify authorized admin or primary admin.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !isAuthorizedAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied: Requires administrator privileges.',
    });
  }
  next();
}

/**
 * Middleware: Verify primary administrator.
 */
export function requirePrimaryAdmin(req, res, next) {
  if (!req.user || !isPrimaryAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied: Requires primary administrator privileges.',
    });
  }
  next();
}

/**
 * GET /api/admin/users
 * Lists staff and administrator accounts.
 * Returns safe metadata; hides passwords and internal credentials.
 */
adminUserRouter.get('/', requireAdmin, async (req, res) => {
  const serviceSupabase = req.serviceSupabase;
  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Service client unavailable.' });
  }

  try {
    const { data: usersData, error: usersError } = await serviceSupabase.auth.admin.listUsers({
      perPage: 100,
    });

    if (usersError) {
      return res.status(500).json({ error: 'Database Error', message: usersError.message });
    }

    const callerIsPrimary = isPrimaryAdmin(req.user);

    // Filter to non-student accounts (staff, admin, primary_admin, security_reviewer)
    const staffAndAdmins = (usersData?.users || [])
      .filter((u) => {
        const role = u.app_metadata?.role;
        const isAdm = isAuthorizedAdmin(u);
        return isAdm || role === 'staff' || role === 'admin' || role === 'primary_admin' || role === 'super_admin';
      })
      .map((u) => {
        const isUserPrimary = isPrimaryAdmin(u);
        const resolvedRole = isUserPrimary
          ? 'primary_admin'
          : u.app_metadata?.role || (isAuthorizedAdmin(u) ? 'admin' : 'staff');

        return {
          id: u.id,
          email: u.email,
          fullName: u.user_metadata?.full_name || u.email.split('@')[0],
          role: resolvedRole,
          isPrimaryAdmin: isUserPrimary,
          isActive: !u.banned_until || new Date(u.banned_until) < new Date(),
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at || null,
        };
      });

    return res.json({
      success: true,
      users: staffAndAdmins,
      currentUser: {
        id: req.user.id,
        email: req.user.email,
        isPrimaryAdmin: callerIsPrimary,
      },
    });
  } catch (err) {
    console.error('[Admin Users] Failed to list accounts:', err.message);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to retrieve administrative users.' });
  }
});

/**
 * POST /api/admin/users
 * Creates a new staff member or administrator account.
 * Rules:
 * - Primary admin can create staff OR admin accounts.
 * - Ordinary admin can create ONLY staff accounts.
 */
adminUserRouter.post('/', requireAdmin, async (req, res) => {
  const { email, password, fullName, role = 'staff' } = req.body;
  const serviceSupabase = req.serviceSupabase;

  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Service client unavailable.' });
  }

  // 1. Validate fields
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
  const cleanRole = typeof role === 'string' ? role.trim().toLowerCase() : 'staff';

  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({ error: 'Bad Request', message: 'A valid email address is required.' });
  }

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: 'Bad Request', message: 'Full name must be at least 2 characters.' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 6 characters.' });
  }

  if (!['staff', 'admin'].includes(cleanRole)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Role must be either "staff" or "admin".' });
  }

  // 2. Permission check: Only primary admin can create another administrator
  const callerIsPrimary = isPrimaryAdmin(req.user);
  if (cleanRole === 'admin' && !callerIsPrimary) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied: Only the primary administrator can appoint another administrator.',
    });
  }

  try {
    // 3. Create Supabase Auth user
    const { data: createdData, error: createError } = await serviceSupabase.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
      },
      app_metadata: {
        role: cleanRole,
      },
    });

    if (createError) {
      if (createError.message?.toLowerCase().includes('already registered')) {
        return res.status(400).json({
          error: 'Conflict',
          message: 'An account with this email address already exists.',
        });
      }
      return res.status(400).json({ error: 'Creation Failed', message: createError.message });
    }

    // 4. Record audit log
    await serviceSupabase.from('admin_audit_logs').insert({
      actor_id: req.user.id,
      actor_role: callerIsPrimary ? 'primary_admin' : 'admin',
      action: 'create_privileged_user',
      reason: `Created new ${cleanRole} account for ${cleanEmail}`,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `${cleanRole === 'admin' ? 'Administrator' : 'Staff'} account created successfully.`,
      user: {
        id: createdData.user.id,
        email: cleanEmail,
        fullName: cleanName,
        role: cleanRole,
      },
    });
  } catch (err) {
    console.error('[Admin Users] Creation error:', err.message);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to create privileged user.' });
  }
});

/**
 * PATCH /api/admin/users/:userId/role
 * Changes an account's assigned role.
 * Rules:
 * - Only primary admin can promote or demote administrators.
 * - Ordinary admin can only manage staff roles.
 * - Cannot demote the last primary administrator.
 */
adminUserRouter.patch('/:userId/role', requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { newRole } = req.body;
  const serviceSupabase = req.serviceSupabase;

  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Service client unavailable.' });
  }

  const validRoles = ['staff', 'admin', 'primary_admin'];
  if (!validRoles.includes(newRole)) {
    return res.status(400).json({ error: 'Bad Request', message: `Invalid role. Allowed roles: ${validRoles.join(', ')}.` });
  }

  const callerIsPrimary = isPrimaryAdmin(req.user);

  try {
    // 1. Fetch target user
    const { data: targetData, error: targetError } = await serviceSupabase.auth.admin.getUserById(userId);
    if (targetError || !targetData?.user) {
      return res.status(404).json({ error: 'Not Found', message: 'Target user account not found.' });
    }

    const targetUser = targetData.user;
    const currentTargetRole = targetUser.app_metadata?.role;
    const targetIsPrimary = isPrimaryAdmin(targetUser);

    // 2. Prevent removing or demoting the last primary administrator
    if (targetIsPrimary && newRole !== 'primary_admin') {
      const { data: allUsers } = await serviceSupabase.auth.admin.listUsers({ perPage: 100 });
      const primaryCount = (allUsers?.users || []).filter((u) => isPrimaryAdmin(u)).length;
      if (primaryCount <= 1) {
        return res.status(400).json({
          error: 'Protection Violation',
          message: 'Cannot demote the last primary administrator. Another primary administrator must exist first.',
        });
      }
    }

    // 3. Permission checks:
    // Only primary admin can change roles to or from 'admin' or 'primary_admin'
    if ((newRole === 'admin' || newRole === 'primary_admin' || currentTargetRole === 'admin' || targetIsPrimary) && !callerIsPrimary) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: Only a primary administrator can modify administrator roles.',
      });
    }

    // 4. Update role
    const { error: updateError } = await serviceSupabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(targetUser.app_metadata || {}),
        role: newRole,
      },
    });

    if (updateError) {
      return res.status(500).json({ error: 'Update Failed', message: updateError.message });
    }

    // 5. Record audit log
    await serviceSupabase.from('admin_audit_logs').insert({
      actor_id: req.user.id,
      actor_role: callerIsPrimary ? 'primary_admin' : 'admin',
      action: 'update_user_role',
      reason: `Changed role of user ${targetUser.email} from ${currentTargetRole || 'student'} to ${newRole}`,
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Account role updated to ${newRole}.`,
      userId,
      newRole,
    });
  } catch (err) {
    console.error('[Admin Users] Role update error:', err.message);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to update account role.' });
  }
});

/**
 * PATCH /api/admin/users/:userId/status
 * Deactivates or reactivates a staff or administrator account.
 * Primary administrator cannot be deactivated.
 */
adminUserRouter.patch('/:userId/status', requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { isActive } = req.body;
  const serviceSupabase = req.serviceSupabase;

  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'Bad Request', message: 'Field "isActive" must be a boolean.' });
  }

  const callerIsPrimary = isPrimaryAdmin(req.user);

  try {
    const { data: targetData, error: targetError } = await serviceSupabase.auth.admin.getUserById(userId);
    if (targetError || !targetData?.user) {
      return res.status(404).json({ error: 'Not Found', message: 'Target user account not found.' });
    }

    const targetUser = targetData.user;
    const targetIsPrimary = isPrimaryAdmin(targetUser);

    // Primary administrator can never be deactivated
    if (targetIsPrimary && !isActive) {
      return res.status(400).json({
        error: 'Protection Violation',
        message: 'Cannot deactivate the primary administrator.',
      });
    }

    // Ordinary admin cannot deactivate another admin
    if (isAuthorizedAdmin(targetUser) && !callerIsPrimary) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the primary administrator can change the status of administrator accounts.',
      });
    }

    // Ban duration or activate
    const banDuration = isActive ? 'none' : '876000h'; // ~100 years if deactivated
    const { error: banError } = await serviceSupabase.auth.admin.updateUserById(userId, {
      ban_duration: banDuration,
    });

    if (banError) {
      return res.status(500).json({ error: 'Update Failed', message: banError.message });
    }

    // Audit log
    await serviceSupabase.from('admin_audit_logs').insert({
      actor_id: req.user.id,
      actor_role: callerIsPrimary ? 'primary_admin' : 'admin',
      action: isActive ? 'reactivate_user' : 'deactivate_user',
      reason: `${isActive ? 'Reactivated' : 'Deactivated'} account for ${targetUser.email}`,
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Account has been ${isActive ? 'reactivated' : 'deactivated'}.`,
      userId,
      isActive,
    });
  } catch (err) {
    console.error('[Admin Users] Status update error:', err.message);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to update user status.' });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Removes a staff or administrator account.
 * Primary admin cannot be deleted.
 */
adminUserRouter.delete('/:userId', requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const serviceSupabase = req.serviceSupabase;

  const callerIsPrimary = isPrimaryAdmin(req.user);

  try {
    const { data: targetData, error: targetError } = await serviceSupabase.auth.admin.getUserById(userId);
    if (targetError || !targetData?.user) {
      return res.status(404).json({ error: 'Not Found', message: 'Target user account not found.' });
    }

    const targetUser = targetData.user;
    const targetIsPrimary = isPrimaryAdmin(targetUser);

    if (targetIsPrimary) {
      return res.status(400).json({
        error: 'Protection Violation',
        message: 'Cannot delete the primary administrator.',
      });
    }

    if (isAuthorizedAdmin(targetUser) && !callerIsPrimary) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the primary administrator can delete administrator accounts.',
      });
    }

    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      return res.status(500).json({ error: 'Deletion Failed', message: deleteError.message });
    }

    // Audit log
    await serviceSupabase.from('admin_audit_logs').insert({
      actor_id: req.user.id,
      actor_role: callerIsPrimary ? 'primary_admin' : 'admin',
      action: 'delete_privileged_user',
      reason: `Deleted account ${targetUser.email}`,
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Account deleted successfully.',
    });
  } catch (err) {
    console.error('[Admin Users] Deletion error:', err.message);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to delete account.' });
  }
});

/**
 * GET /api/admin/users/audit-logs
 * Retrieves privileged account management audit history.
 */
adminUserRouter.get('/audit-logs', requireAdmin, async (req, res) => {
  const serviceSupabase = req.serviceSupabase;
  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Service client unavailable.' });
  }

  try {
    const { data, error } = await serviceSupabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Database Error', message: error.message });
    }

    return res.json({
      success: true,
      logs: data || [],
    });
  } catch (err) {
    console.error('[Admin Users] Audit query error:', err.message);
    return res.status(500).json({ error: 'Internal Error', message: 'Failed to retrieve audit logs.' });
  }
});
