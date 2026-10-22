import http from 'http';
import app from './index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function makeRequest({ method, path, headers = {}, body = null, port }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ statusCode: res.statusCode, data: parsed });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runApiTests() {
  console.log('\n============================================================');
  console.log('--- FIND-AI HTTP API SECURITY & ERROR TEST SUITE ---');
  console.log('============================================================\n');

  // Start test server on ephemeral port 3099
  const TEST_PORT = 3099;
  const server = app.listen(TEST_PORT);

  await new Promise((r) => setTimeout(r, 500));

  try {
    // 1. GET /api/health
    console.log('[API Test 1] Health Check Endpoint:');
    const healthRes = await makeRequest({
      method: 'GET',
      path: '/api/health',
      port: TEST_PORT,
    });
    assert(healthRes.statusCode === 200, 'GET /api/health returns HTTP 200');
    assert(healthRes.data?.status === 'ok', 'Health status is ok');
    assert(healthRes.data?.model === 'Xenova/all-MiniLM-L6-v2', 'Health report includes text model');

    // 2. POST /api/matches without Authorization header
    console.log('\n[API Test 2] Missing Authorization Header:');
    const noAuthRes = await makeRequest({
      method: 'POST',
      path: '/api/matches',
      port: TEST_PORT,
      body: { targetItemId: '123e4567-e89b-12d3-a456-426614174000' },
    });
    assert(noAuthRes.statusCode === 401, 'Request without token is rejected with HTTP 401');
    assert(noAuthRes.data?.error === 'Unauthorized', 'Error code is Unauthorized');

    // 3. POST /api/matches with invalid/fake Bearer token
    console.log('\n[API Test 3] Invalid / Expired Bearer Token:');
    const invalidTokenRes = await makeRequest({
      method: 'POST',
      path: '/api/matches',
      headers: { Authorization: 'Bearer fake_invalid_jwt_token_99999' },
      port: TEST_PORT,
      body: { targetItemId: '123e4567-e89b-12d3-a456-426614174000' },
    });
    assert(invalidTokenRes.statusCode === 401, 'Request with invalid token is rejected with HTTP 401');
    assert(invalidTokenRes.data?.message?.includes('Invalid') || invalidTokenRes.data?.message?.includes('token'), 'Returns clear invalid token message');

    // 4. POST /api/matches with empty token
    console.log('\n[API Test 4] Empty Bearer Token:');
    const emptyTokenRes = await makeRequest({
      method: 'POST',
      path: '/api/matches',
      headers: { Authorization: 'Bearer ' },
      port: TEST_PORT,
      body: { targetItemId: '123e4567-e89b-12d3-a456-426614174000' },
    });
    assert(emptyTokenRes.statusCode === 401, 'Request with empty token is rejected with HTTP 401');

    console.log('\n============================================================');
    console.log(`API TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log('============================================================\n');
  } finally {
    server.close();
  }

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }

runApiTests().catch((err) => {
  console.error('API Test Error:', err);
  process.exit(1);
});
