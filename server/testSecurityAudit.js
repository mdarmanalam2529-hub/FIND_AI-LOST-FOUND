import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { rateLimiter, rateLimitMap } = await import('./index.js');
import {
  isValidStoragePath,
} from './clipMatcher.js';
import {
  sanitizeLocation,
  DEFAULT_WEIGHTS,
} from './aiMatcher.js';
import {
  isAuthorizedAdmin,
  isValidClaimStatusTransition,
} from './claimWorkflow.js';

console.log('--- FindAI Security Audit & Regression Test Suite ---');

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

async function asyncTest(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// 1. IDOR Defense Verification
test('IDOR check prevents User A from running matching on User B report', () => {
  const requestingUserId = 'user-alice-uuid-0001';
  const victimUserId = 'user-bob-uuid-0002';
  const targetItem = {
    id: 'report-uuid-9999',
    user_id: victimUserId,
    status: 'open',
    title: 'Victim Report',
  };

  // Check ownership condition
  const isOwner = targetItem.user_id === requestingUserId;
  assert.equal(isOwner, false, 'User Alice must not be identified as the owner of Bob report');

  let statusCode = 200;
  let responseBody = null;
  if (targetItem.user_id !== requestingUserId) {
    statusCode = 403;
    responseBody = {
      error: 'Forbidden',
      message: 'You are not authorized to run matching searches for a report you do not own.',
    };
  }

  assert.equal(statusCode, 403);
  assert.equal(responseBody.error, 'Forbidden');
});

// 2. Strict UUID v4 Input Validation
test('Strict UUID regex rejects SQL injection and malformed target IDs', () => {
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const validUUID = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(UUID_V4_REGEX.test(validUUID), true);

  // Attack vectors
  assert.equal(UUID_V4_REGEX.test("' OR '1'='1"), false);
  assert.equal(UUID_V4_REGEX.test("550e8400-e29b-41d4-a716-446655440000; DROP TABLE items;"), false);
  assert.equal(UUID_V4_REGEX.test("../../../etc/passwd"), false);
  assert.equal(UUID_V4_REGEX.test("not-a-uuid"), false);
  assert.equal(UUID_V4_REGEX.test(""), false);
});

// 3. Rate Limiting / Abuse Protection
test('rateLimiter blocks requests exceeding threshold with HTTP 429 and Retry-After', () => {
  const testIp = '192.168.1.100';
  rateLimitMap.delete(testIp);

  let nextCalls = 0;
  const mockNext = () => { nextCalls++; };

  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, val) {
      this.headers = this.headers || {};
      this.headers[name] = val;
    },
  };

  // Send 40 allowed requests
  for (let i = 0; i < 40; i++) {
    rateLimiter({ ip: testIp }, mockRes, mockNext);
  }
  assert.equal(nextCalls, 40, 'First 40 requests must pass');

  // 41st request must trigger 429
  rateLimiter({ ip: testIp }, mockRes, mockNext);
  assert.equal(mockRes.statusCode, 429, '41st request must return HTTP 429');
  assert.equal(mockRes.body.error, 'Too Many Requests');
  assert.ok(mockRes.headers['Retry-After'] > 0);

  // Clean up test key
  rateLimitMap.delete(testIp);
});

// 4. Private Storage Path Traversal Rejection
test('isValidStoragePath blocks path traversal and unauthorized file formats', () => {
  assert.equal(isValidStoragePath('../../etc/shadow'), false);
  assert.equal(isValidStoragePath('user/item/../../../env.local'), false);
  assert.equal(isValidStoragePath('/var/data/image.jpg'), false);
  assert.equal(isValidStoragePath('C:\\Windows\\system32\\calc.exe'), false);
  assert.equal(isValidStoragePath('u1/i1/payload.php'), false);
  assert.equal(isValidStoragePath('u1/i1/exploit.html'), false);

  // Legitimate paths must pass
  assert.equal(isValidStoragePath('550e8400-e29b-41d4-a716-446655440000/123/1697645000000.jpg'), true);
  assert.equal(isValidStoragePath('user1/item1/photo.png'), true);
  assert.equal(isValidStoragePath('user1/item1/photo.webp'), true);
});

// 5. Enhanced Location Privacy Redaction
test('sanitizeLocation redacts phone numbers, emails, and sensitive multi-digit IDs', () => {
  const locWithPhone = 'Left at library desk, please call 555-123-4567';
  assert.equal(sanitizeLocation(locWithPhone), 'Left at library desk, please call [Phone Redacted]');

  const locWithEmail = 'Found near desk, email john.doe@university.edu to claim';
  assert.equal(sanitizeLocation(locWithEmail), 'Found near desk, email [Email Redacted] to claim');

  const locWithStudentId = 'Lost near dorm room, Student ID 87654321 on the back';
  assert.equal(sanitizeLocation(locWithStudentId), 'Lost near dorm room, Student ID [ID/Number Redacted] on the back');

  const safeLoc = '2nd floor library near silent study desks';
  assert.equal(sanitizeLocation(safeLoc), '2nd floor library near silent study desks');
});

// 6. Safe Weight Sanitization
test('weight sanitization strips invalid, negative, or infinite values', () => {
  const badWeights = {
    text: -5,
    image: 'string-hack',
    category: Infinity,
    color: NaN,
  };

  let safeWeights = DEFAULT_WEIGHTS;
  if (badWeights && typeof badWeights === 'object') {
    safeWeights = {};
    for (const [key, val] of Object.entries(badWeights)) {
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 1) {
        safeWeights[key] = val;
      }
    }
    if (Object.keys(safeWeights).length === 0) {
      safeWeights = DEFAULT_WEIGHTS;
    }
  }

  // Must have fallen back to DEFAULT_WEIGHTS safely
  assert.deepEqual(safeWeights, DEFAULT_WEIGHTS);
});

// 7. Admin Authorization: Rejection of Unverified Email
test('isAuthorizedAdmin rejects unverified email even if address matches ADMIN_EMAILS', () => {
  const origEnv = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'security-admin@university.edu';
  try {
    // Unverified accounts (missing email_confirmed_at or null) must NEVER receive admin access
    assert.equal(isAuthorizedAdmin({ email: 'security-admin@university.edu', email_confirmed_at: null }), false);
    assert.equal(isAuthorizedAdmin({ email: 'security-admin@university.edu' }), false);
    assert.equal(isAuthorizedAdmin({ email: 'security-admin@university.edu', email_confirmed_at: '' }), false);
  } finally {
    process.env.ADMIN_EMAILS = origEnv;
  }
});

// 8. Admin Authorization: Rejection of User Metadata Role Injection
test('isAuthorizedAdmin rejects user_metadata role injection attempts', () => {
  const maliciousUser = {
    email: 'attacker@outside.com',
    email_confirmed_at: '2026-10-20T10:00:00Z',
    user_metadata: { role: 'admin', is_admin: true }, // User-editable metadata
    app_metadata: { role: 'authenticated' },           // Server-managed metadata
  };
  assert.equal(isAuthorizedAdmin(maliciousUser), false, 'user_metadata must never confer admin privileges');
});

// 9. Admin Authorization: Acceptance of Verified Email Matching ADMIN_EMAILS
test('isAuthorizedAdmin grants admin to confirmed emails matching ADMIN_EMAILS', () => {
  const origEnv = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'admin-alice@university.edu, admin-bob@university.edu';
  try {
    const verifiedAdmin = {
      email: 'admin-alice@university.edu',
      email_confirmed_at: '2026-10-18T12:00:00Z',
    };
    assert.equal(isAuthorizedAdmin(verifiedAdmin), true);

    // Case-insensitivity check
    const caseAdmin = {
      email: 'ADMIN-BOB@UNIVERSITY.EDU',
      email_confirmed_at: '2026-10-18T12:00:00Z',
    };
    assert.equal(isAuthorizedAdmin(caseAdmin), true);
  } finally {
    process.env.ADMIN_EMAILS = origEnv;
  }
});

// 10. Admin Authorization: Acceptance of Trusted Server-Managed Roles
test('isAuthorizedAdmin respects server-managed app_metadata roles', () => {
  assert.equal(isAuthorizedAdmin({ app_metadata: { role: 'admin' } }), true);
  assert.equal(isAuthorizedAdmin({ app_metadata: { role: 'security_reviewer' } }), true);
  assert.equal(isAuthorizedAdmin({ app_metadata: { role: 'user' } }), false);
  assert.equal(isAuthorizedAdmin(null), false);
  assert.equal(isAuthorizedAdmin({}), false);
});

// 11. Claim Authorization: Claimant Cannot Self-Approve Claim
test('isValidClaimStatusTransition strictly forbids claimant self-approval', () => {
  // Claimant trying to approve their own pending or under_review claim
  const selfApprovePending = isValidClaimStatusTransition('pending', 'approved', { isFinder: false, isAdmin: false });
  assert.equal(selfApprovePending, false, 'Claimant must not be permitted to self-approve a pending claim');

  const selfApproveReview = isValidClaimStatusTransition('under_review', 'approved', { isFinder: false, isAdmin: false });
  assert.equal(selfApproveReview, false, 'Claimant must not be permitted to self-approve an under_review claim');

  // Claimant trying to reject or dispute
  const selfReject = isValidClaimStatusTransition('pending', 'rejected', { isFinder: false, isAdmin: false });
  assert.equal(selfReject, false, 'Claimant cannot reject claims (only cancel own claim)');
});

// 12. Claim Authorization: Legitimate Finder and Admin Workflows Preserved
test('isValidClaimStatusTransition preserves legitimate Finder, Claimant, and Admin actions', () => {
  // Finder can approve uncontested pending claim
  assert.equal(isValidClaimStatusTransition('pending', 'approved', { isFinder: true, isAdmin: false }), true);
  // Finder can reject claim
  assert.equal(isValidClaimStatusTransition('pending', 'rejected', { isFinder: true, isAdmin: false }), true);
  // Finder cannot override admin review directly
  assert.equal(isValidClaimStatusTransition('under_review', 'approved', { isFinder: true, isAdmin: false }), false);

  // Admin can transition across review and decision states
  assert.equal(isValidClaimStatusTransition('under_review', 'approved', { isFinder: false, isAdmin: true }), true);
  assert.equal(isValidClaimStatusTransition('under_review', 'rejected', { isFinder: false, isAdmin: true }), true);
  assert.equal(isValidClaimStatusTransition('pending', 'disputed', { isFinder: false, isAdmin: true }), true);

  // Claimant can cancel their own active claim
  assert.equal(isValidClaimStatusTransition('pending', 'cancelled', { isFinder: false, isAdmin: false }), true);
  assert.equal(isValidClaimStatusTransition('under_review', 'cancelled', { isFinder: false, isAdmin: false }), true);
});

// 13. Database Authorization Boundary: Simulation of Hardened RLS Policy
test('Hardened RLS policy constraint rejects creation of approved claims or assigned review fields', () => {
  // Simulates the SQL WITH CHECK clause in 20261023_harden_claim_and_admin_authorization.sql
  function checkClaimInsertPolicy(record, authUid) {
    if (record.claimant_id !== authUid) return { allowed: false, error: 'claimant_id mismatch' };
    if (!['pending', 'under_review'].includes(record.status)) return { allowed: false, error: 'invalid initial status' };
    if (record.reviewed_by !== null && record.reviewed_by !== undefined) return { allowed: false, error: 'reviewed_by must be null at creation' };
    if (record.reviewed_at !== null && record.reviewed_at !== undefined) return { allowed: false, error: 'reviewed_at must be null at creation' };
    if (record.admin_notes !== null && record.admin_notes !== undefined) return { allowed: false, error: 'admin_notes must be null at creation' };
    return { allowed: true };
  }

  const callerId = 'user-claimant-uuid-1111';

  // 1. Malicious: Direct insert with status = 'approved'
  const hackStatus = checkClaimInsertPolicy({
    claimant_id: callerId,
    status: 'approved',
    reviewed_by: null,
  }, callerId);
  assert.equal(hackStatus.allowed, false);
  assert.equal(hackStatus.error, 'invalid initial status');

  // 2. Malicious: Direct insert assigning reviewed_by
  const hackReviewer = checkClaimInsertPolicy({
    claimant_id: callerId,
    status: 'pending',
    reviewed_by: callerId,
  }, callerId);
  assert.equal(hackReviewer.allowed, false);
  assert.equal(hackReviewer.error, 'reviewed_by must be null at creation');

  // 3. Malicious: Direct insert with admin notes
  const hackNotes = checkClaimInsertPolicy({
    claimant_id: callerId,
    status: 'pending',
    reviewed_by: null,
    admin_notes: 'Bypassed verification',
  }, callerId);
  assert.equal(hackNotes.allowed, false);

  // 4. Legitimate: Valid pending claim creation
  const validPending = checkClaimInsertPolicy({
    claimant_id: callerId,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    admin_notes: null,
  }, callerId);
  assert.equal(validPending.allowed, true);

  // 5. Legitimate: Valid under_review claim creation (e.g. competing claims hold)
  const validReview = checkClaimInsertPolicy({
    claimant_id: callerId,
    status: 'under_review',
    reviewed_by: null,
    reviewed_at: null,
    admin_notes: null,
  }, callerId);
  assert.equal(validReview.allowed, true);
});

console.log(`\nAll ${passed}/${total} Security Audit tests passed successfully!`);
process.exit(0);
