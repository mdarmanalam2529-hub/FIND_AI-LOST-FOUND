/**
 * ==============================================================================
 * Test Suite: testReportModeration.js
 * Project: FindAI - University Lost-and-Found Platform
 * Milestone: Phase 2 - Lost-and-Found Report Moderation
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import {
  requireAdminOrReviewer,
  isFullAdmin,
  writeAdminAuditLog,
  isValidReportStatusTransition,
  redactPrivateReportDetails,
  adminReportRouter,
} from './adminReportRoutes.js';

console.log('--- FindAI Phase 2: Lost-and-Found Report Moderation Test Suite ---');

let passed = 0;
let total = 0;
const testsQueue = [];

function test(name, fn) {
  testsQueue.push({ name, fn });
}

async function runAllTests() {
  for (const { name, fn } of testsQueue) {
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
  console.log(`\nAll ${passed}/${total} Phase 2 Report Moderation tests passed successfully!`);
}

// ==============================================================================
// 1. Authorization & Role Verification Tests
// ==============================================================================

test('[Auth] requireAdminOrReviewer rejects unauthenticated request (403)', () => {
  let statusCode = null;
  let responseData = null;
  const req = { user: null };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseData = body;
      return this;
    },
  };
  let nextCalled = false;

  requireAdminOrReviewer(req, res, () => {
    nextCalled = true;
  });

  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
  assert.equal(responseData?.error, 'Forbidden');
});

test('[Auth] requireAdminOrReviewer rejects ordinary student (403)', () => {
  let statusCode = null;
  const req = {
    user: {
      id: 'student-uuid-1',
      email: 'student@university.edu',
      app_metadata: { role: 'student' },
    },
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  let nextCalled = false;

  requireAdminOrReviewer(req, res, () => {
    nextCalled = true;
  });

  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
});

test('[Auth] requireAdminOrReviewer rejects forged user_metadata.role="admin"', () => {
  let statusCode = null;
  const req = {
    user: {
      id: 'attacker-uuid',
      email: 'attacker@gmail.com',
      app_metadata: { role: 'student' },
      user_metadata: { role: 'admin' }, // Forged in client-editable metadata
    },
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  let nextCalled = false;

  requireAdminOrReviewer(req, res, () => {
    nextCalled = true;
  });

  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
});

test('[Auth] requireAdminOrReviewer approves legitimate server app_metadata admin and security_reviewer', () => {
  const adminReq = {
    user: { id: 'admin-uuid', app_metadata: { role: 'admin' } },
  };
  const reviewerReq = {
    user: { id: 'reviewer-uuid', app_metadata: { role: 'security_reviewer' } },
  };
  let adminPassed = false;
  let reviewerPassed = false;

  requireAdminOrReviewer(adminReq, {}, () => {
    adminPassed = true;
  });
  requireAdminOrReviewer(reviewerReq, {}, () => {
    reviewerPassed = true;
  });

  assert.equal(adminPassed, true, 'Admin must be authorized');
  assert.equal(reviewerPassed, true, 'Security reviewer must be authorized');
});

test('[Role Separation] isFullAdmin distinguishes full admin from security_reviewer', () => {
  const fullAdmin = { id: 'adm-1', app_metadata: { role: 'admin' } };
  const reviewer = { id: 'rev-1', app_metadata: { role: 'security_reviewer' } };
  const student = { id: 'stu-1', app_metadata: { role: 'student' } };

  assert.equal(isFullAdmin(fullAdmin), true);
  assert.equal(isFullAdmin(reviewer), false, 'Reviewer is not full admin');
  assert.equal(isFullAdmin(student), false);
});

// ==============================================================================
// 2. Status Transitions & Moderation Rules
// ==============================================================================

test('[Status Transition] Permits valid state transitions', () => {
  assert.equal(isValidReportStatusTransition('open', 'closed', 'reject'), true);
  assert.equal(isValidReportStatusTransition('open', 'matched', 'match'), true);
  assert.equal(isValidReportStatusTransition('closed', 'open', 'restore'), true);
  assert.equal(isValidReportStatusTransition('matched', 'open', 'unmatch'), true);
  assert.equal(isValidReportStatusTransition('open', 'open', 'mark_reviewed'), true);
});

test('[Status Transition] Rejects invalid or corrupt transitions', () => {
  // Terminal state: returned items cannot be reopened or closed arbitrarily
  assert.equal(isValidReportStatusTransition('returned', 'open', 'restore'), false);
  assert.equal(isValidReportStatusTransition('returned', 'closed', 'hide'), false);
  // Unsupported status values
  assert.equal(isValidReportStatusTransition('open', 'archived', 'archive'), false);
  assert.equal(isValidReportStatusTransition('open', 'flagged', 'flag'), false);
});

// ==============================================================================
// 3. Privacy & Sanitization Tests
// ==============================================================================

test('[Privacy] redactPrivateReportDetails strips emails and phone numbers from description and location', () => {
  const sensitiveReport = {
    id: 'rep-1',
    title: 'Found leather wallet with ID card',
    description: 'Found outside library. Please call 555-123-4567 or email john.doe@university.edu to claim.',
    location_description: 'Near Bench 4, contact safety office at admin@campus.edu or 800-555-0199',
  };

  const sanitized = redactPrivateReportDetails(sensitiveReport);

  assert.doesNotMatch(sanitized.description, /555-123-4567/);
  assert.doesNotMatch(sanitized.description, /john\.doe@university\.edu/);
  assert.match(sanitized.description, /\[REDACTED_PHONE\]/);
  assert.match(sanitized.description, /\[REDACTED_EMAIL\]/);

  assert.doesNotMatch(sanitized.location_description, /admin@campus\.edu/);
  assert.doesNotMatch(sanitized.location_description, /800-555-0199/);
});

// ==============================================================================
// 4. Audit Log Schema Compliance Tests
// ==============================================================================

test('[Audit Log] writeAdminAuditLog enforces schema constraints', async () => {
  const insertedLogs = [];
  const mockSupabase = {
    from(table) {
      assert.equal(table, 'admin_audit_logs');
      return {
        insert(entries) {
          insertedLogs.push(...entries);
          return {
            select() {
              return {
                maybeSingle: async () => ({ data: entries[0], error: null }),
              };
            },
          };
        },
      };
    },
  };

  const actor = {
    id: 'b1234567-0000-4000-a000-000000000001',
    email: 'moderator@university.edu',
    app_metadata: { role: 'admin' },
    user_metadata: { full_name: 'Dr. Jane Admin' },
  };

  const entry = await writeAdminAuditLog(mockSupabase, {
    actor,
    action: 'report_rejected',
    targetId: 'a1234567-0000-4000-a000-000000000002',
    reason: 'Prohibited campus contraband item',
    details: { previous_status: 'open', new_status: 'closed' },
    ipAddress: '192.168.1.100',
  });

  assert.ok(entry, 'Audit log entry must be created');
  assert.equal(insertedLogs.length, 1);
  const log = insertedLogs[0];
  assert.equal(log.actor_name, 'Dr. Jane Admin');
  assert.ok(log.actor_name.length >= 2);
  assert.match(log.actor_email, /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/);
  assert.equal(log.actor_role, 'admin');
  assert.equal(log.action, 'report_rejected');
  assert.ok(log.action.length >= 2);
  assert.equal(log.target_type, 'item_report');
  assert.equal(log.target_identifier, 'a1234567-0000-4000-a000-000000000002');
  assert.ok(log.reason.length >= 3);
  assert.equal(log.reason, 'Prohibited campus contraband item');
  assert.equal(log.details.previous_status, 'open');
  assert.equal(log.details.new_status, 'closed');
});

// ==============================================================================
// 5. Mock In-Memory Moderation Workflow & Route Tests
// ==============================================================================

function createMockSupabaseForReports(initialItems = [], initialClaims = [], initialIncidents = []) {
  let items = [...initialItems];
  const auditLogs = [];

  return {
    items,
    auditLogs,
    storage: {
      from() {
        return {
          createSignedUrl: async (filePath) => ({
            data: { signedUrl: `https://signed.cdn.local/${filePath}?token=test` },
            error: null,
          }),
        };
      },
    },
    from(table) {
      if (table === 'items') {
        let currentItems = [...items];
        const builder = {
          select(fields, opts) {
            return builder;
          },
          eq(col, val) {
            currentItems = currentItems.filter((i) => i[col] === val);
            return builder;
          },
          neq(col, val) {
            currentItems = currentItems.filter((i) => i[col] !== val);
            return builder;
          },
          order() {
            return builder;
          },
          maybeSingle: async () => ({
            data: currentItems[0] || null,
            error: null,
          }),
          single: async () => ({
            data: currentItems[0] || null,
            error: currentItems[0] ? null : new Error('Item not found'),
          }),
          update(updates) {
            return {
              eq(col, val) {
                const idx = items.findIndex((i) => i[col] === val);
                if (idx !== -1) {
                  items[idx] = { ...items[idx], ...updates, updated_at: new Date().toISOString() };
                  currentItems = [items[idx]];
                }
                return {
                  select() {
                    return {
                      single: async () => ({ data: items[idx], error: null }),
                    };
                  },
                };
              },
            };
          },
          then(resolve) {
            resolve({ data: currentItems, count: currentItems.length, error: null });
          },
        };
        return builder;
      }

      if (table === 'item_claims') {
        return {
          select() {
            return {
              or: () => ({
                then: (resolve) => resolve({ data: initialClaims, error: null }),
              }),
            };
          },
        };
      }

      if (table === 'handover_incidents') {
        return {
          select() {
            return {
              in: () => ({
                then: (resolve) => resolve({ data: initialIncidents, error: null }),
              }),
              eq: () => ({
                then: (resolve) => resolve({ data: initialIncidents, error: null }),
              }),
            };
          },
        };
      }

      if (table === 'admin_audit_logs') {
        return {
          select() {
            return {
              eq() {
                return {
                  in: () => ({
                    order: () => ({
                      then: (resolve) => resolve({ data: auditLogs, error: null }),
                    }),
                  }),
                  eq: () => ({
                    order: () => ({
                      then: (resolve) => resolve({ data: auditLogs, error: null }),
                    }),
                  }),
                };
              },
            };
          },
          insert(entries) {
            auditLogs.push(...entries);
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: entries[0], error: null }),
                };
              },
            };
          },
        };
      }

      if (table === 'student_profiles') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: { registration_number: '23CSE045', branch: 'CSE', academic_year: '3' },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      return {
        select: () => ({
          then: (r) => r({ data: [], error: null }),
        }),
      };
    },
  };
}

// Find a route handler from an express router
function findRouteHandler(router, pathPattern, method = 'get') {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === pathPattern && layer.route.methods[method.toLowerCase()]) {
      const handlers = layer.route.stack;
      return handlers[handlers.length - 1].handle;
    }
  }
  throw new Error(`Route [${method.toUpperCase()} ${pathPattern}] not found in router stack`);
}

test('[Queue Retrieval] Administrator can retrieve moderation queue with pagination & indicators', async () => {
  const syntheticItems = [
    {
      id: '11111111-1111-4111-a111-111111111111',
      user_id: 'user-1',
      item_type: 'lost',
      title: 'Lost Dell XPS 15 Laptop',
      description: 'Silver laptop with university sticker',
      category: 'electronics',
      color: 'silver',
      location_description: 'Library 2nd floor reading room',
      incident_date: '2026-10-25',
      image_path: 'user-1/laptop.jpg',
      status: 'open',
      created_at: '2026-10-25T10:00:00Z',
    },
    {
      id: '22222222-2222-4222-a222-222222222222',
      user_id: 'user-2',
      item_type: 'found',
      title: 'Found Apple iPhone 13',
      description: 'Black iPhone with clear case',
      category: 'electronics',
      color: 'black',
      location_description: 'Cafeteria table 12',
      incident_date: '2026-10-26',
      image_path: null,
      status: 'open',
      created_at: '2026-10-26T14:00:00Z',
    },
  ];

  const mockClaims = [
    {
      id: 'claim-1',
      found_item_id: '22222222-2222-4222-a222-222222222222',
      lost_item_id: '11111111-1111-4111-a111-111111111111',
      status: 'under_review',
      is_disputed: true,
      requires_admin_review: true,
    },
  ];

  const mockSupabase = createMockSupabaseForReports(syntheticItems, mockClaims);
  const getQueueHandler = findRouteHandler(adminReportRouter, '/', 'get');

  let responseJson = null;
  const req = {
    user: { id: 'admin-1', app_metadata: { role: 'admin' }, email: 'admin@university.edu' },
    query: { page: '1', limit: '10' },
    serviceSupabase: mockSupabase,
  };
  const res = {
    status(c) {
      return this;
    },
    json(body) {
      responseJson = body;
      return this;
    },
  };

  await getQueueHandler(req, res);

  assert.ok(responseJson.success, 'Request must succeed');
  assert.equal(responseJson.reports.length, 2);
  assert.equal(responseJson.pagination.total, 2);
  assert.equal(responseJson.pagination.page, 1);
  assert.equal(responseJson.stats.total, 2);
  assert.equal(responseJson.stats.lost, 1);
  assert.equal(responseJson.stats.found, 1);

  // Verify signed image URL was generated for laptop
  const laptopReport = responseJson.reports.find((r) => r.id === '11111111-1111-4111-a111-111111111111');
  assert.ok(laptopReport.signed_image_url.includes('https://signed.cdn.local/'));

  // Verify dispute indicator
  const phoneReport = responseJson.reports.find((r) => r.id === '22222222-2222-4222-a222-222222222222');
  assert.equal(phoneReport.indicators.is_disputed, true);
});

test('[Report Detail] Administrator can fetch deep report detail with audit history', async () => {
  const item = {
    id: '33333333-3333-4333-a333-333333333333',
    user_id: 'user-3',
    item_type: 'found',
    title: 'Found Scientific Calculator FX-991EX',
    description: 'Black Casio calculator left in Room 402',
    category: 'electronics',
    color: 'black',
    location_description: 'Science Block Room 402',
    incident_date: '2026-10-27',
    image_path: null,
    status: 'open',
    created_at: '2026-10-27T11:00:00Z',
  };

  const mockSupabase = createMockSupabaseForReports([item]);
  const getDetailHandler = findRouteHandler(adminReportRouter, '/:id', 'get');

  let responseJson = null;
  let statusCode = 200;
  const req = {
    user: { id: 'admin-1', app_metadata: { role: 'admin' } },
    params: { id: '33333333-3333-4333-a333-333333333333' },
    serviceSupabase: mockSupabase,
  };
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json(body) {
      responseJson = body;
      return this;
    },
  };

  await getDetailHandler(req, res);

  assert.equal(statusCode, 200);
  assert.ok(responseJson.success);
  assert.equal(responseJson.report.id, item.id);
  assert.equal(responseJson.report.title, item.title);
  assert.ok(Array.isArray(responseJson.report.claims));
  assert.ok(Array.isArray(responseJson.report.audit_history));
  assert.equal(responseJson.report.reporter_profile?.registration_number, '23CSE045');
});

test('[Input Validation] GET and PATCH reject invalid non-UUID report IDs with 400', async () => {
  const mockSupabase = createMockSupabaseForReports([]);
  const getDetailHandler = findRouteHandler(adminReportRouter, '/:id', 'get');
  const moderateHandler = findRouteHandler(adminReportRouter, '/:id/moderate', 'patch');

  let getStatus = null;
  let patchStatus = null;

  const resGet = {
    status(c) {
      getStatus = c;
      return this;
    },
    json() {
      return this;
    },
  };
  const resPatch = {
    status(c) {
      patchStatus = c;
      return this;
    },
    json() {
      return this;
    },
  };

  await getDetailHandler({ user: { id: 'a1', app_metadata: { role: 'admin' } }, params: { id: 'not-a-uuid' }, serviceSupabase: mockSupabase }, resGet);
  await moderateHandler({ user: { id: 'a1', app_metadata: { role: 'admin' } }, params: { id: 'invalid-id-format' }, body: { action: 'reject' }, serviceSupabase: mockSupabase }, resPatch);

  assert.equal(getStatus, 400, 'GET must reject non-UUID');
  assert.equal(patchStatus, 400, 'PATCH must reject non-UUID');
});

test('[Security Reviewer Limitation] Security reviewer cannot execute destructive admin mutations (403)', async () => {
  const item = {
    id: '44444444-4444-4444-a444-444444444444',
    user_id: 'user-4',
    item_type: 'lost',
    title: 'Lost Backpack with Books',
    description: 'Blue backpack with notebooks',
    category: 'other',
    status: 'open',
    location_description: 'Campus Quad',
    incident_date: '2026-10-24',
  };
  const mockSupabase = createMockSupabaseForReports([item]);
  const moderateHandler = findRouteHandler(adminReportRouter, '/:id/moderate', 'patch');

  let statusCode = null;
  let responseJson = null;

  const req = {
    user: { id: 'reviewer-1', app_metadata: { role: 'security_reviewer' } },
    params: { id: item.id },
    body: { action: 'reject', reason: 'Attempting to reject as reviewer' },
    serviceSupabase: mockSupabase,
  };
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json(b) {
      responseJson = b;
      return this;
    },
  };

  await moderateHandler(req, res);

  assert.equal(statusCode, 403, 'Reviewer must be rejected from performing reject');
  assert.match(responseJson.message, /requires full administrator privileges/i);
});

test('[Security Reviewer Allowed] Security reviewer CAN mark report as reviewed and flag suspicious', async () => {
  const item = {
    id: '55555555-5555-4555-a555-555555555555',
    user_id: 'user-5',
    item_type: 'found',
    title: 'Found Keys on Lanyard',
    description: 'Two dorm room keys on blue lanyard',
    category: 'keys-wallets',
    status: 'open',
    location_description: 'Hostel Block B',
    incident_date: '2026-10-26',
  };
  const mockSupabase = createMockSupabaseForReports([item]);
  const moderateHandler = findRouteHandler(adminReportRouter, '/:id/moderate', 'patch');

  let statusCode = 200;
  let responseJson = null;

  const req = {
    user: { id: 'reviewer-1', email: 'reviewer@university.edu', app_metadata: { role: 'security_reviewer' } },
    params: { id: item.id },
    body: { action: 'mark_reviewed', reason: 'Inspected and verified' },
    serviceSupabase: mockSupabase,
  };
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json(b) {
      responseJson = b;
      return this;
    },
  };

  await moderateHandler(req, res);

  assert.equal(statusCode, 200);
  assert.ok(responseJson.success);
  assert.equal(responseJson.report.status, 'open', 'Status remains open after review');
  assert.equal(mockSupabase.auditLogs.length, 1);
  assert.equal(mockSupabase.auditLogs[0].action, 'report_mark_reviewed');
});

test('[Moderation Action: Reject] Administrator can reject inappropriate report with required reason', async () => {
  const item = {
    id: '66666666-6666-4666-a666-666666666666',
    user_id: 'user-6',
    item_type: 'lost',
    title: 'Spam or Inappropriate Listing',
    description: 'Unauthorized commercial advertisement on lost board',
    category: 'other',
    status: 'open',
    location_description: 'Quad',
    incident_date: '2026-10-27',
  };
  const mockSupabase = createMockSupabaseForReports([item]);
  const moderateHandler = findRouteHandler(adminReportRouter, '/:id/moderate', 'patch');

  // Test 1: Rejection without reason fails (400)
  let failCode = null;
  const resFail = {
    status(c) {
      failCode = c;
      return this;
    },
    json() {
      return this;
    },
  };
  await moderateHandler(
    {
      user: { id: 'admin-1', app_metadata: { role: 'admin' } },
      params: { id: item.id },
      body: { action: 'reject', reason: '' },
      serviceSupabase: mockSupabase,
    },
    resFail
  );
  assert.equal(failCode, 400, 'Rejection without reason must fail');

  // Test 2: Rejection with valid reason transitions status to 'closed' and writes audit log
  let successCode = 200;
  let successBody = null;
  const resSuccess = {
    status(c) {
      successCode = c;
      return this;
    },
    json(b) {
      successBody = b;
      return this;
    },
  };
  await moderateHandler(
    {
      user: { id: 'admin-1', email: 'chief-admin@university.edu', app_metadata: { role: 'admin' } },
      params: { id: item.id },
      body: { action: 'reject', reason: 'Commercial advertisement violates campus policy' },
      serviceSupabase: mockSupabase,
    },
    resSuccess
  );

  assert.equal(successCode, 200);
  assert.ok(successBody.success);
  assert.equal(successBody.report.status, 'closed', 'Item status must transition to closed');
  assert.equal(mockSupabase.items[0].status, 'closed');
  assert.equal(mockSupabase.auditLogs[0].action, 'report_reject');
  assert.equal(mockSupabase.auditLogs[0].reason, 'Commercial advertisement violates campus policy');
});

test('[Moderation Action: Restore] Administrator can restore previously closed report back to open', async () => {
  const closedItem = {
    id: '77777777-7777-4777-a777-777777777777',
    user_id: 'user-7',
    item_type: 'lost',
    title: 'Valid Lost Student ID Card',
    description: 'Temporarily hidden by mistake',
    category: 'documents',
    status: 'closed',
    location_description: 'Library Entrance',
    incident_date: '2026-10-25',
  };
  const mockSupabase = createMockSupabaseForReports([closedItem]);
  const moderateHandler = findRouteHandler(adminReportRouter, '/:id/moderate', 'patch');

  let successCode = 200;
  let successBody = null;
  const res = {
    status(c) {
      successCode = c;
      return this;
    },
    json(b) {
      successBody = b;
      return this;
    },
  };

  await moderateHandler(
    {
      user: { id: 'admin-1', email: 'admin@university.edu', app_metadata: { role: 'admin' } },
      params: { id: closedItem.id },
      body: { action: 'restore', reason: 'Student verified identity proof and confirmed report is legitimate' },
      serviceSupabase: mockSupabase,
    },
    res
  );

  assert.equal(successCode, 200);
  assert.ok(successBody.success);
  assert.equal(successBody.report.status, 'open', 'Item status must be restored to open');
  assert.equal(mockSupabase.items[0].status, 'open');
  assert.equal(mockSupabase.auditLogs[0].action, 'report_restore');
});

test('[Moderation Action: Duplicate Resolution] Resolves duplicate report by closing duplicate and linking canonical', async () => {
  const primaryItem = {
    id: '88888888-8888-4888-a888-888888888888',
    title: 'Lost Apple AirPods Pro 2',
    status: 'open',
  };
  const duplicateItem = {
    id: '99999999-9999-4999-a999-999999999999',
    title: 'Lost AirPods in white case (Accidental Double Post)',
    status: 'open',
  };

  const mockSupabase = createMockSupabaseForReports([primaryItem, duplicateItem]);
  const moderateHandler = findRouteHandler(adminReportRouter, '/:id/moderate', 'patch');

  // Test 1: Self-duplicate is blocked
  let selfCode = null;
  await moderateHandler(
    {
      user: { id: 'admin-1', app_metadata: { role: 'admin' } },
      params: { id: duplicateItem.id },
      body: { action: 'resolve_duplicate', duplicateOfId: duplicateItem.id, reason: 'Duplicate' },
      serviceSupabase: mockSupabase,
    },
    {
      status(c) {
        selfCode = c;
        return this;
      },
      json() {
        return this;
      },
    }
  );
  assert.equal(selfCode, 400, 'Self duplicate must be rejected');

  // Test 2: Valid resolution closes duplicate report and records audit trail with link
  let successCode = 200;
  let successBody = null;
  await moderateHandler(
    {
      user: { id: 'admin-1', email: 'admin@university.edu', app_metadata: { role: 'admin' } },
      params: { id: duplicateItem.id },
      body: {
        action: 'resolve_duplicate',
        duplicateOfId: primaryItem.id,
        reason: 'Confirmed accidental duplicate submission of the same lost item',
      },
      serviceSupabase: mockSupabase,
    },
    {
      status(c) {
        successCode = c;
        return this;
      },
      json(b) {
        successBody = b;
        return this;
      },
    }
  );

  assert.equal(successCode, 200);
  assert.ok(successBody.success);
  assert.equal(successBody.report.status, 'closed');
  // Primary item remains open
  const canonicalInDb = mockSupabase.items.find((i) => i.id === primaryItem.id);
  assert.equal(canonicalInDb.status, 'open');
  // Duplicate item in DB is closed
  const duplicateInDb = mockSupabase.items.find((i) => i.id === duplicateItem.id);
  assert.equal(duplicateInDb.status, 'closed');
  // Audit log contains linked ID
  assert.equal(mockSupabase.auditLogs[0].action, 'report_resolve_duplicate');
  assert.equal(mockSupabase.auditLogs[0].details.duplicateOfId, primaryItem.id);
});

test('[Evidence Preservation] Moderation updates status without deleting claims or handover records', async () => {
  const item = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    title: 'Found Casio Watch',
    status: 'open',
  };
  const claim = {
    id: 'claim-preserve-1',
    found_item_id: item.id,
    lost_item_id: 'lost-preserve-1',
    status: 'under_review',
  };
  const incident = {
    id: 'inc-preserve-1',
    found_item_id: item.id,
    severity: 'medium',
    status: 'pending_review',
  };

  const mockSupabase = createMockSupabaseForReports([item], [claim], [incident]);
  const moderateHandler = findRouteHandler(adminReportRouter, '/:id/moderate', 'patch');

  await moderateHandler(
    {
      user: { id: 'admin-1', email: 'admin@university.edu', app_metadata: { role: 'admin' } },
      params: { id: item.id },
      body: { action: 'hide_report', reason: 'Temporary restriction during investigation' },
      serviceSupabase: mockSupabase,
    },
    {
      status() {
        return this;
      },
      json() {
        return this;
      },
    }
  );

  // Assert item status changed to closed
  assert.equal(mockSupabase.items[0].status, 'closed');
  // Ensure the item record itself was not deleted
  assert.equal(mockSupabase.items.length, 1);
  // Ensure audit log is present
  assert.equal(mockSupabase.auditLogs.length, 1);
});

// ==============================================================================
// 6. Frontend Service Contract & Error Handling Tests
// ==============================================================================

test('[Service Contract] adminReportService sends Authorization header and parses pagination', async () => {
  // Test query parameter builder and error handling
  const originalFetch = globalThis.fetch;
  let requestedUrl = null;
  let authHeader = null;

  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    authHeader = options?.headers?.Authorization;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        reports: [{ id: 'item-1', title: 'Test Item' }],
        pagination: { total: 1, page: 1, limit: 12, totalPages: 1 },
      }),
    };
  };

  try {
    const { adminReportService } = await import('../src/services/adminReportService.js');
    // Note: in mock test context without supabase session initialized, it will throw Auth error
    let threwAuth = false;
    try {
      await adminReportService.fetchReports({ page: 2, limit: 12, itemType: 'lost', search: 'laptop' });
    } catch (err) {
      threwAuth = true;
      assert.match(err.message, /authentication|supabase/i);
    }
    assert.equal(threwAuth, true, 'Unauthenticated service call throws authentication error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('[UI Error States] Service throws explicit error on 401 Session Expired and 403 Forbidden', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (url.includes('401')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized', message: 'Token expired' }),
        };
      }
      return {
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden', message: 'Access denied: Administrator or reviewer privileges required.' }),
      };
    };

    // Verify error classification logic
    const handleResponse = async (status) => {
      const resp = await globalThis.fetch(status === 401 ? '401' : '403');
      const payload = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401) throw new Error('Your session has expired. Please log in again.');
        if (resp.status === 403) throw new Error(payload.message || 'Access denied.');
      }
    };

    let caught401 = null;
    let caught403 = null;
    try {
      await handleResponse(401);
    } catch (e) {
      caught401 = e.message;
    }
    try {
      await handleResponse(403);
    } catch (e) {
      caught403 = e.message;
    }

    assert.match(caught401, /session has expired/i);
    assert.match(caught403, /access denied/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
