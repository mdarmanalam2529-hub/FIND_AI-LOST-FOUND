/**
 * ==============================================================================
 * Test Suite: testLoginAuthDiagnostics.js
 * Project: FindAI - University Lost-and-Found Platform
 * Scope: Diagnostic Verification of Login Authentication & Route Isolation
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import app from './index.js';

const testsQueue = [];
function test(name, fn) {
  testsQueue.push({ name, fn });
}

async function runAllTests() {
  console.log('--- FindAI Login Authentication & Route Isolation Diagnostic Tests ---');
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
  console.log(`\nAll ${passed}/${testsQueue.length} Login Authentication Diagnostic tests passed successfully!\n`);
  process.exit(0);
}

// In-process Express dispatch helper
function dispatch(appInstance, { method, url, headers = {}, body = null }) {
  return new Promise((resolve) => {
    let statusCode = 200;
    let responseHeaders = {};
    let responseBody = null;

    const req = {
      method: method.toUpperCase(),
      url,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: body || {},
      query: {},
      params: {},
      ip: '127.0.0.1',
    };

    const res = {
      setHeader(k, v) {
        responseHeaders[k.toLowerCase()] = v;
      },
      getHeader(k) {
        return responseHeaders[k.toLowerCase()];
      },
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        resolve({ statusCode, headers: responseHeaders, body: responseBody });
        return this;
      },
      send(data) {
        responseBody = data;
        resolve({ statusCode, headers: responseHeaders, body: responseBody });
        return this;
      },
      sendFile(filePath) {
        responseBody = filePath;
        resolve({ statusCode, headers: responseHeaders, body: responseBody });
        return this;
      },
    };

    appInstance.handle(req, res);
  });
}

// ==============================================================================
// 1. Public Authentication Route Accessibility (Must NOT Require Authorization Header)
// ==============================================================================

test('[Route Hierarchy] POST /api/auth/student-login is NOT intercepted by authenticateUser', async () => {
  // Call student login with missing credentials
  // If authenticateUser intercepted it, status would be 401 with 'Missing or malformed Authorization header. Expected Bearer <token>.'
  // Because it reaches authStudentRouter, it returns 'Invalid university registration number or password.'
  const res = await dispatch(app, {
    method: 'POST',
    url: '/api/auth/student-login',
    body: {
      registrationNumber: '',
      password: '',
    },
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, 'Invalid Credentials');
  assert.equal(
    res.body?.message,
    'Invalid university registration number or password.',
    'Must return clean user-facing error instead of technical header error'
  );
  assert.notEqual(
    res.body?.message,
    'Missing or malformed Authorization header. Expected Bearer <token>.',
    'Must NEVER intercept public student-login with Authorization header requirement'
  );
});

test('[Route Hierarchy] POST /api/auth/register-student is NOT intercepted by authenticateUser', async () => {
  const res = await dispatch(app, {
    method: 'POST',
    url: '/api/auth/register-student',
    body: {},
  });

  // When called without body, student signup router catches missing fields, not Authorization header
  assert.notEqual(
    res.body?.message,
    'Missing or malformed Authorization header. Expected Bearer <token>.',
    'Must NEVER intercept public student registration with Authorization header requirement'
  );
});

test('[Route Hierarchy] GET /api/health is accessible publicly without Authorization header', async () => {
  const res = await dispatch(app, {
    method: 'GET',
    url: '/api/health',
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.status, 'ok');
});

// ==============================================================================
// 2. Protected Routes Strictly Enforce Authorization Header
// ==============================================================================

test('[Protected Route] GET /api/claims rejects request lacking Authorization header (401)', async () => {
  const res = await dispatch(app, {
    method: 'GET',
    url: '/api/claims',
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, 'Unauthorized');
  assert.equal(res.body?.message, 'Missing or malformed Authorization header. Expected Bearer <token>.');
});

test('[Protected Route] POST /api/matches rejects request lacking Authorization header (401)', async () => {
  const res = await dispatch(app, {
    method: 'POST',
    url: '/api/matches',
    body: { targetItemId: '123e4567-e89b-12d3-a456-426614174000' },
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, 'Unauthorized');
  assert.equal(res.body?.message, 'Missing or malformed Authorization header. Expected Bearer <token>.');
});

test('[Protected Route] GET /api/admin/reports rejects unauthenticated request (401)', async () => {
  const res = await dispatch(app, {
    method: 'GET',
    url: '/api/admin/reports',
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, 'Unauthorized');
  assert.equal(res.body?.message, 'Missing or malformed Authorization header. Expected Bearer <token>.');
});

test('[Protected Route] GET /api/admin/handovers rejects unauthenticated request (401)', async () => {
  const res = await dispatch(app, {
    method: 'GET',
    url: '/api/admin/handovers',
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, 'Unauthorized');
  assert.equal(res.body?.message, 'Missing or malformed Authorization header. Expected Bearer <token>.');
});

test('[Protected Route] GET /api/admin/dashboard rejects unauthenticated request (401)', async () => {
  const res = await dispatch(app, {
    method: 'GET',
    url: '/api/admin/dashboard',
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error, 'Unauthorized');
  assert.equal(res.body?.message, 'Missing or malformed Authorization header. Expected Bearer <token>.');
});

// ==============================================================================
// 3. Frontend Component Invariant Checks
// ==============================================================================

test('[Frontend Invariant] AdminClaims.jsx uses claimsService instead of raw unauthenticated fetch', () => {
  const filePath = path.resolve(process.cwd(), 'src/pages/AdminClaims.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  // Verify that AdminClaims does not call fetch('/api/claims') without authorization
  assert.ok(
    !code.includes("fetch('/api/claims', {"),
    'AdminClaims.jsx must not call raw fetch without Authorization header'
  );
  assert.ok(
    code.includes('claimsService.fetchClaims()'),
    'AdminClaims.jsx must delegate to claimsService.fetchClaims() to include auth headers'
  );
});

test('[Frontend Invariant] Dashboard.jsx restricts admin dashboard queries to authenticated admins only', () => {
  const filePath = path.resolve(process.cwd(), 'src/pages/Dashboard.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(
    code.includes('isAdmin'),
    'Dashboard.jsx must inspect admin role before calling adminService.fetchDashboard'
  );
  assert.ok(
    code.includes('if (!isAdmin)'),
    'Dashboard.jsx must bypass fetchAdminStats when user is not an administrator'
  );
});

test('[Frontend Invariant] App.jsx wraps all admin routes in AdminRoute', () => {
  const filePath = path.resolve(process.cwd(), 'src/App.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  // Verify that AdminImportStudents and AdminIncidents are wrapped in AdminRoute
  assert.ok(
    /<AdminRoute[^>]*>\s*<AdminImportStudents \/>/m.test(code),
    'AdminImportStudents must be guarded by AdminRoute'
  );
  assert.ok(
    /<AdminRoute[^>]*>\s*<AdminIncidents \/>/m.test(code),
    'AdminIncidents must be guarded by AdminRoute'
  );
});

runAllTests().catch((err) => {
  console.error('Fatal diagnostic test failure:', err);
  process.exit(1);
});
