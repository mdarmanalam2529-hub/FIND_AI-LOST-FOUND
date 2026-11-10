/**
 * ==============================================================================
 * Test Suite: testSimplifiedStudentAuth.js
 * Project: FindAI - University Lost-and-Found Platform
 * Scope: Simplified Student Authentication, Initial Password, & Password Change Lifecycle
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import {
  authStudentRouter,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
  LOGIN_ATTEMPT_WINDOW_MS,
  MAX_LOGIN_ATTEMPTS,
} from './studentRoutes.js';
import {
  evaluateStudentEligibility,
  normalizeRegistrationNumber,
  isAccountActive,
} from './studentValidation.js';

const testsQueue = [];
function test(name, fn) {
  testsQueue.push({ name, fn });
}

// ==============================================================================
// Mock Supabase Infrastructure
// ==============================================================================

function createMockServiceSupabase({
  registry = new Map(),
  profiles = new Map(),
  authUsers = new Map(),
  auditLogs = [],
} = {}) {
  return {
    registry,
    profiles,
    authUsers,
    auditLogs,
    from(table) {
      if (table === 'student_registry') {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  async maybeSingle() {
                    const row = registry.get(val);
                    return { data: row ? { ...row } : null, error: null };
                  },
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
              eq(col, val) {
                return {
                  async maybeSingle() {
                    const row = profiles.get(val);
                    return { data: row ? { ...row } : null, error: null };
                  },
                };
              },
            };
          },
          async insert(payload) {
            profiles.set(payload.registration_number, { ...payload });
            return { error: null };
          },
          update(updates) {
            return {
              eq(col, val) {
                const existing = profiles.get(val);
                if (existing) {
                  profiles.set(val, { ...existing, ...updates });
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === 'admin_audit_logs') {
        return {
          async insert(payload) {
            auditLogs.push(payload);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    auth: {
      admin: {
        async createUser({ email, password, email_confirm, user_metadata }) {
          // Check if email already registered
          for (const u of authUsers.values()) {
            if (u.email === email) {
              return { data: null, error: new Error('User already registered') };
            }
          }
          const id = `user-${Math.random().toString(36).substring(2, 9)}`;
          const userObj = {
            id,
            email,
            password, // Simulated stored bcrypt hash
            email_confirmed: email_confirm ?? false,
            user_metadata: user_metadata || {},
            app_metadata: { role: 'authenticated' },
          };
          authUsers.set(id, userObj);
          return { data: { user: userObj }, error: null };
        },
        async updateUserById(id, { password, user_metadata }) {
          const user = authUsers.get(id);
          if (!user) return { data: null, error: new Error('User not found') };
          if (password) user.password = password;
          if (user_metadata) user.user_metadata = { ...user.user_metadata, ...user_metadata };
          return { data: { user }, error: null };
        },
      },
    },
  };
}

function createMockAnonSupabase(mockService) {
  return {
    auth: {
      async signInWithPassword({ email, password }) {
        let matchedUser = null;
        for (const u of mockService.authUsers.values()) {
          if (u.email.toLowerCase() === email.toLowerCase()) {
            matchedUser = u;
            break;
          }
        }
        if (!matchedUser) {
          return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
        }
        if (matchedUser.password !== password) {
          return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
        }
        return {
          data: {
            user: matchedUser,
            session: {
              access_token: `token-${matchedUser.id}`,
              refresh_token: `refresh-${matchedUser.id}`,
              expires_in: 3600,
              token_type: 'bearer',
            },
          },
          error: null,
        };
      },
      async getUser(token) {
        const userId = token.replace('token-', '');
        const user = mockService.authUsers.get(userId);
        if (!user) {
          return { data: { user: null }, error: new Error('Invalid token') };
        }
        return { data: { user }, error: null };
      },
      async resetPasswordForEmail() {
        return { data: {}, error: null };
      },
    },
  };
}

// Dispatch helper for route execution
async function dispatchRoute(path, body, { serviceSupabase, anonSupabase, headers = {}, user = null, ip = '127.0.0.1' } = {}) {
  let statusCode = 200;
  let responseBody = null;
  const resHeaders = {};

  const req = {
    body,
    serviceSupabase,
    anonSupabase,
    user,
    ip,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };

  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    setHeader(k, v) {
      resHeaders[k.toLowerCase()] = v;
    },
    json(data) {
      responseBody = data;
      return this;
    },
  };

  const layer = authStudentRouter.stack.find((l) => l.route && l.route.path === path);
  if (!layer) throw new Error(`Route ${path} not found on authStudentRouter`);
  await layer.route.stack[0].handle(req, res);

  return { statusCode, responseBody, headers: resHeaders };
}

// ==============================================================================
// 1. Eligible Student Signup
// ==============================================================================

test('1. Eligible student signup creates Auth account and pending student profile', async () => {
  const service = createMockServiceSupabase({
    registry: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        student_name: 'Rahul Sharma',
        branch: 'CSE',
        section: '8',
        academic_year: '2nd Year',
        is_eligible: true,
        official_email: '251fa04g44@university.edu',
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  const res = await dispatchRoute('/register-student', {
    registrationNumber: '251FA04G44',
    fullName: 'Rahul Sharma',
    email: '251fa04g44@university.edu',
    // Password omitted: should default to registration number
  }, { serviceSupabase: service, anonSupabase: anon });

  assert.equal(res.statusCode, 201, 'Signup must return 201 Created');
  assert.equal(res.responseBody.success, true);
  assert.equal(res.responseBody.student.registration_number, '251FA04G44');
  assert.equal(res.responseBody.student.is_active, true, 'Account is active directly for eligible student');

  // Verify profile in DB
  const profile = service.profiles.get('251FA04G44');
  assert.ok(profile, 'Profile record must be inserted');
  assert.equal(profile.email_verified, true);
  assert.equal(profile.is_active, true);
});

// ==============================================================================
// 2. Registration Number Used as Initial Password
// ==============================================================================

test('2. Registration number is set as initial Supabase Auth password when omitted during signup', async () => {
  const service = createMockServiceSupabase({
    registry: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        student_name: 'Rahul Sharma',
        branch: 'CSE',
        section: '8',
        academic_year: '2nd Year',
        is_eligible: true,
        official_email: '251fa04g44@university.edu',
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  await dispatchRoute('/register-student', {
    registrationNumber: '251FA04G44',
    fullName: 'Rahul Sharma',
    email: '251fa04g44@university.edu',
  }, { serviceSupabase: service, anonSupabase: anon });

  const authUser = Array.from(service.authUsers.values())[0];
  assert.ok(authUser, 'Auth account must be created');
  assert.equal(authUser.password, '251FA04G44', 'Initial password must equal normalized registration number');
  assert.equal(authUser.user_metadata.initial_password_used, true, 'Initial password metadata flag must be set');
});

// ==============================================================================
// 3. Invalid Registry Details Rejected
// ==============================================================================

test('3. Invalid registry details (unknown reg number or mismatched name) are rejected', async () => {
  const service = createMockServiceSupabase({
    registry: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        student_name: 'Rahul Sharma',
        is_eligible: true,
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  // Unknown registration number
  const unknownRes = await dispatchRoute('/register-student', {
    registrationNumber: 'UNKNOWN999',
    fullName: 'Jane Doe',
    email: 'jane@university.edu',
  }, { serviceSupabase: service, anonSupabase: anon });
  assert.equal(unknownRes.statusCode, 400);
  assert.equal(unknownRes.responseBody.error, 'Registration Ineligible');

  // Name mismatch
  const nameMismatchRes = await dispatchRoute('/register-student', {
    registrationNumber: '251FA04G44',
    fullName: 'Completely Different Name',
    email: '251fa04g44@university.edu',
  }, { serviceSupabase: service, anonSupabase: anon });
  assert.equal(nameMismatchRes.statusCode, 400);
  assert.equal(nameMismatchRes.responseBody.error, 'Registration Ineligible');
});

// ==============================================================================
// 4. Duplicate Registration Blocked
// ==============================================================================

test('4. Duplicate registration for already registered registration number is blocked', async () => {
  const service = createMockServiceSupabase({
    registry: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        student_name: 'Rahul Sharma',
        is_eligible: true,
      }],
    ]),
    profiles: new Map([
      ['251FA04G44', {
        user_id: 'existing-user-uuid',
        registration_number: '251FA04G44',
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  const res = await dispatchRoute('/register-student', {
    registrationNumber: '251FA04G44',
    fullName: 'Rahul Sharma',
    email: 'rahul.new@university.edu',
  }, { serviceSupabase: service, anonSupabase: anon });

  assert.equal(res.statusCode, 400);
  assert.match(res.responseBody.message, /already been registered/i);
});

// ==============================================================================
// 5. Ineligible Student Login Blocked
// ==============================================================================

test('5. Login fails with 403 Account Ineligible if student registry record is ineligible', async () => {
  const service = createMockServiceSupabase({
    registry: new Map([
      ['251FA04G44', { registration_number: '251FA04G44', is_eligible: false, student_name: 'Rahul' }],
    ]),
    profiles: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        personal_email: 'rahul@university.edu',
        email_verified: true,
        verification_status: 'verified',
        is_active: false,
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  const res = await dispatchRoute('/student-login', {
    registrationNumber: '251FA04G44',
    password: '251FA04G44',
  }, { serviceSupabase: service, anonSupabase: anon });

  assert.equal(res.statusCode, 403);
  assert.equal(res.responseBody.error, 'Account Ineligible');
});

// ==============================================================================
// 6. Suspended Account Blocked
// ==============================================================================

test('6. Login fails with 403 Account Inactive if student account is suspended', async () => {
  const service = createMockServiceSupabase({
    registry: new Map([
      ['251FA04G44', { registration_number: '251FA04G44', is_eligible: true, student_name: 'Rahul' }],
    ]),
    profiles: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        personal_email: 'rahul@university.edu',
        email_verified: true,
        verification_status: 'suspended',
        is_active: false,
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  const res = await dispatchRoute('/student-login', {
    registrationNumber: '251FA04G44',
    password: '251FA04G44',
  }, { serviceSupabase: service, anonSupabase: anon });

  assert.equal(res.statusCode, 403);
  assert.equal(res.responseBody.error, 'Account Inactive');
});

// ==============================================================================
// 7. Login with Initial Password
// ==============================================================================

test('7. Login with registration number as initial password succeeds when verified and active', async () => {
  const service = createMockServiceSupabase({
    registry: new Map([
      ['251FA04G44', { registration_number: '251FA04G44', is_eligible: true, student_name: 'Rahul Sharma', branch: 'CSE', section: '8', academic_year: '2nd Year' }],
    ]),
    profiles: new Map([
      ['251FA04G44', {
        user_id: 'user-auth-uuid-100',
        registration_number: '251FA04G44',
        personal_email: 'rahul@university.edu',
        student_name: 'Rahul Sharma',
        branch: 'CSE',
        section: '8',
        academic_year: '2nd Year',
        email_verified: true,
        verification_status: 'verified',
        is_active: true,
      }],
    ]),
    authUsers: new Map([
      ['user-auth-uuid-100', {
        id: 'user-auth-uuid-100',
        email: 'rahul@university.edu',
        password: '251FA04G44', // Initial password
        user_metadata: { registration_number: '251FA04G44', initial_password_used: true },
        app_metadata: { role: 'authenticated' },
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  const res = await dispatchRoute('/student-login', {
    registrationNumber: '251FA04G44',
    password: '251FA04G44',
  }, { serviceSupabase: service, anonSupabase: anon });

  assert.equal(res.statusCode, 200);
  assert.equal(res.responseBody.success, true);
  assert.ok(res.responseBody.session.access_token);
  assert.equal(res.responseBody.user.initial_password_used, true);
});

// ==============================================================================
// 8. Successful Password Change
// ==============================================================================

test('8. Authenticated student can change password from initial registration number to personal password', async () => {
  const authUser = {
    id: 'user-auth-uuid-100',
    email: 'rahul@university.edu',
    password: '251FA04G44',
    user_metadata: { registration_number: '251FA04G44', initial_password_used: true },
    app_metadata: { role: 'authenticated' },
  };

  const service = createMockServiceSupabase({
    authUsers: new Map([['user-auth-uuid-100', authUser]]),
  });
  const anon = createMockAnonSupabase(service);

  const res = await dispatchRoute('/change-password', {
    currentPassword: '251FA04G44',
    newPassword: 'SuperPersonalPassword#99',
    confirmPassword: 'SuperPersonalPassword#99',
  }, {
    serviceSupabase: service,
    anonSupabase: anon,
    headers: { authorization: 'Bearer token-user-auth-uuid-100' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.responseBody.success, true);

  // Check updated Auth user password in DB
  const updatedUser = service.authUsers.get('user-auth-uuid-100');
  assert.equal(updatedUser.password, 'SuperPersonalPassword#99');
  assert.equal(updatedUser.user_metadata.initial_password_used, false);
  assert.ok(service.auditLogs.some((l) => l.action === 'password_change'));
});

// ==============================================================================
// 9. Old Password Rejected After Change
// ==============================================================================

test('9. Old registration-number password is strictly rejected after successful password change', async () => {
  const service = createMockServiceSupabase({
    registry: new Map([
      ['251FA04G44', { registration_number: '251FA04G44', is_eligible: true, student_name: 'Rahul' }],
    ]),
    profiles: new Map([
      ['251FA04G44', {
        user_id: 'user-auth-uuid-100',
        registration_number: '251FA04G44',
        personal_email: 'rahul@university.edu',
        email_verified: true,
        verification_status: 'verified',
        is_active: true,
      }],
    ]),
    authUsers: new Map([
      ['user-auth-uuid-100', {
        id: 'user-auth-uuid-100',
        email: 'rahul@university.edu',
        password: 'SuperPersonalPassword#99', // New password
        user_metadata: { registration_number: '251FA04G44', initial_password_used: false },
        app_metadata: { role: 'authenticated' },
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  // Attempt login with OLD initial password
  const oldLoginRes = await dispatchRoute('/student-login', {
    registrationNumber: '251FA04G44',
    password: '251FA04G44',
  }, { serviceSupabase: service, anonSupabase: anon });

  assert.equal(oldLoginRes.statusCode, 401);
  assert.equal(oldLoginRes.responseBody.error, 'Invalid Credentials');

  // Attempt login with NEW password
  const newLoginRes = await dispatchRoute('/student-login', {
    registrationNumber: '251FA04G44',
    password: 'SuperPersonalPassword#99',
  }, { serviceSupabase: service, anonSupabase: anon });

  assert.equal(newLoginRes.statusCode, 200);
  assert.equal(newLoginRes.responseBody.success, true);
  assert.equal(newLoginRes.responseBody.user.initial_password_used, false);
});

// ==============================================================================
// 10. Incorrect Current Password Rejected
// ==============================================================================

test('10. Incorrect current password during password change is rejected with 400', async () => {
  const authUser = {
    id: 'user-auth-uuid-100',
    email: 'rahul@university.edu',
    password: 'SuperPersonalPassword#99',
    user_metadata: { registration_number: '251FA04G44' },
    app_metadata: { role: 'authenticated' },
  };

  const service = createMockServiceSupabase({
    authUsers: new Map([['user-auth-uuid-100', authUser]]),
  });
  const anon = createMockAnonSupabase(service);

  const res = await dispatchRoute('/change-password', {
    currentPassword: 'WrongCurrentPassword!',
    newPassword: 'AnotherPassword#123',
    confirmPassword: 'AnotherPassword#123',
  }, {
    serviceSupabase: service,
    anonSupabase: anon,
    headers: { authorization: 'Bearer token-user-auth-uuid-100' },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.responseBody.error, 'Invalid Current Password');

  // Confirm password was not modified
  assert.equal(authUser.password, 'SuperPersonalPassword#99');
});

// ==============================================================================
// 11. Password Reset (Anti-Enumeration)
// ==============================================================================

test('11. Password reset endpoint accepts registration number or email without revealing existence', async () => {
  const service = createMockServiceSupabase({
    profiles: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        personal_email: 'rahul@university.edu',
        is_active: true,
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  // Existing registration number
  const res1 = await dispatchRoute('/forgot-password', {
    identifier: '251FA04G44',
  }, { serviceSupabase: service, anonSupabase: anon });
  assert.equal(res1.statusCode, 200);
  assert.equal(res1.responseBody.success, true);

  // Non-existing registration number (MUST return identical success response)
  const res2 = await dispatchRoute('/forgot-password', {
    identifier: 'NONEXISTENT999',
  }, { serviceSupabase: service, anonSupabase: anon });
  assert.equal(res2.statusCode, 200);
  assert.equal(res2.responseBody.success, true);
  assert.equal(res1.responseBody.message, res2.responseBody.message);
});

// ==============================================================================
// 12. Login Rate Limiting
// ==============================================================================

test('12. Login rate limiting blocks excessive attempts with 429 Too Many Requests', async () => {
  const service = createMockServiceSupabase();
  const anon = createMockAnonSupabase(service);
  const testIp = '192.168.1.105';
  const testReg = '251FA04G44';
  const rateLimitKey = `${testIp}:${testReg}`;

  clearLoginAttempts(rateLimitKey);

  // Trigger 5 failed login attempts
  for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
    const res = await dispatchRoute('/student-login', {
      registrationNumber: testReg,
      password: 'wrong-password',
    }, { serviceSupabase: service, anonSupabase: anon, ip: testIp });
    assert.equal(res.statusCode, 401);
  }

  // 6th attempt must be blocked by rate limit
  const blockedRes = await dispatchRoute('/student-login', {
    registrationNumber: testReg,
    password: 'any-password',
  }, { serviceSupabase: service, anonSupabase: anon, ip: testIp });

  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.responseBody.error, 'Too Many Requests');
  assert.ok(blockedRes.headers['retry-after']);

  clearLoginAttempts(rateLimitKey);
});

// ==============================================================================
// 13. Activation Security Invariants
// ==============================================================================

test('13. Accounts activate when eligible; suspended, rejected, or ineligible accounts fail closed', () => {
  // Eligible students activate
  assert.equal(isAccountActive({ verificationStatus: 'verified', isEligible: true }), true);
  assert.equal(isAccountActive({ verificationStatus: 'pending', isEligible: true }), true);

  // Ineligible or compromised statuses fail closed
  assert.equal(isAccountActive({ verificationStatus: 'suspended', isEligible: true }), false);
  assert.equal(isAccountActive({ verificationStatus: 'rejected', isEligible: true }), false);
  assert.equal(isAccountActive({ verificationStatus: 'verified', isEligible: false }), false);
});

// ==============================================================================
// 14. Existing Users' Passwords Never Overwritten
// ==============================================================================

test('14. Submitting registration for an existing user never overwrites their established password', async () => {
  const establishedPassword = 'MySecretExistingPassword#777';
  const service = createMockServiceSupabase({
    registry: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        student_name: 'Rahul Sharma',
        is_eligible: true,
      }],
    ]),
    profiles: new Map([
      ['251FA04G44', {
        user_id: 'user-existing-id-777',
        registration_number: '251FA04G44',
        personal_email: 'rahul@university.edu',
      }],
    ]),
    authUsers: new Map([
      ['user-existing-id-777', {
        id: 'user-existing-id-777',
        email: 'rahul@university.edu',
        password: establishedPassword,
      }],
    ]),
  });
  const anon = createMockAnonSupabase(service);

  // Attempt to re-register
  const res = await dispatchRoute('/register-student', {
    registrationNumber: '251FA04G44',
    fullName: 'Rahul Sharma',
    email: 'rahul@university.edu',
    password: 'attemptedNewPassword!',
  }, { serviceSupabase: service, anonSupabase: anon });

  assert.equal(res.statusCode, 400);

  // Verify the stored password was completely untouched
  const user = service.authUsers.get('user-existing-id-777');
  assert.equal(user.password, establishedPassword, 'Existing user password must remain strictly unmodified');
});

// ==============================================================================
// Test Runner
// ==============================================================================

async function run() {
  console.log('--- FindAI Simplified Student Authentication & Password Management Tests ---');
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
  console.log(`\nAll ${passed}/${testsQueue.length} Simplified Authentication tests passed successfully!\n`);
}

run().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});

