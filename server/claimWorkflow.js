/**
 * Hybrid Claim & Return Workflow Engine for FindAI.
 * 
 * Implements:
 * - High-value and dispute classification rules
 * - Server-enforced valid status transitions
 * - Participant authorization (Claimant, Finder, Admin)
 * - Safe dual-confirmation return finalization
 * - In-app notification creation
 */

export const CLAIM_STATUSES = [
  'pending',
  'under_review',
  'approved',
  'rejected',
  'disputed',
  'cancelled',
  'completed',
];

export const HANDOVER_STATUSES = [
  'proposed',
  'scheduled',
  'handover_pending',
  'completed',
  'suspended',
  'cancelled',
];

// Risk Classification Levels
export const RISK_LEVELS = {
  LOW: 'low',
  ELEVATED: 'elevated',
  HIGH: 'high',
};

// Sensitive categories that require safety awareness but permit direct finder return unless disputed
export const SENSITIVE_CATEGORIES = ['electronics', 'jewelry', 'documents', 'wallets', 'cash', 'keys'];

// Sensitive keywords
export const SENSITIVE_KEYWORDS_REGEX = /\b(macbook|iphone|ipad|laptop|computer|phone|camera|gold|diamond|rolex|cash|wallet|passport|ring|watch|jewelry)\b/i;

// Backward compatibility alias
export const HIGH_VALUE_CATEGORIES = SENSITIVE_CATEGORIES;
export const HIGH_VALUE_KEYWORDS_REGEX = SENSITIVE_KEYWORDS_REGEX;

/**
 * Creates an immutable audit trail entry for tracking claim and handover lifecycle events.
 */
export function createAuditEntry({ actorId, actorEmail = null, actorRole, action, reason = null, details = null }) {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: new Date().toISOString(),
    actorId,
    actorEmail,
    actorRole, // 'admin' | 'finder' | 'claimant' | 'system'
    action,    // 'claim_created', 'approve', 'reject', 'admin_approve', 'admin_reject', 'admin_hold', 'admin_release_hold', 'admin_dispute', 'handover_scheduled', 'handover_suspended', 'handover_confirmed', 'completed'
    reason: reason ? String(reason).trim() : null,
    details: details || null,
  };
}

/**
 * Check if user is an authorized admin/security reviewer.
 * Derives strictly from server configuration (ADMIN_EMAILS env) or Supabase app_metadata.
 */
export function isAuthorizedAdmin(user) {
  if (!user) return false;
  
  // 1. Check server-configured admin emails
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (user.email && adminEmails.includes(user.email.toLowerCase())) {
    return true;
  }

  // 2. Check app_metadata role (set exclusively by Supabase backend / service role)
  if (user.app_metadata?.role === 'admin' || user.app_metadata?.role === 'security_reviewer') {
    return true;
  }

  return false;
}

/**
 * Risk-Based Claim Evaluation:
 * Centralized configurable rules:
 * - Ordinary low-risk items: Finder direct return permitted immediately.
 * - Sensitive items (electronics, jewelry): Finder direct return permitted when no risk triggers exist.
 * - Risk Triggers that MANDATE Admin Review & Hold:
 *   1. Multiple active competing claims (> 0) on the same found item.
 *   2. Reported dispute or flagged suspicious proof.
 *   3. Manual escalation by finder or admin.
 */
export function evaluateClaimRisk(foundItem, existingActiveClaimsCount = 0, { isSuspicious = false, isDisputed = false } = {}) {
  if (!foundItem) {
    return { riskLevel: RISK_LEVELS.LOW, requiresAdminReview: false, isDisputed: false, isSensitive: false, reason: null };
  }

  // Mandatory Hold Trigger 1: Competing multiple claims on same found item
  if (existingActiveClaimsCount > 0) {
    return {
      riskLevel: RISK_LEVELS.HIGH,
      requiresAdminReview: true,
      isDisputed: true,
      isSensitive: true,
      reason: `Competing claims detected (${existingActiveClaimsCount + 1} active claims for this found item). Placed on administrative hold to prevent wrongful handover.`,
    };
  }

  // Mandatory Hold Trigger 2: Reported dispute or suspected fraud
  if (isDisputed || isSuspicious) {
    return {
      riskLevel: RISK_LEVELS.HIGH,
      requiresAdminReview: true,
      isDisputed: true,
      isSensitive: true,
      reason: 'Claim placed on administrative hold due to reported suspicion or ownership dispute.',
    };
  }

  // Check sensitivity classification
  const category = (foundItem.category || '').toLowerCase();
  const text = `${foundItem.title || ''} ${foundItem.description || ''}`.toLowerCase();
  const isSensitive = SENSITIVE_CATEGORIES.includes(category) || SENSITIVE_KEYWORDS_REGEX.test(text);

  if (isSensitive) {
    return {
      riskLevel: RISK_LEVELS.ELEVATED,
      requiresAdminReview: false, // Finder CAN directly approve and arrange return!
      isDisputed: false,
      isSensitive: true,
      reason: 'Sensitive item category. Finder direct return permitted; monitored in Admin Dashboard.',
    };
  }

  return {
    riskLevel: RISK_LEVELS.LOW,
    requiresAdminReview: false,
    isDisputed: false,
    isSensitive: false,
    reason: null,
  };
}

// Backward-compatible alias for existing tests and routes
export function evaluateHighValueAndDispute(foundItem, existingActiveClaimsCount = 0) {
  return evaluateClaimRisk(foundItem, existingActiveClaimsCount);
}

/**
 * Validates permitted claim status transitions.
 */
export function isValidClaimStatusTransition(currentStatus, newStatus, { isFinder = false, isAdmin = false } = {}) {
  if (currentStatus === newStatus) return true;

  // Terminal states cannot transition further
  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    return false;
  }

  // Admin has authority to transition between review states and approve/reject/override
  if (isAdmin) {
    const adminAllowed = {
      pending: ['under_review', 'approved', 'rejected', 'disputed', 'cancelled'],
      under_review: ['approved', 'rejected', 'disputed', 'pending', 'cancelled'],
      disputed: ['under_review', 'approved', 'rejected', 'pending', 'cancelled'],
      approved: ['under_review', 'disputed', 'cancelled', 'completed'],
      rejected: ['under_review', 'pending'], // reopen if new evidence presented
    };
    return (adminAllowed[currentStatus] || []).includes(newStatus);
  }

  // Finder rules
  if (isFinder) {
    const finderAllowed = {
      pending: ['approved', 'rejected', 'under_review', 'disputed'],
      under_review: ['rejected'], // if admin placed on hold, finder cannot bypass unless released
      approved: ['under_review'], // finder can report an issue after approval
    };
    return (finderAllowed[currentStatus] || []).includes(newStatus);
  }

  // Claimant rules
  const claimantAllowed = {
    pending: ['cancelled'],
    under_review: ['cancelled'],
    approved: ['cancelled'],
    disputed: ['cancelled'],
  };
  return (claimantAllowed[currentStatus] || []).includes(newStatus);
}

/**
 * Creates an in-app user notification safely without leaking sensitive information.
 */
export async function createUserNotification(supabaseClient, { recipientId, type, claimId = null, message }) {
  if (!supabaseClient || !recipientId || !type || !message) return null;

  try {
    const { data, error } = await supabaseClient
      .from('user_notifications')
      .insert([
        {
          recipient_id: recipientId,
          type,
          claim_id: claimId,
          message: message.trim(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.warn('[Notifications] Failed to create notification:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[Notifications] Unexpected error creating notification:', err.message);
    return null;
  }
}
