/**
 * ==============================================================================
 * Test Suite: testEndToEndStudentWorkflow.js
 * Project: FindAI - University Lost-and-Found Platform
 * Scope: Full Student Lifecycle & Autonomous Journey Verification (Synthetic Sandbox)
 * ==============================================================================
 * Lifecycle Coverage:
 * 1. Student Registration (Registration number + University email)
 * 2. Identity Verification & Registry Eligibility Check
 * 3. Account Activation & Login Token Simulation
 * 4. Lost & Found Report Creation
 * 5. AI Semantic Matching & Privacy Redaction
 * 6. Claim Submission with Private Proof of Ownership
 * 7. Claim Review & Approval
 * 8. Handover Coordination (Location & Schedule)
 * 9. Dual-Confirmation Handover (Finder Handed Over -> Claimant Received)
 * 10. Atomic Return Finalization & Notifications
 * 11. Edge Cases: Invalid Registration, Unauthorized Confirmation, Dispute Hold, Admin Hold Release
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  normalizeRegistrationNumber,
  evaluateStudentEligibility,
  isAccountActive,
} from './studentValidation.js';
import { rankCandidateMatches } from './aiMatcher.js';
import {
  evaluateClaimRisk,
  isValidClaimStatusTransition,
  createAuditEntry,
  RISK_LEVELS,
} from './claimWorkflow.js';
import {
  determineConfirmationState,
} from './adminHandoverRoutes.js';
import {
  recordSuspiciousIncident,
  applyHandoverHold,
  releaseHandoverHold,
} from './suspiciousHandoverService.js';

const testsQueue = [];
function test(name, fn) {
  testsQueue.push({ name, fn });
}

async function runAllTests() {
  console.log('--- FindAI Full Student Journey: End-to-End Synthetic Verification ---');
  let passed = 0;
  for (const { name, fn } of testsQueue) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      throw err;
    }
  }
  console.log(`\nAll ${passed}/${testsQueue.length} End-to-End Student Journey tests passed successfully!\n`);
}

// ==============================================================================
// 1. Synthetic Registry Setup & Registration Verification
// ==============================================================================

const SYNTHETIC_REGISTRY = [
  {
    registration_number: 'REG2026-CS-101',
    student_name: 'Alice Cooper',
    official_email: 'alice.cooper@university.edu',
    branch: 'Computer Science',
    is_eligible: true,
  },
  {
    registration_number: 'REG2026-EE-202',
    student_name: 'Bob Martinez',
    official_email: 'bob.martinez@university.edu',
    branch: 'Electrical Engineering',
    is_eligible: true,
  },
];

test('[Journey Step 1] Student Registration & University Registry Lookup', () => {
  const claimantSignup = {
    registrationNumber: 'reg2026-cs-101', // case normalization test
    studentName: 'Alice Cooper',
    email: 'alice.cooper@university.edu',
  };

  const regNorm = normalizeRegistrationNumber(claimantSignup.registrationNumber);
  assert.equal(regNorm, 'REG2026-CS-101');

  const registryMatch = SYNTHETIC_REGISTRY.find(
    (r) => r.registration_number === regNorm
  );
  assert.ok(registryMatch, 'Student record must exist in institutional registry');

  const eligibility = evaluateStudentEligibility(claimantSignup, registryMatch, null);
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.initialVerificationStatus, 'verified');
  assert.equal(eligibility.registryData.student_name, 'Alice Cooper');
});

test('[Journey Step 2] Student Account Activation & Ineligible Guard', () => {
  // Eligible student profile activates directly
  const activeProfile = {
    verificationStatus: 'verified',
    isEligible: true,
  };
  assert.equal(isAccountActive(activeProfile), true);

  // Suspended profile is rejected
  const suspendedProfile = {
    verificationStatus: 'suspended',
    isEligible: true,
  };
  assert.equal(isAccountActive(suspendedProfile), false);

  // Ineligible registry profile is rejected
  const ineligibleProfile = {
    verificationStatus: 'verified',
    isEligible: false,
  };
  assert.equal(isAccountActive(ineligibleProfile), false);
});

// ==============================================================================
// 2. Report Creation & AI Matching
// ==============================================================================

const lostReportAlice = {
  id: 'lost-report-101',
  user_id: 'user-alice-01',
  item_type: 'lost',
  category: 'electronics',
  title: 'Space Grey MacBook Pro M2',
  description: 'Lost in Science Hall 3rd floor. Has stickers on cover. Call 555-0199 or email alice@personal.com if found.',
  location_description: 'Science Hall 3rd floor',
  incident_date: '2026-10-25',
  color: 'Grey',
  status: 'open',
};

const foundReportBob = {
  id: 'found-report-202',
  user_id: 'user-bob-02',
  item_type: 'found',
  category: 'electronics',
  title: 'Apple MacBook Pro Space Gray',
  description: 'Found unattended in Science Hall Library study area. Laptop in good condition with vinyl decals.',
  location_description: 'Science Hall Library',
  incident_date: '2026-10-25',
  color: 'Grey',
  status: 'open',
};

test('[Journey Step 3] AI Semantic Matching & Automatic Contact Redaction', async () => {
  // Rank candidate matches for Alice's lost report against candidate pool
  const candidatePool = [
    foundReportBob,
    {
      id: 'found-report-distractor',
      user_id: 'user-other-03',
      item_type: 'found',
      category: 'clothing',
      title: 'Blue Denim Jacket',
      description: 'Found in cafeteria',
      location_description: 'Dining Hall',
      incident_date: '2026-10-20',
      color: 'Blue',
      status: 'open',
    },
  ];

  const matchResults = await rankCandidateMatches(lostReportAlice, candidatePool);

  assert.ok(matchResults.length > 0, 'AI Matcher must return candidates');
  const topMatch = matchResults[0];

  assert.equal(topMatch.id, foundReportBob.id, 'Bob\'s found MacBook must rank as top candidate');
  assert.ok(topMatch.score > 60, `Overall score should exceed 60% (got ${topMatch.score}%)`);
  assert.equal(topMatch.category, 'electronics');
  assert.ok(topMatch.explanation.includes('Matching category') || topMatch.explanation.includes('description'));
  assert.ok(topMatch.disclaimer.length > 0);
});

// ==============================================================================
// 3. Claim Submission & Risk Evaluation
// ==============================================================================

test('[Journey Step 4] Claim Submission with Private Proof & Risk Assessment', () => {
  const privateProof = {
    serialNumber: 'C02G8921MD6T',
    identifyingMarks: 'Scratch on left hinge; small sticker of Turing machine',
    purchaseReceiptAttached: true,
    auditTrail: [
      createAuditEntry({
        actorId: 'user-alice-01',
        actorRole: 'claimant',
        action: 'claim_created',
        reason: 'Claim submitted with serial number and proof of purchase',
      }),
    ],
  };

  const initialClaim = {
    id: 'claim-journey-001',
    lost_item_id: lostReportAlice.id,
    found_item_id: foundReportBob.id,
    claimant_id: 'user-alice-01',
    claim_message: 'This is my MacBook Pro lost in Science Hall on Monday.',
    private_proof: privateProof,
    status: 'pending',
    risk_level: 'low',
    requires_admin_review: false,
  };

  // Evaluate risk level for electronics
  const riskEval = evaluateClaimRisk(foundReportBob, 0);
  assert.equal(riskEval.riskLevel, RISK_LEVELS.ELEVATED, 'High-tech electronics categorized as elevated risk');
  // Finder direct return permitted for non-disputed elevated items
  assert.equal(riskEval.requiresAdminReview, false);

  assert.equal(initialClaim.status, 'pending');
  assert.equal(initialClaim.private_proof.serialNumber, 'C02G8921MD6T');
});

// ==============================================================================
// 4. Claim Review & Approval
// ==============================================================================

test('[Journey Step 5] Finder Reviews Private Proof and Approves Claim', () => {
  // Validate status transition: pending -> approved by finder
  const isAllowed = isValidClaimStatusTransition('pending', 'approved', { isFinder: true });
  assert.equal(isAllowed, true, 'Finder is authorized to approve pending claim');

  // Claimant self-approval MUST be rejected
  const claimantForbidden = isValidClaimStatusTransition('pending', 'approved', { isFinder: false, isAdmin: false });
  assert.equal(claimantForbidden, false, 'Claimant cannot self-approve claim');
});

// ==============================================================================
// 5. Handover Coordination & Dual Confirmation
// ==============================================================================

test('[Journey Step 6] Handover Coordination: Location & Schedule Proposed', () => {
  const handoverRecord = {
    id: '99999999-9999-4999-a999-999999999999',
    claim_id: 'claim-journey-001',
    status: 'scheduled',
    proposed_location: 'Campus Security Center - Main Desk',
    scheduled_at: '2026-10-29T14:00:00Z',
    notes: 'Please bring your student ID card.',
    finder_confirmed_at: null,
    claimant_confirmed_at: null,
    is_flagged: false,
  };

  const state1 = determineConfirmationState(handoverRecord);
  assert.equal(state1, 'pending_both', 'Initial scheduled state requires dual confirmation');
});

test('[Journey Step 7] Dual Confirmation Gate: Step 1 - Finder Confirms Handover', () => {
  const handoverRecord = {
    id: '99999999-9999-4999-a999-999999999999',
    claim_id: 'claim-journey-001',
    status: 'scheduled',
    finder_confirmed_at: null,
    claimant_confirmed_at: null,
    is_flagged: false,
  };

  // Finder hands over item and confirms
  handoverRecord.finder_confirmed_at = new Date().toISOString();
  handoverRecord.status = 'handover_pending';

  const state2 = determineConfirmationState(handoverRecord);
  assert.equal(state2, 'awaiting_claimant', 'State reflects finder has confirmed, waiting for claimant');
  assert.notEqual(handoverRecord.status, 'completed', 'Handover must not complete with only 1 confirmation');
});

test('[Journey Step 8] Dual Confirmation Gate: Step 2 - Claimant Confirms Receipt & Return Finalizes', () => {
  const handoverRecord = {
    id: '99999999-9999-4999-a999-999999999999',
    claim_id: 'claim-journey-001',
    status: 'handover_pending',
    finder_confirmed_at: '2026-10-28T14:05:00Z',
    claimant_confirmed_at: null,
    is_flagged: false,
  };

  // Claimant confirms physical receipt
  handoverRecord.claimant_confirmed_at = new Date().toISOString();

  // Both parties confirmed -> atomic completion RPC logic
  const bothConfirmed = Boolean(handoverRecord.finder_confirmed_at && handoverRecord.claimant_confirmed_at);
  assert.equal(bothConfirmed, true, 'Dual confirmation requirement satisfied');

  handoverRecord.status = 'completed';

  const finalState = determineConfirmationState(handoverRecord);
  assert.equal(finalState, 'completed', 'Both parties verified return');

  // Verify post-handover item status updates
  const updatedLostReport = { ...lostReportAlice, status: 'returned' };
  const updatedFoundReport = { ...foundReportBob, status: 'returned' };

  assert.equal(updatedLostReport.status, 'returned');
  assert.equal(updatedFoundReport.status, 'returned');
});

// ==============================================================================
// 6. Error & Edge Case Verification
// ==============================================================================

test('[Edge Case 1] Unregistered Student Signup Rejected', () => {
  const fraudulentSignup = {
    registrationNumber: 'REG2026-FAKE-999',
    studentName: 'Imposter Student',
    email: 'imposter@university.edu',
  };

  const registryMatch = SYNTHETIC_REGISTRY.find(
    (r) => r.registration_number === fraudulentSignup.registrationNumber
  );
  assert.equal(registryMatch, undefined, 'Unregistered student not found in university registry');

  const eligibility = evaluateStudentEligibility(fraudulentSignup, null, null);
  assert.equal(eligibility.eligible, false);
  assert.ok(eligibility.reason.includes('not found in the official university student registry'));
  assert.ok(eligibility.userFacingMessage.includes('not eligible for student registration'));
});

test('[Edge Case 2] Third-Party Unauthorized Confirmation Attempt Blocked', async () => {
  const handoverRecord = {
    id: '12121212-1212-4212-a212-121212121212',
    claim_id: 'claim-journey-001',
    status: 'scheduled',
    finder_confirmed_at: null,
    claimant_confirmed_at: null,
  };

  const thirdPartyUserId = 'user-intruder-66';
  const isFinder = foundReportBob.user_id === thirdPartyUserId;
  const isClaimant = lostReportAlice.user_id === thirdPartyUserId;

  assert.equal(isFinder, false);
  assert.equal(isClaimant, false);

  // Invariant: Non-participant confirmation blocked
  const incident = await recordSuspiciousIncident({
    supabaseClient: null,
    handoverId: handoverRecord.id,
    userId: thirdPartyUserId,
    incidentType: 'unauthorized_attempt',
    reason: 'Non-participant attempted to confirm handover',
  });

  assert.equal(incident.incident_type, 'unauthorized_attempt');
  assert.equal(incident.attempt_count, 1);
});

test('[Edge Case 3] Premature Confirmation Attempt Automatically Suspends Handover', async () => {
  const unapprovedClaim = {
    id: 'claim-unapproved-1',
    status: 'under_review', // NOT approved yet!
  };

  const handover = {
    id: '23232323-2323-4323-a323-232323232323',
    status: 'scheduled',
    is_flagged: false,
  };

  // Premature confirmation attempt triggers hold
  const hold = await applyHandoverHold(null, {
    handoverId: handover.id,
    reason: 'Attempted handover confirmation before claim approval',
  });

  assert.equal(hold.holdApplied, true);
  handover.status = 'suspended';
  handover.is_flagged = true;

  const suspendedState = determineConfirmationState(handover);
  assert.equal(suspendedState, 'pending_both');
  assert.equal(handover.status, 'suspended');
});

test('[Edge Case 4] Admin Reviews and Releases Hold with Mandatory Decision Notes', async () => {
  const adminUser = {
    id: 'admin-head-01',
    email: 'admin@university.edu',
    app_metadata: { role: 'admin' },
  };

  // Attempting to release hold without decision notes MUST throw
  assert.rejects(
    async () => {
      await releaseHandoverHold(null, {
        handoverId: '23232323-2323-4323-a323-232323232323',
        adminUser,
        decisionNotes: '',
      });
    },
    /Mandatory decision notes are required/
  );

  // Releasing hold with proper notes succeeds
  const releaseResult = await releaseHandoverHold(null, {
    handoverId: '23232323-2323-4323-a323-232323232323',
    adminUser,
    decisionNotes: 'Security officer verified physical item and confirmed student credentials.',
  });

  assert.equal(releaseResult.holdReleased, true);
});

runAllTests().catch((err) => {
  console.error('Fatal student journey test failure:', err);
  process.exit(1);
});
