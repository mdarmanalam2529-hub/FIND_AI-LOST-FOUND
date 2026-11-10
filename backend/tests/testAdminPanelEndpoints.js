// server/testAdminPanelEndpoints.js
import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { isAuthorizedAdmin, isPrimaryAdmin, isStaffOrAdmin } from './claimWorkflow.js';
import { adminStudentRouter } from './studentRoutes.js';
import { adminUserRouter } from './adminUserRoutes.js';
import { adminDashboardRouter } from './adminDashboardRoutes.js';
import { adminReportRouter } from './adminReportRoutes.js';
import { adminHandoverRouter } from './adminHandoverRoutes.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

// Dispatch helper through Express routers directly
function dispatch(router, method, urlPath, body = {}, reqOverrides = {}) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(urlPath, 'http://localhost');
    const req = {
      method,
      url: parsedUrl.pathname + parsedUrl.search,
      path: parsedUrl.pathname,
      query: Object.fromEntries(parsedUrl.searchParams),
      body,
      headers: { 'content-type': 'application/json' },
      serviceSupabase,
      user: reqOverrides.user,
      ...reqOverrides,
    };

    let statusCode = 200;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      },
      send(data) {
        resolve({ statusCode, data });
      },
      setHeader() {},
      end() {
        resolve({ statusCode, data: null });
      },
    };

    router(req, res, (err) => {
      if (err) {
        resolve({ statusCode: 500, error: err });
      } else {
        resolve({ statusCode: 404, data: { error: 'Not Found' } });
      }
    });
  });
}

const adminUser = {
  id: 'eee6199d-f2f0-4d7c-8b76-2e9859751458',
  email: 'mdarmanalam2529@gmail.com',
  email_confirmed_at: '2026-10-26T18:37:51.981646Z',
  app_metadata: { role: 'primary_admin' },
};

const studentUser = {
  id: 'student-id-1234',
  email: 'student@university.edu',
  app_metadata: { role: 'student' },
};

test('[Admin Verification] Primary admin account role detection', () => {
  assert.equal(isAuthorizedAdmin(adminUser), true, 'Must detect admin role');
  assert.equal(isPrimaryAdmin(adminUser), true, 'Must detect primary admin role');
  assert.equal(isStaffOrAdmin(adminUser), true, 'Must detect staff or admin status');

  assert.equal(isAuthorizedAdmin(studentUser), false, 'Student must not be admin');
  assert.equal(isPrimaryAdmin(studentUser), false, 'Student must not be primary admin');
});

test('[Admin Panel Endpoint] GET /api/admin/dashboard returns valid metrics for primary admin', async () => {
  const res = await dispatch(adminDashboardRouter, 'GET', '/', {}, { user: adminUser });
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.success, true);
  assert.ok(res.data.stats, 'Dashboard payload must contain stats object');
  assert.ok(typeof res.data.stats.students.total === 'number');
  assert.ok(typeof res.data.stats.reports.lost === 'number');
  assert.ok(typeof res.data.stats.claims.open === 'number');
  assert.ok(typeof res.data.stats.handovers.active === 'number');
});

test('[Admin Panel Endpoint] GET /api/admin/dashboard blocks unprivileged student with 403', async () => {
  const res = await dispatch(adminDashboardRouter, 'GET', '/', {}, { user: studentUser });
  assert.equal(res.statusCode, 403);
});

test('[Admin Panel Endpoint - Students] GET /search returns student registry records for admin', async () => {
  const res = await dispatch(adminStudentRouter, 'GET', '/search?limit=5', {}, { user: adminUser });
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.success, true);
  assert.ok(Array.isArray(res.data.students), 'Must return array of students');
  assert.ok(res.data.pagination, 'Must return pagination info');
});

test('[Admin Panel Endpoint - Students] GET /search blocks unprivileged student with 403', async () => {
  const res = await dispatch(adminStudentRouter, 'GET', '/search', {}, { user: studentUser });
  assert.equal(res.statusCode, 403);
});

test('[Admin Panel Endpoint - Admins] GET / returns staff & admin user list', async () => {
  const res = await dispatch(adminUserRouter, 'GET', '/', {}, { user: adminUser });
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.success, true);
  assert.ok(Array.isArray(res.data.users), 'Must return users array');
  assert.equal(res.data.currentUser.isPrimaryAdmin, true, 'Current user must be marked primary admin');
});

test('[Admin Panel Endpoint - Admins] GET / blocks unprivileged student with 403', async () => {
  const res = await dispatch(adminUserRouter, 'GET', '/', {}, { user: studentUser });
  assert.equal(res.statusCode, 403);
});

test('[Admin Panel Endpoint - Reports] GET / returns report moderation list', async () => {
  const res = await dispatch(adminReportRouter, 'GET', '/', {}, { user: adminUser });
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.success, true);
  assert.ok(Array.isArray(res.data.reports), 'Must return reports array');
});

test('[Admin Panel Endpoint - Handovers] GET / returns handover records', async () => {
  const res = await dispatch(adminHandoverRouter, 'GET', '/', {}, { user: adminUser });
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.success, true);
  assert.ok(Array.isArray(res.data.handovers), 'Must return handovers array');
});

