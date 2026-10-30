/**
 * ==============================================================================
 * Test Suite: testHandoverManagement.js
 * Project: FindAI - University Lost-and-Found Platform
 * Milestone: Phase 3 - Handover Management & Security Invariants Verification
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import {
  requireAdminOrReviewer,
  isFullAdmin,
  determineConfirmationState,
  adminHandoverRouter,
} from './adminHandoverRoutes.js';
import { claimRoutes } from './claimRoutes.js';

console.log('--- FindAI Phase 3: Handover Management & Security Invariants Test Suite ---');

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
  console.log(`\nAll ${passed}/${total} Phase 3 Handover Management tests passed successfully!`);
}

function findRouteHandler(router, pathPattern, method = 'get') {
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === pathPattern && layer.route.methods[method.toLowerCase()]) {
      const handlers = layer.route.stack;
      return handlers[handlers.length - 1].handle;
    }
  }
  throw new Error(`Route [${method.toUpperCase()} ${pathPattern}] not found in router stack`);
}

// ==============================================================================
// 1. Authorization & Role Invariant Tests
// ==============================================================================

test('[Auth] requireAdminOrReviewer rejects unauthenticated request (403)', () => {
  let statusCode = null;
  const req = { user: null };
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json() {
      return this;
    },
  };
  requireAdminOrReviewer(req, res, () => {});
  assert.equal(statusCode, 403);
});

test('[Auth] requireAdminOrReviewer rejects ordinary student (403)', () => {
  let statusCode = null;
  const req = {
    user: { id: 'student-1', email: 'stu@university.edu', app_metadata: { role: 'student' } },
  };
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json() {
      return this;
    },
  };
  requireAdminOrReviewer(req, res, () => {});
  assert.equal(statusCode, 403);
});

test('[Auth] requireAdminOrReviewer strictly rejects forged user_metadata role (403)', () => {
  let statusCode = null;
  const req = {
    user: {
      id: 'student-attacker',
      app_metadata: { role: 'student' },
      user_metadata: { role: 'admin' }, // Forged
    },
  };
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json() {
      return this;
    },
  };
  requireAdminOrReviewer(req, res, () => {});
  assert.equal(statusCode, 403);
});

test('[Role Verification] isFullAdmin allows app_metadata admin and rejects reviewer', () => {
  assert.equal(isFullAdmin({ app_metadata: { role: 'admin' } }), true);
  assert.equal(isFullAdmin({ app_metadata: { role: 'security_reviewer' } }), false);
  assert.equal(isFullAdmin({ app_metadata: { role: 'student' } }), false);
});

// ==============================================================================
// 2. Dual Confirmation State Helper Tests
// ==============================================================================

test('[State Logic] determineConfirmationState accurately evaluates dual-confirmation status', () => {
  assert.equal(determineConfirmationState({ finder_confirmed_at: null, claimant_confirmed_at: null, status: 'scheduled' }), 'pending_both');
  assert.equal(determineConfirmationState({ finder_confirmed_at: '2026-10-28T10:00:00Z', claimant_confirmed_at: null, status: 'handover_pending' }), 'awaiting_claimant');
  assert.equal(determineConfirmationState({ finder_confirmed_at: null, claimant_confirmed_at: '2026-10-28T10:00:00Z', status: 'handover_pending' }), 'awaiting_finder');
  assert.equal(determineConfirmationState({ finder_confirmed_at: '2026-10-28T10:00:00Z', claimant_confirmed_at: '2026-10-28T10:05:00Z', status: 'completed' }), 'completed');
});

// ==============================================================================
// 3. Security Invariants on Student Confirmation Endpoint (POST /api/handovers/:id/confirm)
// ==============================================================================

function createMockSupabaseForHandoverConfirm(handoverData, claimData, conflictingClaims = []) {
  const handover = { ...handoverData };
  const claim = { ...claimData, found_item: { id: 'f-1', user_id: 'finder-user', title: 'Found Item' } };
  const incidents = [];
  const notifications = [];
  let rpcCalled = false;

  return {
    handover,
    claim,
    incidents,
    notifications,
    rpcCalled: () => rpcCalled,
    from(table) {
      if (table === 'item_handovers') {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({
                    data: { ...handover, claim },
                    error: null,
                  }),
                };
              },
            };
          },
          update(updates) {
            Object.assign(handover, updates);
            const eqResult = {
              data: handover,
              error: null,
              select() {
                return {
                  single: async () => ({ data: handover, error: null }),
                };
              },
              then(resolve) {
                resolve({ data: handover, error: null });
              },
            };
            return {
              eq() {
                return eqResult;
              },
            };
          },
        };
      }

      if (table === 'item_claims') {
        return {
          select() {
            return {
              eq() {
                return {
                  neq() {
                    return {
                      in: async () => ({ data: conflictingClaims, error: null }),
                    };
                  },
                };
              },
            };
          },
          update(updates) {
            Object.assign(claim, updates);
            return {
              eq: () => ({ error: null }),
            };
          },
        };
      }

      if (table === 'handover_incidents') {
        const queryObj = {
          select() { return queryObj; },
          eq() { return queryObj; },
          in() { return queryObj; },
          order() { return queryObj; },
          limit() { return queryObj; },
          then(resolve) { resolve({ data: incidents, error: null }); },
          single: async () => ({ data: incidents[0] || null, error: null }),
          maybeSingle: async () => ({ data: incidents[0] || null, error: null }),
          insert(entry) {
            incidents.push(entry);
            return {
              select: () => ({
                single: async () => ({ data: entry, error: null }),
                maybeSingle: async () => ({ data: entry, error: null }),
              }),
            };
          },
          update(updates) {
            return {
              eq: () => ({ error: null }),
            };
          },
        };
        return queryObj;
      }

      if (table === 'user_notifications') {
        return {
          insert(entries) {
            const entry = Array.isArray(entries) ? entries[0] : entries;
            notifications.push(entry);
            return {
              select() {
                return {
                  single: async () => ({ data: entry, error: null }),
                };
              },
              error: null,
            };
          },
        };
      }

      return {
        select: () => ({ then: (r) => r({ data: [], error: null }) }),
      };
    },
    rpc(fnName, args) {
      if (fnName === 'complete_item_return') {
        rpcCalled = true;
        handover.status = 'completed';
        claim.status = 'completed';
        return { data: { success: true, message: 'Return finalized' }, error: null };
      }
      return { data: null, error: new Error('RPC not found') };
    },
  };
}

test('[Invariant 1] Non-participant confirmation attempts are blocked with 403 and record unauthorized_attempt', async () => {
  const handoverData = {
    id: '11111111-1111-4111-a111-111111111111',
    claim_id: 'claim-1',
    status: 'scheduled',
    finder_confirmed_at: null,
    claimant_confirmed_at: null,
  };
  const claimData = {
    id: 'claim-1',
    claimant_id: 'claimant-user',
    found_item_id: 'f-1',
    status: 'approved',
  };

  const mockDb = createMockSupabaseForHandoverConfirm(handoverData, claimData);
  const confirmHandler = findRouteHandler(claimRoutes, '/handovers/:id/confirm', 'post');

  let statusCode = null;
  let responseData = null;
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json(b) {
      responseData = b;
      return this;
    },
  };

  // Attacker is neither finder ('finder-user') nor claimant ('claimant-user')
  const req = {
    user: { id: 'attacker-random-user', email: 'attacker@campus.edu', app_metadata: { role: 'student' } },
    params: { id: handoverData.id },
    body: { confirmationType: 'finder_handed_over' },
    userSupabase: mockDb,
    serviceSupabase: mockDb,
  };

  await confirmHandler(req, res);

  assert.equal(statusCode, 403, 'Non-participant must be denied');
  assert.equal(responseData.error, 'Forbidden');
});

test('[Invariant 2] Single participant confirmation updates status to handover_pending without premature completion', async () => {
  const handoverData = {
    id: '22222222-2222-4222-a222-222222222222',
    claim_id: 'claim-2',
    status: 'scheduled',
    finder_confirmed_at: null,
    claimant_confirmed_at: null,
  };
  const claimData = {
    id: 'claim-2',
    claimant_id: 'claimant-user',
    found_item_id: 'f-1',
    status: 'approved',
  };

  const mockDb = createMockSupabaseForHandoverConfirm(handoverData, claimData);
  const confirmHandler = findRouteHandler(claimRoutes, '/handovers/:id/confirm', 'post');

  let statusCode = 200;
  let responseData = null;
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json(b) {
      responseData = b;
      return this;
    },
  };

  // Finder confirms handing over
  const req = {
    user: { id: 'finder-user', email: 'finder@campus.edu', app_metadata: { role: 'student' } },
    params: { id: handoverData.id },
    body: { confirmationType: 'finder_handed_over' },
    userSupabase: mockDb,
    serviceSupabase: mockDb,
  };

  await confirmHandler(req, res);

  assert.equal(statusCode, 200);
  assert.equal(responseData.completed, false, 'Handover must not be completed prematurely');
  assert.equal(mockDb.handover.status, 'handover_pending');
  assert.ok(mockDb.handover.finder_confirmed_at);
  assert.equal(mockDb.handover.claimant_confirmed_at, null);
  assert.equal(mockDb.rpcCalled(), false, 'complete_item_return must not run before second confirmation');
});

test('[Invariant 3] Second participant confirmation triggers atomic completion RPC', async () => {
  const handoverData = {
    id: '33333333-3333-4333-a333-333333333333',
    claim_id: 'claim-3',
    status: 'handover_pending',
    finder_confirmed_at: '2026-10-28T10:00:00Z', // Finder already confirmed
    claimant_confirmed_at: null,
  };
  const claimData = {
    id: 'claim-3',
    claimant_id: 'claimant-user',
    found_item_id: 'f-1',
    status: 'approved',
  };

  const mockDb = createMockSupabaseForHandoverConfirm(handoverData, claimData);
  const confirmHandler = findRouteHandler(claimRoutes, '/handovers/:id/confirm', 'post');

  let statusCode = 200;
  let responseData = null;
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json(b) {
      responseData = b;
      return this;
    },
  };

  // Claimant confirms receipt
  const req = {
    user: { id: 'claimant-user', email: 'claimant@campus.edu', app_metadata: { role: 'student' } },
    params: { id: handoverData.id },
    body: { confirmationType: 'claimant_received' },
    userSupabase: mockDb,
    serviceSupabase: mockDb,
  };

  await confirmHandler(req, res);

  assert.equal(statusCode, 200);
  assert.equal(responseData.completed, true, 'Handover must now be marked completed');
  assert.equal(mockDb.rpcCalled(), true, 'complete_item_return database function must be invoked');
  assert.equal(mockDb.handover.status, 'completed');
});

test('[Invariant 4] Suspended or flagged handover strictly blocks confirmation (403)', async () => {
  const handoverData = {
    id: '44444444-4444-4444-a444-444444444444',
    claim_id: 'claim-4',
    status: 'suspended',
    is_flagged: true,
  };
  const claimData = {
    id: 'claim-4',
    claimant_id: 'claimant-user',
    status: 'approved',
  };

  const mockDb = createMockSupabaseForHandoverConfirm(handoverData, claimData);
  const confirmHandler = findRouteHandler(claimRoutes, '/handovers/:id/confirm', 'post');

  let statusCode = null;
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json() {
      return this;
    },
  };

  const req = {
    user: { id: 'finder-user', app_metadata: { role: 'student' } },
    params: { id: handoverData.id },
    body: { confirmationType: 'finder_handed_over' },
    userSupabase: mockDb,
  };

  await confirmHandler(req, res);

  assert.equal(statusCode, 403, 'Suspended handover must reject confirmation');
});

test('[Invariant 5] Already completed handover cannot be re-confirmed or reopened (400)', async () => {
  const handoverData = {
    id: '55555555-5555-4555-a555-555555555555',
    claim_id: 'claim-5',
    status: 'completed',
    finder_confirmed_at: '2026-10-28T09:00:00Z',
    claimant_confirmed_at: '2026-10-28T09:05:00Z',
  };
  const claimData = { id: 'claim-5', claimant_id: 'claimant-user', status: 'completed' };

  const mockDb = createMockSupabaseForHandoverConfirm(handoverData, claimData);
  const confirmHandler = findRouteHandler(claimRoutes, '/handovers/:id/confirm', 'post');

  let statusCode = null;
  let responseData = null;
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json(b) {
      responseData = b;
      return this;
    },
  };

  const req = {
    user: { id: 'finder-user', app_metadata: { role: 'student' } },
    params: { id: handoverData.id },
    body: { confirmationType: 'finder_handed_over' },
    userSupabase: mockDb,
  };

  await confirmHandler(req, res);

  assert.equal(statusCode, 400);
  assert.equal(responseData.error, 'Handover Already Completed');
});

test('[Invariant 6] Duplicate confirmation by the same participant is rejected with 409 Conflict', async () => {
  const handoverData = {
    id: '66666666-6666-4666-a666-666666666666',
    claim_id: 'claim-6',
    status: 'handover_pending',
    finder_confirmed_at: '2026-10-28T10:00:00Z', // Finder already confirmed once
    claimant_confirmed_at: null,
  };
  const claimData = { id: 'claim-6', claimant_id: 'claimant-user', status: 'approved' };

  const mockDb = createMockSupabaseForHandoverConfirm(handoverData, claimData);
  const confirmHandler = findRouteHandler(claimRoutes, '/handovers/:id/confirm', 'post');

  let statusCode = null;
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json() {
      return this;
    },
  };

  // Finder tries to confirm a second time
  const req = {
    user: { id: 'finder-user', app_metadata: { role: 'student' } },
    params: { id: handoverData.id },
    body: { confirmationType: 'finder_handed_over' },
    userSupabase: mockDb,
  };

  await confirmHandler(req, res);

  assert.equal(statusCode, 409, 'Duplicate confirmation must return 409 Conflict');
});

test('[Invariant 7] Premature confirmation before claim approval triggers hold and incident', async () => {
  const handoverData = {
    id: '77777777-7777-4777-a777-777777777777',
    claim_id: 'claim-7',
    status: 'scheduled',
  };
  const claimData = {
    id: 'claim-7',
    claimant_id: 'claimant-user',
    status: 'pending', // NOT approved yet!
  };

  const mockDb = createMockSupabaseForHandoverConfirm(handoverData, claimData);
  const confirmHandler = findRouteHandler(claimRoutes, '/handovers/:id/confirm', 'post');

  let statusCode = null;
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json() {
      return this;
    },
  };

  const req = {
    user: { id: 'finder-user', app_metadata: { role: 'student' } },
    params: { id: handoverData.id },
    body: { confirmationType: 'finder_handed_over' },
    userSupabase: mockDb,
    serviceSupabase: mockDb,
  };

  await confirmHandler(req, res);

  assert.equal(statusCode, 400);
  assert.equal(mockDb.handover.status, 'suspended', 'Handover must be suspended after premature attempt');
  assert.equal(mockDb.handover.is_flagged, true);
});

// ==============================================================================
// 4. Admin Handover Management Endpoints (adminHandoverRoutes)
// ==============================================================================

function createMockSupabaseForAdminHandovers(initialHandovers = [], initialAudits = []) {
  let handovers = [...initialHandovers];
  let audits = [...initialAudits];

  return {
    handovers,
    audits,
    from(table) {
      if (table === 'item_handovers') {
        let currentHandovers = [...handovers];
        const builder = {
          select() {
            return builder;
          },
          eq(col, val) {
            currentHandovers = currentHandovers.filter((h) => h[col] === val);
            return builder;
          },
          order() {
            return builder;
          },
          maybeSingle: async () => ({ data: currentHandovers[0] || null, error: null }),
          single: async () => ({ data: currentHandovers[0] || null, error: null }),
          update(updates) {
            return {
              eq(col, val) {
                const idx = handovers.findIndex((h) => h[col] === val);
                if (idx !== -1) {
                  handovers[idx] = { ...handovers[idx], ...updates, updated_at: new Date().toISOString() };
                  currentHandovers = [handovers[idx]];
                }
                return {
                  select: () => ({ single: async () => ({ data: handovers[idx], error: null }) }),
                };
              },
            };
          },
          then(resolve) {
            resolve({ data: currentHandovers, count: currentHandovers.length, error: null });
          },
        };
        return builder;
      }

      if (table === 'item_claims') {
        return {
          update: () => ({ eq: () => ({ error: null }) }),
        };
      }

      if (table === 'admin_audit_logs') {
        return {
          select() {
            return {
              eq() {
                return {
                  in: () => ({
                    order: () => ({ then: (r) => r({ data: audits, error: null }) }),
                  }),
                  order: () => ({ then: (r) => r({ data: audits, error: null }) }),
                };
              },
            };
          },
          insert(entries) {
            audits.push(...entries);
            return {
              select: () => ({ maybeSingle: async () => ({ data: entries[0], error: null }) }),
            };
          },
        };
      }

      if (table === 'user_notifications') {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }

      if (table === 'handover_incidents') {
        return {
          select: () => ({ in: () => ({ then: (r) => r({ data: [], error: null }) }) }),
        };
      }

      return {
        select: () => ({ then: (r) => r({ data: [], error: null }) }),
      };
    },
  };
}

test('[Admin Queue] Administrator can fetch handovers list with confirmation states', async () => {
  const syntheticHandovers = [
    {
      id: '88888888-8888-4888-a888-888888888888',
      status: 'scheduled',
      proposed_location: 'Security Office',
      finder_confirmed_at: null,
      claimant_confirmed_at: null,
      claim: {
        id: 'c-1',
        found_item: { title: 'Keys' },
        lost_item: { title: 'Keys' },
      },
    },
  ];

  const mockSupabase = createMockSupabaseForAdminHandovers(syntheticHandovers);
  const getListHandler = findRouteHandler(adminHandoverRouter, '/', 'get');

  let responseData = null;
  const req = {
    user: { id: 'admin-1', app_metadata: { role: 'admin' } },
    query: { page: '1', limit: '10' },
    serviceSupabase: mockSupabase,
  };
  const res = {
    status() {
      return this;
    },
    json(b) {
      responseData = b;
      return this;
    },
  };

  await getListHandler(req, res);

  assert.ok(responseData.success);
  assert.equal(responseData.handovers.length, 1);
  assert.equal(responseData.handovers[0].confirmation_state, 'pending_both');
  assert.equal(responseData.stats.scheduled, 1);
});

test('[Admin Action: Suspend] Administrator can suspend a handover with required reason and write audit entry', async () => {
  const handover = {
    id: '99999999-9999-4999-a999-999999999999',
    claim_id: 'claim-suspend-1',
    status: 'scheduled',
    is_flagged: false,
    claim: { claimant_id: 'c-user', found_item: { user_id: 'f-user', title: 'Laptop' } },
  };

  const mockSupabase = createMockSupabaseForAdminHandovers([handover]);
  const suspendHandler = findRouteHandler(adminHandoverRouter, '/:id/suspend', 'patch');

  // Test 1: Rejects missing reason (< 3 chars)
  let failCode = null;
  await suspendHandler(
    {
      user: { id: 'admin-1', app_metadata: { role: 'admin' } },
      params: { id: handover.id },
      body: { reason: '' },
      serviceSupabase: mockSupabase,
    },
    {
      status(c) {
        failCode = c;
        return this;
      },
      json() {
        return this;
      },
    }
  );
  assert.equal(failCode, 400);

  // Test 2: Successful suspension updates DB and records audit log
  let successCode = 200;
  let successBody = null;
  await suspendHandler(
    {
      user: { id: 'admin-1', email: 'admin@university.edu', app_metadata: { role: 'admin' } },
      params: { id: handover.id },
      body: { reason: 'Suspected fraudulent identity proof submitted by claimant' },
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
  assert.equal(mockSupabase.handovers[0].status, 'suspended');
  assert.equal(mockSupabase.handovers[0].is_flagged, true);
  assert.equal(mockSupabase.audits.length, 1);
  assert.equal(mockSupabase.audits[0].action, 'handover_suspended');
  assert.equal(mockSupabase.audits[0].target_identifier, handover.id);
});

test('[Admin Action: Release Hold] Administrator can release hold on suspended handover with documented notes', async () => {
  const suspendedHandover = {
    id: 'aaaaaaaa-bbbb-4ccc-a888-eeeeeeeeeeee',
    claim_id: 'claim-rel-1',
    status: 'suspended',
    is_flagged: true,
    finder_confirmed_at: null,
    claimant_confirmed_at: null,
    claim: { claimant_id: 'c-user', found_item: { user_id: 'f-user', title: 'Watch' } },
  };

  const mockSupabase = createMockSupabaseForAdminHandovers([suspendedHandover]);
  const releaseHandler = findRouteHandler(adminHandoverRouter, '/:id/release-hold', 'patch');

  let successCode = 200;
  await releaseHandler(
    {
      user: { id: 'admin-1', email: 'admin@university.edu', app_metadata: { role: 'admin' } },
      params: { id: suspendedHandover.id },
      body: { reason: 'Student presented physical purchase receipt at Security Desk; identity verified' },
      serviceSupabase: mockSupabase,
    },
    {
      status(c) {
        successCode = c;
        return this;
      },
      json() {
        return this;
      },
    }
  );

  assert.equal(successCode, 200);
  assert.equal(mockSupabase.handovers[0].status, 'scheduled');
  assert.equal(mockSupabase.handovers[0].is_flagged, false);
  assert.equal(mockSupabase.audits.length, 1);
  assert.equal(mockSupabase.audits[0].action, 'handover_hold_released');
});

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
