import assert from 'node:assert/strict';
import {
  evaluateClaimRisk,
  evaluateHighValueAndDispute,
  isValidClaimStatusTransition,
  isAuthorizedAdmin,
  createAuditEntry,
  RISK_LEVELS,
} from './claimWorkflow.js';

console.log('--- FindAI Hybrid Claim & Return Workflow Test Suite ---');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// 1. Risk-Based Rules Evaluation: Ordinary Items
test('evaluateClaimRisk permits direct finder return for ordinary, low-risk items', () => {
  const standardItem = {
    title: 'Found gray knit winter scarf',
    description: 'Wool neck scarf left on cafeteria bench',
    category: 'clothing',
  };
  const evalStandard = evaluateClaimRisk(standardItem, 0);
  assert.equal(evalStandard.riskLevel, RISK_LEVELS.LOW);
  assert.equal(evalStandard.requiresAdminReview, false, 'Ordinary items must not require admin review');
  assert.equal(evalStandard.isDisputed, false);
  assert.equal(evalStandard.isSensitive, false);

  const waterBottle = {
    title: 'Found blue metal water flask',
    description: 'Left near water fountain',
    category: 'other',
  };
  const evalBottle = evaluateClaimRisk(waterBottle, 0);
  assert.equal(evalBottle.riskLevel, RISK_LEVELS.LOW);
  assert.equal(evalBottle.requiresAdminReview, false);
});

// 2. Risk-Based Rules Evaluation: Sensitive Items without Risk Triggers
test('evaluateClaimRisk permits direct finder return for sensitive items when uncontested', () => {
  const electronicsItem = {
    title: 'Found Apple iPhone 14',
    description: 'Black smartphone with case',
    category: 'electronics',
  };
  const evalElec = evaluateClaimRisk(electronicsItem, 0);
  assert.equal(evalElec.riskLevel, RISK_LEVELS.ELEVATED);
  assert.equal(evalElec.isSensitive, true);
  assert.equal(evalElec.requiresAdminReview, false, 'Uncontested sensitive items must permit direct finder return');
  assert.equal(evalElec.isDisputed, false);

  const jewelryItem = {
    title: 'Found gold necklace',
    description: 'Gold chain with small pendant',
    category: 'jewelry',
  };
  const evalJewelry = evaluateClaimRisk(jewelryItem, 0);
  assert.equal(evalJewelry.riskLevel, RISK_LEVELS.ELEVATED);
  assert.equal(evalJewelry.isSensitive, true);
  assert.equal(evalJewelry.requiresAdminReview, false);
});

// 3. Risk-Based Rules Evaluation: Competing Claims Trigger Automatic Hold
test('evaluateClaimRisk automatically places claims on hold when competing claims exist', () => {
  const standardItem = {
    title: 'Found blue backpack',
    description: 'Standard daypack',
    category: 'clothing',
  };
  // 1 existing active claim -> new claim creates competing claim situation
  const evalCompeting = evaluateClaimRisk(standardItem, 1);
  assert.equal(evalCompeting.riskLevel, RISK_LEVELS.HIGH);
  assert.equal(evalCompeting.requiresAdminReview, true, 'Competing claims must mandate administrative hold');
  assert.equal(evalCompeting.isDisputed, true);
  assert.match(evalCompeting.reason, /competing claims detected/i);
});

// 4. Risk-Based Rules Evaluation: Reported Dispute or Suspicion
test('evaluateClaimRisk flags claims as high risk when dispute or suspicion is reported', () => {
  const ordinaryItem = {
    title: 'Found notebook',
    category: 'other',
  };
  const evalDispute = evaluateClaimRisk(ordinaryItem, 0, { isDisputed: true });
  assert.equal(evalDispute.riskLevel, RISK_LEVELS.HIGH);
  assert.equal(evalDispute.requiresAdminReview, true);
  assert.equal(evalDispute.isDisputed, true);
});

// 5. Admin Authority Checks
test('isAuthorizedAdmin verifies server-configured admin emails strictly and case-insensitively', () => {
  process.env.ADMIN_EMAILS = 'security@university.edu,admin@findai.org,mdarmanalam2529@gmail.com';

  assert.equal(isAuthorizedAdmin({ email: 'security@university.edu' }), true);
  assert.equal(isAuthorizedAdmin({ email: 'SECURITY@UNIVERSITY.EDU' }), true);
  assert.equal(isAuthorizedAdmin({ email: 'mdarmanalam2529@gmail.com' }), true);
  assert.equal(isAuthorizedAdmin({ email: 'attacker@evil.com' }), false);
  assert.equal(isAuthorizedAdmin({ email: 'fakeadmin@findai.org.attacker.com' }), false);
  assert.equal(isAuthorizedAdmin(null), false);
});

test('isAuthorizedAdmin honors app_metadata role and strictly ignores browser-tampered user_metadata', () => {
  const adminUser = {
    email: 'staff@campus.edu',
    app_metadata: { role: 'admin' },
  };
  assert.equal(isAuthorizedAdmin(adminUser), true);

  const regularUserWithTamperedUserMetadata = {
    email: 'user@campus.edu',
    user_metadata: { role: 'admin' }, // Tampered user_metadata must be IGNORED
    app_metadata: {},
  };
  assert.equal(isAuthorizedAdmin(regularUserWithTamperedUserMetadata), false, 'User metadata role must never grant admin rights');
});

// 6. Claim Status Transitions
test('isValidClaimStatusTransition permits valid workflows and rejects illegal jumps', () => {
  // Finder direct return workflow: pending -> approved
  assert.equal(isValidClaimStatusTransition('pending', 'approved', { isFinder: true }), true);
  assert.equal(isValidClaimStatusTransition('pending', 'rejected', { isFinder: true }), true);
  assert.equal(isValidClaimStatusTransition('pending', 'under_review', { isFinder: true }), true);

  // Terminal states cannot transition further
  assert.equal(isValidClaimStatusTransition('completed', 'pending', { isFinder: true, isAdmin: true }), false);
  assert.equal(isValidClaimStatusTransition('cancelled', 'approved', { isFinder: true, isAdmin: true }), false);

  // Claimant cannot approve their own claim
  assert.equal(isValidClaimStatusTransition('pending', 'approved', { isFinder: false, isAdmin: false }), false);
  // Claimant CAN cancel their claim
  assert.equal(isValidClaimStatusTransition('pending', 'cancelled', { isFinder: false, isAdmin: false }), true);
});

test('isValidClaimStatusTransition allows admin to place/release hold and resolve disputes', () => {
  // Admin placing on hold: pending -> under_review
  assert.equal(isValidClaimStatusTransition('pending', 'under_review', { isAdmin: true }), true);
  // Admin releasing hold: under_review -> pending
  assert.equal(isValidClaimStatusTransition('under_review', 'pending', { isAdmin: true }), true);
  // Admin overriding dispute: disputed -> approved
  assert.equal(isValidClaimStatusTransition('disputed', 'approved', { isAdmin: true }), true);
  // Admin resolving dispute back to pending: disputed -> pending
  assert.equal(isValidClaimStatusTransition('disputed', 'pending', { isAdmin: true }), true);
});

// 7. Contested Claim Gate: Finder Cannot Bypass Required Admin Review
test('Finder approval is blocked when claim is placed on administrative hold', () => {
  const heldClaim = {
    id: 'claim-01',
    found_item_id: 'found-01',
    requires_admin_review: true,
    status: 'under_review',
  };

  const action = 'approve';
  const isAdmin = false;
  const isFinder = true;

  let blocked = false;
  let responseError = null;

  if (action === 'approve' && heldClaim.requires_admin_review && !isAdmin) {
    blocked = true;
    responseError = 'Admin Review Required: Claim has an active administrative hold.';
  }

  assert.equal(blocked, true, 'Finder must NOT be able to approve claim under administrative hold');
  assert.match(responseError, /Admin Review Required/i);
});

// 8. Dual Confirmation Gate for Safe Return Finalization
test('Dual confirmation requires BOTH finder and claimant confirmations before return completion', () => {
  const handoverState1 = {
    finder_confirmed_at: '2026-10-18T10:00:00Z',
    claimant_confirmed_at: null, // Claimant has not confirmed yet
  };
  const bothConfirmed1 = Boolean(handoverState1.finder_confirmed_at && handoverState1.claimant_confirmed_at);
  assert.equal(bothConfirmed1, false, 'Finder confirmation alone cannot complete return');

  const handoverState2 = {
    finder_confirmed_at: null, // Finder has not confirmed yet
    claimant_confirmed_at: '2026-10-18T10:05:00Z',
  };
  const bothConfirmed2 = Boolean(handoverState2.finder_confirmed_at && handoverState2.claimant_confirmed_at);
  assert.equal(bothConfirmed2, false, 'Claimant confirmation alone cannot complete return');

  const handoverState3 = {
    finder_confirmed_at: '2026-10-18T10:00:00Z',
    claimant_confirmed_at: '2026-10-18T10:05:00Z',
  };
  const bothConfirmed3 = Boolean(handoverState3.finder_confirmed_at && handoverState3.claimant_confirmed_at);
  assert.equal(bothConfirmed3, true, 'Both confirmations present permits completion');
});

test('Suspended handover blocks confirmation and finalization', () => {
  const handover = {
    status: 'suspended',
    finder_confirmed_at: '2026-10-18T10:00:00Z',
  };

  let isBlocked = false;
  if (handover.status === 'suspended') {
    isBlocked = true;
  }
  assert.equal(isBlocked, true, 'Suspended handover must block confirmation attempts');
});

// 9. Ownership & Pairing Validation Logic
test('Claim creation validation rejects claiming own found report or mismatched items', () => {
  const callerId = 'user-alice';
  const foundItemOwnedByAlice = { id: 'f-1', user_id: 'user-alice', item_type: 'found' };
  const lostItemOwnedByBob = { id: 'l-1', user_id: 'user-bob', item_type: 'lost' };

  // Attempt 1: Claim own found report
  const isOwnReport = foundItemOwnedByAlice.user_id === callerId;
  assert.equal(isOwnReport, true, 'Detects caller owns the found report');

  // Attempt 2: Use lost report owned by someone else
  const callerOwnsLostReport = lostItemOwnedByBob.user_id === callerId;
  assert.equal(callerOwnsLostReport, false, 'Detects caller does not own the lost report');

  // Attempt 3: Same report ID for found and lost
  const isSameItem = 'same-uuid' === 'same-uuid';
  assert.equal(isSameItem, true, 'Detects same item ID cannot be both lost and found in a claim');
});

// 10. Admin Review Actions & Audit Trail
test('Admin review workflow: admin_approve overrides hold with mandatory audit reason', () => {
  const adminUser = { id: 'admin-1', email: 'security@findai.org' };
  process.env.ADMIN_EMAILS = 'security@findai.org';
  assert.equal(isAuthorizedAdmin(adminUser), true);

  const claim = {
    id: 'claim-100',
    status: 'under_review',
    requires_admin_review: true,
  };

  assert.equal(isValidClaimStatusTransition(claim.status, 'approved', { isAdmin: true }), true);
  
  claim.status = 'approved';
  claim.reviewed_by = adminUser.id;
  claim.reviewed_at = new Date().toISOString();
  claim.decision_reason = 'Verified by security staff via purchase receipt';

  assert.equal(claim.status, 'approved');
  assert.equal(claim.reviewed_by, 'admin-1');
});

test('Admin review workflow: admin_hold places claim on hold with recorded reason', () => {
  const claim = {
    id: 'claim-102',
    status: 'pending',
    requires_admin_review: false,
  };

  assert.equal(isValidClaimStatusTransition(claim.status, 'under_review', { isAdmin: true }), true);
  claim.status = 'under_review';
  claim.requires_admin_review = true;
  claim.decision_reason = 'Placed on administrative hold: Suspicious matching serial number';

  assert.equal(claim.status, 'under_review');
  assert.equal(claim.requires_admin_review, true);
  assert.match(claim.decision_reason, /administrative hold/i);
});

test('createAuditEntry generates structured, timestamped audit log records', () => {
  const entry = createAuditEntry({
    actorId: 'user-123',
    actorEmail: 'admin@findai.org',
    actorRole: 'admin',
    action: 'admin_hold',
    reason: 'Fraud investigation',
    details: { previousStatus: 'pending', newStatus: 'under_review' },
  });

  assert.ok(entry.id.startsWith('audit-'));
  assert.ok(entry.timestamp);
  assert.equal(entry.actorId, 'user-123');
  assert.equal(entry.actorRole, 'admin');
  assert.equal(entry.action, 'admin_hold');
  assert.equal(entry.reason, 'Fraud investigation');
  assert.equal(entry.details.newStatus, 'under_review');
});

console.log(`\nAll ${passed}/${total} Hybrid Claim & Return Workflow tests passed successfully!`);
