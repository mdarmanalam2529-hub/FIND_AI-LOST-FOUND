/**
 * ==============================================================================
 * Test Suite: testCommunityWorkflow.js
 * Project: FindAI - University Lost-and-Found Platform
 * Milestone: Campus Community Feed, Abuse Reporting, & Admin Moderation
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import {
  formatPublicReporterName,
  computeCommunityStats,
  communityRouter,
} from './communityRoutes.js';
import { redactPrivateReportDetails, adminReportRouter } from './adminReportRoutes.js';

console.log('--- FindAI Campus Community Feed & Reporting Test Suite ---');

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
  console.log(`\nAll ${passed}/${total} Campus Community tests passed successfully!`);
}

// Mock mock items dataset
const MOCK_ITEMS = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    user_id: 'user-1111-1111',
    item_type: 'lost',
    title: 'Blue Hydro Flask with University Stickers',
    description: 'Left near the science library. Call me at 555-123-4567 or email john@campus.edu if found!',
    category: 'other',
    color: 'blue',
    location_description: 'Science Hall 2nd Floor, contact me at student@uni.edu',
    incident_date: '2026-10-25',
    status: 'open',
    image_path: 'user-1111-1111/flask.jpg',
    created_at: '2026-10-25T10:00:00Z',
    updated_at: '2026-10-25T10:00:00Z',
  },
  {
    id: 'b0000000-0000-4000-8000-000000000002',
    user_id: 'user-2222-2222',
    item_type: 'found',
    title: 'Silver Apple AirPods Pro with Black Case',
    description: 'Found on the bench outside the student union.',
    category: 'electronics',
    color: 'silver',
    location_description: 'Student Union Plaza',
    incident_date: '2026-10-26',
    status: 'open',
    image_path: null,
    created_at: '2026-10-26T14:30:00Z',
    updated_at: '2026-10-26T14:30:00Z',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000003',
    user_id: 'user-3333-3333',
    item_type: 'found',
    title: 'Leather Wallet with Metro Card',
    description: 'Brown bifold wallet found in the cafeteria.',
    category: 'keys-wallets',
    color: 'brown',
    location_description: 'Campus Cafeteria',
    incident_date: '2026-10-24',
    status: 'returned', // Resolved item
    image_path: null,
    created_at: '2026-10-24T09:00:00Z',
    updated_at: '2026-10-27T16:00:00Z',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000004',
    user_id: 'user-4444-4444',
    item_type: 'lost',
    title: 'Spammy / Offensive Demo Report',
    description: 'Inappropriate content that violates student code.',
    category: 'clothing',
    color: 'black',
    location_description: 'Gymnasium',
    incident_date: '2026-10-20',
    status: 'closed', // Moderated / restricted item
    image_path: null,
    created_at: '2026-10-20T12:00:00Z',
    updated_at: '2026-10-21T10:00:00Z',
  },
];

// Helper to construct a mock Supabase query builder
function createMockSupabase(items = MOCK_ITEMS) {
  const auditLogs = [];
  const communityReports = [];

  const client = {
    _auditLogs: auditLogs,
    _communityReports: communityReports,
    storage: {
      from(bucket) {
        return {
          async createSignedUrl(path, expiresIn) {
            return { data: { signedUrl: `https://mock.storage/${bucket}/${path}?signed=true` }, error: null };
          },
        };
      },
    },
    from(table) {
      if (table === 'student_profiles') {
        return {
          select(fields) {
            return {
              in(field, values) {
                return Promise.resolve({
                  data: [
                    { user_id: 'user-1111-1111', student_name: 'Johnathan Doe' },
                    { user_id: 'user-2222-2222', student_name: 'Alice Smith' },
                  ],
                  error: null,
                });
              },
            };
          },
        };
      }

      if (table === 'community_item_reports') {
        const builder = {
          select(fields) {
            return {
              eq(col1, val1) {
                return {
                  eq(col2, val2) {
                    return {
                      async maybeSingle() {
                        const match = communityReports.find(
                          (r) => r[col1] === val1 && r[col2] === val2
                        );
                        return { data: match || null, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
          async insert(records) {
            communityReports.push(...records);
            return { data: records, error: null };
          },
          update(updates) {
            return {
              eq(col1, val1) {
                return {
                  eq(col2, val2) {
                    for (const r of communityReports) {
                      if (r[col1] === val1 && (!col2 || r[col2] === val2)) {
                        Object.assign(r, updates);
                      }
                    }
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
        return builder;
      }

      if (table === 'admin_audit_logs') {
        const builder = {
          select(fields) {
            const self = {
              _filters: {},
              eq(col, val) {
                self._filters[col] = val;
                return self;
              },
              in(col, vals) {
                self._filters[`${col}_in`] = vals;
                return self;
              },
              order() {
                return self;
              },
              limit() {
                return self;
              },
              then(resolve) {
                let filtered = [...auditLogs];
                if (self._filters.action) {
                  filtered = filtered.filter((l) => l.action === self._filters.action);
                }
                if (self._filters.target_identifier) {
                  filtered = filtered.filter((l) => l.target_identifier === self._filters.target_identifier);
                }
                if (self._filters.target_identifier_in) {
                  filtered = filtered.filter((l) => self._filters.target_identifier_in.includes(l.target_identifier));
                }
                if (self._filters.target_type) {
                  filtered = filtered.filter((l) => l.target_type === self._filters.target_type);
                }
                if (self._filters.actor_id) {
                  filtered = filtered.filter((l) => l.actor_id === self._filters.actor_id);
                }
                resolve({ data: filtered, error: null });
              },
            };
            return self;
          },
          insert(records) {
            for (const r of records) {
              const fullRecord = { id: `log-${Date.now()}-${Math.random()}`, created_at: new Date().toISOString(), ...r };
              auditLogs.push(fullRecord);
            }
            return {
              select() {
                return {
                  async maybeSingle() {
                    return { data: records[0], error: null };
                  },
                };
              },
            };
          },
        };
        return builder;
      }

      if (table === 'item_claims' || table === 'handover_incidents') {
        const builder = {
          select() {
            return builder;
          },
          or() {
            return Promise.resolve({ data: [], error: null });
          },
          in() {
            return Promise.resolve({ data: [], error: null });
          },
          eq() {
            return Promise.resolve({ data: [], error: null });
          },
        };
        return builder;
      }

      if (table === 'items') {
        const builder = {
          _filters: {},
          _orders: [],
          select(fields, opts = {}) {
            builder._fields = fields;
            builder._countOpts = opts;
            return builder;
          },
          eq(col, val) {
            builder._filters[col] = val;
            return builder;
          },
          in(col, vals) {
            builder._filters[`${col}_in`] = vals;
            return builder;
          },
          gte(col, val) {
            builder._filters[`${col}_gte`] = val;
            return builder;
          },
          order(col, opts = {}) {
            builder._orders.push({ col, ascending: opts.ascending !== false });
            return builder;
          },
          async maybeSingle() {
            let filtered = [...items];
            if (builder._filters.id) {
              filtered = filtered.filter((i) => i.id === builder._filters.id);
            }
            return { data: filtered[0] || null, error: null };
          },
          then(resolve) {
            let res = [...items];
            if (builder._filters.status) {
              res = res.filter((i) => i.status === builder._filters.status);
            }
            if (builder._filters.status_in) {
              res = res.filter((i) => builder._filters.status_in.includes(i.status));
            }
            if (builder._filters.item_type) {
              res = res.filter((i) => i.item_type === builder._filters.item_type);
            }
            if (builder._filters.category) {
              res = res.filter((i) => i.category === builder._filters.category);
            }
            resolve({ data: res, count: res.length, error: null });
          },
        };
        return builder;
      }

      return {
        select() {
          return { data: [], error: null };
        },
      };
    },
  };

  return client;
}

// ==============================================================================
// 1. Privacy & Display Name Formatting Tests
// ==============================================================================

test('[Privacy] formatPublicReporterName formats "First L." display names', () => {
  assert.equal(formatPublicReporterName('Johnathan Doe'), 'Johnathan D.');
  assert.equal(formatPublicReporterName('Alice Mary Smith'), 'Alice S.');
  assert.equal(formatPublicReporterName('Sam'), 'Sam');
  assert.equal(formatPublicReporterName(''), 'Student');
  assert.equal(formatPublicReporterName(null), 'Student');
  assert.equal(formatPublicReporterName(undefined), 'Student');
});

test('[Privacy] redactPrivateReportDetails strips emails and phone numbers from description and location', () => {
  const dirty = {
    title: 'Blue Flask',
    description: 'Call 555-123-4567 or email john.doe@university.edu if found.',
    location_description: 'Library table, reach me at student@uni.edu or 212-555-9876',
  };

  const clean = redactPrivateReportDetails(dirty);
  assert.equal(clean.description.includes('john.doe@university.edu'), false);
  assert.equal(clean.description.includes('555-123-4567'), false);
  assert.equal(clean.description.includes('[REDACTED_EMAIL]'), true);
  assert.equal(clean.description.includes('[REDACTED_PHONE]'), true);

  assert.equal(clean.location_description.includes('student@uni.edu'), false);
  assert.equal(clean.location_description.includes('212-555-9876'), false);
  assert.equal(clean.location_description.includes('[REDACTED_EMAIL]'), true);
  assert.equal(clean.location_description.includes('[REDACTED_PHONE]'), true);
});

// ==============================================================================
// 2. Live Community Statistics Tests
// ==============================================================================

test('[Stats] computeCommunityStats calculates accurate counts for open lost, found, and resolved', async () => {
  const mockDb = createMockSupabase();
  const stats = await computeCommunityStats(mockDb);

  assert.equal(stats.totalLost, 1, 'Should have 1 open lost report');
  assert.equal(stats.totalFound, 1, 'Should have 1 open found report');
  assert.equal(stats.totalActive, 2, 'Total active should be 2');
  assert.equal(stats.totalResolved, 1, 'Should have 1 resolved report');
});

// ==============================================================================
// 3. Community Feed Retrieval & Filtering Tests
// ==============================================================================

test('[Feed] GET /api/community/items strictly excludes closed/rejected items', async () => {
  const mockDb = createMockSupabase();
  const req = {
    query: {},
    serviceSupabase: mockDb,
    user: { id: 'user-viewer-1' },
  };

  let responseData = null;
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items' && layer.route.methods.get
  ).route.stack[0].handle;

  await handler(req, res);

  assert.ok(responseData?.success);
  assert.ok(Array.isArray(responseData.items));
  // Closed report (id: d0000000-0000-4000-8000-000000000004) must NOT be in the results
  const hasClosed = responseData.items.some((i) => i.id === 'd0000000-0000-4000-8000-000000000004');
  assert.equal(hasClosed, false, 'Closed/rejected items must never appear in community feed');

  // Open items should be returned
  const hasOpenLost = responseData.items.some((i) => i.id === 'a0000000-0000-4000-8000-000000000001');
  const hasOpenFound = responseData.items.some((i) => i.id === 'b0000000-0000-4000-8000-000000000002');
  assert.equal(hasOpenLost, true);
  assert.equal(hasOpenFound, true);
});

test('[Feed] GET /api/community/items applies PII redaction and signed image URLs', async () => {
  const mockDb = createMockSupabase();
  const req = {
    query: {},
    serviceSupabase: mockDb,
    user: { id: 'user-viewer-1' },
  };

  let responseData = null;
  const res = {
    status() { return this; },
    json(data) { responseData = data; return this; },
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items' && layer.route.methods.get
  ).route.stack[0].handle;

  await handler(req, res);

  const hydroFlask = responseData.items.find((i) => i.id === 'a0000000-0000-4000-8000-000000000001');
  assert.ok(hydroFlask);
  assert.equal(hydroFlask.reporter_name, 'Johnathan D.', 'Should format reporter display name');
  assert.equal(hydroFlask.description.includes('john@campus.edu'), false, 'Email must be redacted');
  assert.equal(hydroFlask.description.includes('555-123-4567'), false, 'Phone must be redacted');
  assert.ok(hydroFlask.signed_image_url, 'Should attach signed image URL for private image');
  assert.equal(hydroFlask.is_own_listing, false);
});

test('[Feed] GET /api/community/items flags user own listing correctly', async () => {
  const mockDb = createMockSupabase();
  const req = {
    query: {},
    serviceSupabase: mockDb,
    user: { id: 'user-1111-1111' }, // Author of the hydro flask
  };

  let responseData = null;
  const res = {
    status() { return this; },
    json(data) { responseData = data; return this; },
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items' && layer.route.methods.get
  ).route.stack[0].handle;

  await handler(req, res);

  const hydroFlask = responseData.items.find((i) => i.id === 'a0000000-0000-4000-8000-000000000001');
  assert.equal(hydroFlask.is_own_listing, true, 'is_own_listing should be true when caller owns the item');
});

test('[Feed] GET /api/community/items filters by search query and category', async () => {
  const mockDb = createMockSupabase();
  const req = {
    query: { search: 'AirPods' },
    serviceSupabase: mockDb,
    user: { id: 'user-viewer-1' },
  };

  let responseData = null;
  const res = {
    status() { return this; },
    json(data) { responseData = data; return this; },
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items' && layer.route.methods.get
  ).route.stack[0].handle;

  await handler(req, res);

  assert.equal(responseData.items.length, 1);
  assert.equal(responseData.items[0].id, 'b0000000-0000-4000-8000-000000000002');
});

// ==============================================================================
// 4. Abuse Reporting Tests (POST /api/community/items/:id/report)
// ==============================================================================

test('[Reporting] POST /api/community/items/:id/report rejects unauthenticated user with 401', async () => {
  const mockDb = createMockSupabase();
  const req = {
    params: { id: 'a0000000-0000-4000-8000-000000000001' },
    body: { reason: 'inappropriate' },
    user: null,
    serviceSupabase: mockDb,
  };

  let statusCode = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json() { return this; },
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items/:id/report' && layer.route.methods.post
  ).route.stack[0].handle;

  await handler(req, res);
  assert.equal(statusCode, 401);
});

test('[Reporting] POST /api/community/items/:id/report rejects invalid UUID with 400', async () => {
  const mockDb = createMockSupabase();
  const req = {
    params: { id: 'not-a-valid-uuid' },
    body: { reason: 'inappropriate' },
    user: { id: 'user-student-1' },
    serviceSupabase: mockDb,
  };

  let statusCode = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json() { return this; },
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items/:id/report' && layer.route.methods.post
  ).route.stack[0].handle;

  await handler(req, res);
  assert.equal(statusCode, 400);
});

test('[Reporting] POST /api/community/items/:id/report rejects invalid reason with 400', async () => {
  const mockDb = createMockSupabase();
  const req = {
    params: { id: 'a0000000-0000-4000-8000-000000000001' },
    body: { reason: 'not_a_real_reason' },
    user: { id: 'user-student-1' },
    serviceSupabase: mockDb,
  };

  let statusCode = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json() { return this; },
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items/:id/report' && layer.route.methods.post
  ).route.stack[0].handle;

  await handler(req, res);
  assert.equal(statusCode, 400);
});

test('[Reporting] POST /api/community/items/:id/report rejects user reporting their own listing', async () => {
  const mockDb = createMockSupabase();
  const req = {
    params: { id: 'a0000000-0000-4000-8000-000000000001' },
    body: { reason: 'inappropriate' },
    user: { id: 'user-1111-1111' }, // The author of this item
    serviceSupabase: mockDb,
  };

  let statusCode = null;
  let responseData = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { responseData = data; return this; },
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items/:id/report' && layer.route.methods.post
  ).route.stack[0].handle;

  await handler(req, res);
  assert.equal(statusCode, 400);
  assert.equal(responseData.message.includes('own listing'), true);
});

test('[Reporting] POST /api/community/items/:id/report successfully submits valid report and logs audit entry', async () => {
  const mockDb = createMockSupabase();
  const req = {
    params: { id: 'b0000000-0000-4000-8000-000000000002' },
    body: {
      reason: 'suspicious',
      details: 'This item looks like a counterfeit listing.',
    },
    user: {
      id: 'user-student-99',
      email: 'student99@campus.edu',
      user_metadata: { full_name: 'Reporter Student' },
    },
    serviceSupabase: mockDb,
  };

  let statusCode = null;
  let responseData = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { responseData = data; return this; },
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items/:id/report' && layer.route.methods.post
  ).route.stack[0].handle;

  await handler(req, res);

  assert.equal(statusCode, 201);
  assert.ok(responseData.success);

  // Verify community_item_reports insertion
  assert.equal(mockDb._communityReports.length, 1);
  assert.equal(mockDb._communityReports[0].item_id, 'b0000000-0000-4000-8000-000000000002');
  assert.equal(mockDb._communityReports[0].reason, 'suspicious');

  // Verify admin_audit_logs insertion
  const logged = mockDb._auditLogs.find((l) => l.action === 'community_reported');
  assert.ok(logged, 'Audit log entry must be created');
  assert.equal(logged.target_identifier, 'b0000000-0000-4000-8000-000000000002');
});

test('[Reporting] POST /api/community/items/:id/report prevents duplicate report by same user (409)', async () => {
  const mockDb = createMockSupabase();
  const req = {
    params: { id: 'b0000000-0000-4000-8000-000000000002' },
    body: { reason: 'duplicate', details: 'Duplicate submission test' },
    user: { id: 'user-student-99', email: 'student99@campus.edu' },
    serviceSupabase: mockDb,
  };

  const handler = communityRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/items/:id/report' && layer.route.methods.post
  ).route.stack[0].handle;

  // First submission: should succeed (201)
  let status1 = null;
  await handler(req, {
    status(code) { status1 = code; return this; },
    json() { return this; },
  });
  assert.equal(status1, 201);

  // Second submission: must be rejected with 409 Conflict
  let status2 = null;
  let responseData2 = null;
  await handler(req, {
    status(code) { status2 = code; return this; },
    json(d) { responseData2 = d; return this; },
  });
  assert.equal(status2, 409);
  assert.equal(responseData2.error, 'Conflict');
});

// ==============================================================================
// 5. Admin Moderation Integration Tests
// ==============================================================================

test('[Admin Moderation] Community-flagged items are enriched and tagged with community_reported', async () => {
  const mockDb = createMockSupabase();

  // Insert a community report into audit logs for item b0000000-0000-4000-8000-000000000002
  mockDb._auditLogs.push({
    id: 'audit-comm-1',
    actor_name: 'Student Reporter',
    actor_role: 'student',
    action: 'community_reported',
    target_type: 'item_report',
    target_identifier: 'b0000000-0000-4000-8000-000000000002',
    reason: 'Suspicious or fraudulent activity',
    details: { reason: 'suspicious', explanation: 'Scam listing' },
    created_at: new Date().toISOString(),
  });

  const req = {
    query: { indicator: 'community_reported' },
    serviceSupabase: mockDb,
    user: { id: 'admin-1', app_metadata: { role: 'admin' }, email: 'admin@university.edu', email_confirmed_at: '2026-01-01' },
  };

  let responseData = null;
  const res = {
    status() { return this; },
    json(d) { responseData = d; return this; },
  };

  const handler = adminReportRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/' && layer.route.methods.get
  ).route.stack[1].handle;

  await handler(req, res);

  assert.ok(responseData.success);
  assert.equal(responseData.reports.length, 1);
  const flagged = responseData.reports[0];
  assert.equal(flagged.id, 'b0000000-0000-4000-8000-000000000002');
  assert.equal(flagged.indicators.is_community_reported, true);
  assert.equal(flagged.indicators.community_report_count, 1);
});

test('[Admin Moderation] Admin can dismiss community flags via PATCH moderate', async () => {
  const mockDb = createMockSupabase();

  const req = {
    params: { id: 'b0000000-0000-4000-8000-000000000002' },
    body: {
      action: 'dismiss_community_flags',
      reason: 'Verified legitimate item with student union desk.',
    },
    serviceSupabase: mockDb,
    user: { id: 'admin-1', app_metadata: { role: 'admin' }, email: 'admin@university.edu', email_confirmed_at: '2026-01-01' },
  };

  let responseData = null;
  const res = {
    status() { return this; },
    json(d) { responseData = d; return this; },
  };

  const handler = adminReportRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/:id/moderate' && layer.route.methods.patch
  ).route.stack[1].handle;

  await handler(req, res);

  assert.ok(responseData.success);
  // Verify audit log has community_flags_dismissed action
  const audit = mockDb._auditLogs.find((l) => l.action === 'report_dismiss_community_flags');
  assert.ok(audit, 'Dismiss action must be recorded in audit log');
  assert.equal(audit.target_identifier, 'b0000000-0000-4000-8000-000000000002');
});

runAllTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
