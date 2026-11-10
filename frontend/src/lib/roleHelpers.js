// src/lib/roleHelpers.js

/**
 * Helper to determine full administrator status (primary_admin, super_admin, admin, security_reviewer)
 */
export const isAdminUser = (user) => {
  if (!user) return false;
  const role = user.app_metadata?.role;
  if (role === 'primary_admin' || role === 'super_admin' || role === 'admin' || role === 'security_reviewer') {
    return true;
  }
  if (user.email && (user.email_confirmed_at || user.confirmed_at)) {
    const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || import.meta.env.VITE_PRIMARY_ADMIN_EMAIL || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.includes(user.email.toLowerCase())) {
      return true;
    }
  }
  return false;
};

/**
 * Helper to determine staff or administrator status (can access moderation, handovers, claims)
 */
export const isStaffOrAdminUser = (user) => {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  const role = user.app_metadata?.role;
  return role === 'staff';
};

/**
 * Helper to determine if user is the primary / super administrator
 */
export const isPrimaryAdminUser = (user) => {
  if (!user) return false;
  const role = user.app_metadata?.role;
  if (role === 'primary_admin' || role === 'super_admin') return true;
  if (user.email && (user.email_confirmed_at || user.confirmed_at)) {
    const primaryAdmin = (import.meta.env.VITE_PRIMARY_ADMIN_EMAIL || import.meta.env.VITE_ADMIN_EMAILS || '')
      .split(',')[0]?.trim().toLowerCase();
    if (primaryAdmin && user.email.toLowerCase() === primaryAdmin) return true;
  }
  return false;
};

/**
 * Get human-friendly role title for display in UI
 */
export const getUserRoleTitle = (user) => {
  if (!user) return 'Guest';
  if (isPrimaryAdminUser(user)) return 'Primary Administrator';
  if (isAdminUser(user)) return 'Administrator';
  if (isStaffOrAdminUser(user)) return 'Staff Member';
  if (user.user_metadata?.registration_number) {
    return `Student (${user.user_metadata.registration_number})`;
  }
  return 'Community Member';
};
