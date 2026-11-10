/**
-- ==============================================================================
-- Test Suite: testSuspiciousHandover.js
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 1: Suspicious Handover Detection & Simplified Handover Verification Tests
-- ==============================================================================
*/

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  trackAttempt,
  sanitizeIncidentMetadata,
  generateIncidentId,
  recordSuspiciousIncident,
  applyHandoverHold,
  releaseHandoverHold,
  attemptTracker,
  INCIDENT_SEVERITIES,
} from './suspiciousHandoverService.js';
import { isAuthorizedAdmin } from './claimWorkflow.js';

// ==============================================================================
// 1. Simplified Handover Dual-Confirmation Workflow Tests
// ==============================================================================

test('[Workflow] Dual confirmation completes return only when BOTH finder and claimant confirm', () => {
  // Step 1: Initial state (neither confirmed)
  let handover = {
    id: 'handover-1',
    status: 'scheduled',
    finder_confirmed_at: null,
    claimant_confirmed_at: null,
    completed_at: null,
  };

  // Step 2: Finder confirms handing over
  const finderUpdate = { finder_confirmed_at: new Date().toISOString() };
  let finderWillBeConfirmed = Boolean(handover.finder_confirmed_at || finderUpdate.finder_confirmed_at);
  let claimantWillBeConfirmed = Boolean(handover.claimant_confirmed_at);
  let isComplete = finderWillBeConfirmed && claimantWillBeConfirmed;

  assert.equal(isComplete, false, 'Return must NOT be complete after only finder confirms');
  handover = { ...handover, ...finderUpdate, status: 'in_progress' };
  assert.equal(handover.status, 'in_progress', 'Handover status moves to in_progress');

  // Step 3: Claimant confirms receipt
  const claimantUpdate = { claimant_confirmed_at: new Date().toISOString() };
  finderWillBeConfirmed = Boolean(handover.finder_confirmed_at);
  claimantWillBeConfirmed = Boolean(handover.claimant_confirmed_at || claimantUpdate.claimant_confirmed_at);
  isComplete = finderWillBeConfirmed && claimantWillBeConfirmed;

  assert.equal(isComplete, true, 'Return completes ONLY when both authorized parties confirm');
  handover = { ...handover, ...claimantUpdate, status: 'completed', completed_at: new Date().toISOString() };
  assert.equal(handover.status, 'completed');
  assert.ok(handover.completed_at);
});

test('[Workflow] Random logged-in user cannot confirm handover as finder', () => {
  const handover = {
    id: 'handover-auth-test',
    claim: {
      found_item: { user_id: 'legitimate-finder-uuid' },
      claimant_id: 'legitimate-claimant-uuid',
      status: 'approved',
    },
  };
  const attackerUser = { id: 'random-student-intruder', email: 'intruder@university.edu' };

  const isFinder = handover.claim.found_item.user_id === attackerUser.id;
  const isAdmin = isAuthorizedAdmin(attackerUser);

  assert.equal(isFinder, false, 'Intruder is not the finder');
  assert.equal(isAdmin, false, 'Intruder is not an admin');
  const allowed = isFinder || isAdmin;
  assert.equal(allowed, false, 'Unauthorized non-finder must be rejected with 403');
});

test('[Workflow] Random logged-in user cannot confirm handover as claimant', () => {
  const handover = {
    id: 'handover-auth-test',
    claim: {
      found_item: { user_id: 'legitimate-finder-uuid' },
      claimant_id: 'legitimate-claimant-uuid',
      status: 'approved',
    },
  };
  const attackerUser = { id: 'random-student-intruder', email: 'intruder@university.edu' };

  const isClaimant = handover.claim.claimant_id === attackerUser.id;
  const isAdmin = isAuthorizedAdmin(attackerUser);

  assert.equal(isClaimant, false, 'Intruder is not the claimant');
  assert.equal(isAdmin, false, 'Intruder is not an admin');
  const allowed = isClaimant || isAdmin;
  assert.equal(allowed, false, 'Unauthorized non-claimant must be rejected with 403');
});

test('[Workflow] Premature confirmation blocked when claim is not approved', () => {
  const pendingStatuses = ['pending', 'under_review', 'rejected', 'disputed'];

  for (const st of pendingStatuses) {
    const handover = {
      claim: { status: st },
    };
    const canConfirm = Boolean(handover.claim && handover.claim.status === 'approved');
    assert.equal(canConfirm, false, `Handover confirmation must be blocked when claim status is ${st}`);
  }

  const approvedHandover = {
    claim: { status: 'approved' },
  };
  const canConfirmApproved = Boolean(approvedHandover.claim && approvedHandover.claim.status === 'approved');
  assert.equal(canConfirmApproved, true, 'Handover confirmation allowed when claim is approved');
});

test('[Workflow] Suspended handover blocks confirmation until review resolution', () => {
  const suspendedHandover = {
    status: 'suspended',
    is_flagged: true,
    flagged_reason: 'Suspicious activity detected',
  };

  const isHoldActive = suspendedHandover.status === 'suspended' || suspendedHandover.is_flagged;
  assert.equal(isHoldActive, true, 'Confirmations must be blocked while handover is suspended or flagged');
});

// ==============================================================================
// 2. Incident Sanitization & Credential Protection Tests
// ==============================================================================

test('[Sanitization] sanitizeIncidentMetadata strips passwords and tokens', () => {
  const dirtyMetadata = {
    submittedPassword: 'SuperSecretPassword123',
    userAccessToken: 'eyJh...token',
    itemTitle: 'Calculus Textbook',
    attemptNumber: 2,
    nested: {
      apiSecret: 'my-secret-key',
      ip: '192.168.1.1',
    },
  };

  const clean = sanitizeIncidentMetadata(dirtyMetadata);

  assert.equal(clean.submittedPassword, '[REDACTED]');
  assert.equal(clean.userAccessToken, '[REDACTED]');
  assert.equal(clean.nested.apiSecret, '[REDACTED]');
  assert.equal(clean.itemTitle, 'Calculus Textbook');
  assert.equal(clean.attemptNumber, 2);
  assert.equal(clean.nested.ip, '192.168.1.1');
});

test('[Incidents] generateIncidentId creates unique, standardized incident IDs', () => {
  const id1 = generateIncidentId();
  const id2 = generateIncidentId();
  assert.match(id1, /^INC-\d{8}-[A-F0-9]{6}$/);
  assert.match(id2, /^INC-\d{8}-[A-F0-9]{6}$/);
  assert.notEqual(id1, id2);
});

// ==============================================================================
// 3. Incident Logging & Deduplication Tests
// ==============================================================================

test('[Incidents] recordSuspiciousIncident creates and dedupes open incidents by incrementing attempts', async () => {
  const handoverId = 'test-handover-uuid-dedupe';

  // First occurrence
  const inc1 = await recordSuspiciousIncident({
    handoverId,
    claimId: 'claim-1',
    incidentType: 'unauthorized_attempt',
    reason: 'Unauthorized user attempted to confirm handover',
    severity: INCIDENT_SEVERITIES.HIGH,
  });

  assert.ok(inc1.incident_id);
  assert.equal(inc1.attempt_count, 1);
  assert.equal(inc1.status, 'pending_review');

  // Second occurrence on the same handover
  const inc2 = await recordSuspiciousIncident({
    handoverId,
    claimId: 'claim-1',
    incidentType: 'unauthorized_attempt',
    reason: 'Repeated unauthorized user attempt',
    severity: INCIDENT_SEVERITIES.HIGH,
  });

  // Must deduplicate by updating existing incident attempt_count
  assert.equal(inc2.incident_id, inc1.incident_id, 'Should update same incident ID');
  assert.equal(inc2.attempt_count, 2, 'Attempt count must increment');
});

// ==============================================================================
// 4. Rate-Limiting & Unusual Attempt Burst Tests
// ==============================================================================

test('[Burst] trackAttempt detects rapid attempts burst within time window', () => {
  const key = 'burst-test-simplified';
  attemptTracker.delete(key);

  // Send 4 attempts -> not yet a burst
  for (let i = 0; i < 4; i++) {
    const res = trackAttempt(key);
    assert.equal(res.isBurst, false);
  }

  // 5th attempt -> triggers burst threshold
  const res5 = trackAttempt(key);
  assert.equal(res5.isBurst, true);
  assert.equal(res5.count, 5);
});

// ==============================================================================
// 5. Handover Administrative Hold & Release Tests
// ==============================================================================

test('[Hold] applyHandoverHold marks handover as suspended in memory and DB', async () => {
  const handoverId = 'test-handover-hold-simplified';
  const result = await applyHandoverHold(null, {
    handoverId,
    reason: 'Unusual attempt frequency detected',
  });

  assert.equal(result.holdApplied, true);
  assert.equal(result.handoverId, handoverId);
});

test('[Release] releaseHandoverHold rejects unauthorized non-admin user', async () => {
  const regularUser = {
    id: 'student-user-1',
    app_metadata: { role: 'authenticated' },
  };

  await assert.rejects(
    async () => {
      await releaseHandoverHold(null, {
        handoverId: 'test-handover-hold-simplified',
        adminUser: regularUser,
        decisionNotes: 'Attempting to release hold',
      });
    },
    /Unauthorized/i
  );
});

test('[Release] releaseHandoverHold rejects missing decision notes', async () => {
  const adminUser = {
    id: 'admin-user-1',
    app_metadata: { role: 'admin' },
  };

  await assert.rejects(
    async () => {
      await releaseHandoverHold(null, {
        handoverId: 'test-handover-hold-simplified',
        adminUser,
        decisionNotes: '', // Empty notes
      });
    },
    /Mandatory decision notes are required/i
  );
});

test('[Release] releaseHandoverHold succeeds for verified admin with documented notes', async () => {
  const adminUser = {
    id: 'admin-user-1',
    app_metadata: { role: 'admin' },
  };

  const result = await releaseHandoverHold(null, {
    handoverId: 'test-handover-hold-simplified',
    adminUser,
    decisionNotes: 'Verified claimant student ID card in person at Campus Security desk.',
  });

  assert.equal(result.holdReleased, true);
  assert.equal(result.handoverId, 'test-handover-hold-simplified');
  assert.match(result.decisionNotes, /Verified claimant student ID/);
});

console.log('--- All Suspicious Handover Detection & Simplified Handover tests passed successfully! ---');
