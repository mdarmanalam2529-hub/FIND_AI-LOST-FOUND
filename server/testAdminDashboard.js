import express from 'express';
import http from 'http';
import assert from 'node:assert/strict';
import { adminDashboardRouter } from './adminDashboardRoutes.js';

// Helper to create a mock Supabase client with configurable counts and optional error for audit logs.
function createMockSupabase(overrides = {}) {
  const defaultCounts = {
    student_registry: { total: 10, eligible: 7, pending: 2 },
    student_profiles: { pending: 1 },
    items: { lost: 5, found: 3 },
    item_claims: { open: 4, pendingReview: 2 },
    item_handovers: { active: 3, suspended: 1 },
    handover_incidents: { open: 2, resolved: 5 },
    admin_audit_logs: { logs: [] },
  };
  const counts = { ...defaultCounts, ...overrides };

  return {
    from(table) {
      const tableCounts = counts[table] ?? {};
      const builder = {
        eq: () => builder,
        neq: () => builder,
        not: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        then(resolve) {
          if (table === 'admin_audit_logs' && tableCounts.error) {
            resolve({ data: null, error: new Error(tableCounts.error) });
          } else {
            const countValue =
              table === 'student_registry'
                ? tableCounts.total ?? 0
                : table === 'student_profiles'
                ? tableCounts.pending ?? 0
                : table === 'items'
                ? (tableCounts.lost ?? 0) + (tableCounts.found ?? 0)
                : table === 'item_claims'
                ? tableCounts.open ?? 0
                : table === 'item_handovers'
                ? tableCounts.active ?? 0
                : table === 'handover_incidents'
                ? tableCounts.open ?? 0
                : 0;
            if (table === 'admin_audit_logs') {
              resolve({ data: tableCounts.logs || [], error: null });
            } else {
              resolve({ count: countValue, error: null });
            }
          }
        },
      };
      return builder;
    },
  };
}

function createTestApp(mockSupabase, user) {
  const app = express();
  app.use((req, res, next) => {
    req.user = user;
    req.serviceSupabase = mockSupabase;
    next();
  });
  app.use('/api/admin/dashboard', adminDashboardRouter);
  return app;
}

async function makeRequest({ method = 'GET', path, port }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ statusCode: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('\n--- Admin Dashboard Route Test Suite ---');
  const TEST_PORT = 3111;
  const adminUser = { id: 'admin-uuid', app_metadata: { role: 'admin' } };

  // 1. Successful admin request
  const server1 = createTestApp(createMockSupabase(), adminUser).listen(TEST_PORT);
  await new Promise(r => setTimeout(r, 200));
  const res1 = await makeRequest({ path: '/api/admin/dashboard', port: TEST_PORT });
  assert.equal(res1.statusCode, 200, 'Admin request should succeed');
  assert.equal(res1.data?.success, true, 'Response success flag');
  assert.ok(Array.isArray(res1.data?.stats?.recentAudits), 'Recent audits present');
  server1.close();

  // 2. Non‑admin forbidden
  const server2 = createTestApp(createMockSupabase(), { id: 'user-uuid', app_metadata: { role: 'user' } }).listen(TEST_PORT + 1);
  await new Promise(r => setTimeout(r, 200));
  const res2 = await makeRequest({ path: '/api/admin/dashboard', port: TEST_PORT + 1 });
  assert.equal(res2.statusCode, 403, 'Non‑admin should be 403');
  server2.close();

  // 3. Empty datasets
  const emptyCounts = {
    student_registry: { total: 0, eligible: 0, pending: 0 },
    student_profiles: { pending: 0 },
    items: { lost: 0, found: 0 },
    item_claims: { open: 0, pendingReview: 0 },
    item_handovers: { active: 0, suspended: 0 },
    handover_incidents: { open: 0, resolved: 0 },
    admin_audit_logs: { logs: [] },
  };
  const server3 = createTestApp(createMockSupabase(emptyCounts), adminUser).listen(TEST_PORT + 2);
  await new Promise(r => setTimeout(r, 200));
  const res3 = await makeRequest({ path: '/api/admin/dashboard', port: TEST_PORT + 2 });
  assert.equal(res3.statusCode, 200, 'Empty data returns 200');
  assert.equal(res3.data?.stats?.students?.total, 0, 'Zero student total');
  server3.close();

  // 4. Audit log error toleration
  const auditErrorSupabase = createMockSupabase({ admin_audit_logs: { error: 'simulated db failure' } });
  const server4 = createTestApp(auditErrorSupabase, adminUser).listen(TEST_PORT + 3);
  await new Promise(r => setTimeout(r, 200));
  const res4 = await makeRequest({ path: '/api/admin/dashboard', port: TEST_PORT + 3 });
  assert.equal(res4.statusCode, 200, 'Audit error still 200');
  assert.ok(Array.isArray(res4.data?.stats?.recentAudits), 'Fallback audits array');
  server4.close();

  // 5. Audit log limit
  const manyLogs = Array.from({ length: 25 }, (_, i) => ({
    id: `log-${i}`,
    timestamp: new Date().toISOString(),
    actor_id: 'admin',
    actor_role: 'admin',
    action: 'test_action',
    reason: null,
  }));
  const server5 = createTestApp(createMockSupabase({ admin_audit_logs: { logs: manyLogs } }), adminUser).listen(TEST_PORT + 4);
  await new Promise(r => setTimeout(r, 200));
  const res5 = await makeRequest({ path: '/api/admin/dashboard', port: TEST_PORT + 4 });
  assert.equal(res5.statusCode, 200, 'Audit limit success');
  assert.equal(res5.data?.stats?.recentAudits?.length, 10, 'Limit to 10 entries');
  server5.close();

  // 6. Client‑metadata role injection
  const maliciousUser = {
    id: 'evil-uuid',
    app_metadata: { role: 'authenticated' },
    user_metadata: { role: 'admin' },
    email: 'attacker@evil.com',
    email_confirmed_at: '2026-10-20T00:00:00Z',
  };
  const server6 = createTestApp(createMockSupabase(), maliciousUser).listen(TEST_PORT + 5);
  await new Promise(r => setTimeout(r, 200));
  const res6 = await makeRequest({ path: '/api/admin/dashboard', port: TEST_PORT + 5 });
  assert.equal(res6.statusCode, 403, 'Metadata role injection must not grant admin');
  server6.close();

  console.log('All admin dashboard tests passed.');
  process.exit(0);
})();
