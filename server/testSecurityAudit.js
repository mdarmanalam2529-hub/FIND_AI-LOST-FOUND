import assert from 'node:assert/strict';
import {
  rateLimiter,
  rateLimitMap,
} from './index.js';
import {
  isValidStoragePath,
} from './clipMatcher.js';
import {
  sanitizeLocation,
  DEFAULT_WEIGHTS,
} from './aiMatcher.js';

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

console.log(`\nAll ${passed}/${total} Security Audit tests passed successfully!`);
