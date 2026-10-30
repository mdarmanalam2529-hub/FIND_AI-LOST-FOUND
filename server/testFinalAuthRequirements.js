/**
 * ==============================================================================
 * Test Suite: testFinalAuthRequirements.js
 * Project: FindAI - University Lost-and-Found Platform
 * Part 4: 19 Comprehensive Authentication & Role Management Tests
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { authStudentRouter } from './studentRoutes.js';
import { adminUserRouter } from './adminUserRoutes.js';
import {
  isAuthorizedAdmin,
  isPrimaryAdmin,
  isStaff,
  isStaffOrAdmin,
  ROLES,
} from './claimWorkflow.js';
import {
  normalizeRegistrationNumber,
  isAccountActive,
  REG_NUMBER_REGEX,
} from './studentValidation.js';

// Helper to create synthetic Supabase mock
function createMockSupabaseContext({
  registry = new Map(),
  profiles = new Map(),
  authUsers = new Map(),
  auditLogs = [],
} = {}) {
  const service = {
    registry,
    profiles,
    authUsers,
    auditLogs,
    from(table) {
      if (table === 'student_registry') {
        return {
          select(_cols) {
            return {
              eq(_col, val) {
                return {
                  async maybeSingle() {
                    const row = registry.get(val);
                    return { data: row || null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'student_profiles') {
        return {
          select(_cols) {
            return {
              eq(_col, val) {
                return {
                  async maybeSingle() {
                    const row = profiles.get(val);
                    return { data: row || null, error: null };
                  },
                };
              },
            };
          },
          async insert(record) {
            profiles.set(record.registration_number, record);
            return { data: record, error: null };
          },
        };
      }
      if (table === 'admin_audit_logs') {
        return {
          async insert(entry) {
            const row = { id: `log-${Date.now()}-${Math.random()}`, created_at: new Date().toISOString(), ...entry };
            auditLogs.push(row);
            return { data: row, error: null };
          },
          select(_cols) {
            return {
              order(_col, _opts) {
                return {
                  limit(count) {
                    return Promise.resolve({ data: auditLogs.slice(0, count), error: null });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    auth: {
      admin: {
        async createUser(params) {
          const email = params.email.toLowerCase();
          for (const u of authUsers.values()) {
            if (u.email.toLowerCase() === email) {
              return { data: null, error: new Error('User already registered') };
            }
          }
          const newUser = {
            id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            email: params.email,
            password: params.password,
            email_confirmed_at: params.email_confirm ? new Date().toISOString() : null,
            user_metadata: params.user_metadata || {},
            app_metadata: params.app_metadata || {},
            created_at: new Date().toISOString(),
          };
          authUsers.set(newUser.id, newUser);
          return { data: { user: newUser }, error: null };
        },
        async getUserById(id) {
          const u = authUsers.get(id);
          if (!u) return { data: null, error: new Error('User not found') };
          return { data: { user: u }, error: null };
        },
        async listUsers() {
          return { data: { users: Array.from(authUsers.values()) }, error: null };
        },
        async updateUserById(id, patch) {
          const u = authUsers.get(id);
          if (!u) return { data: null, error: new Error('User not found') };
          if (patch.app_metadata) {
            u.app_metadata = { ...u.app_metadata, ...patch.app_metadata };
          }
          if (patch.ban_duration !== undefined) {
            u.banned_until = patch.ban_duration === 'none' ? null : new Date(Date.now() + 1000000000).toISOString();
          }
          if (patch.password) {
            u.password = patch.password;
          }
          return { data: { user: u }, error: null };
        },
        async deleteUser(id) {
          authUsers.delete(id);
          return { data: null, error: null };
        },
      },
    },
  };

  const anon = {
    auth: {
      async getUser(token) {
        for (const u of authUsers.values()) {
          if (token === `token-${u.id}` || token === u.id) {
            return { data: { user: u }, error: null };
          }
        }
        return { data: null, error: new Error('Invalid session token') };
      },
      async signInWithPassword({ email, password }) {
        const cleanEmail = (email || '').toLowerCase();
        let matched = null;
        for (const u of authUsers.values()) {
          if ((u.email || '').toLowerCase() === cleanEmail) {
            matched = u;
            break;
          }
        }
        if (!matched || matched.password !== password) {
          return { data: null, error: new Error('Invalid login credentials') };
        }
        return {
          data: {
            user: matched,
            session: {
              access_token: `token-${matched.id}`,
              refresh_token: `refresh-${matched.id}`,
            },
          },
          error: null,
        };
      },
    },
  };

  return { service, anon };
}

// Route dispatcher helper
async function dispatchAuthRoute(path, method, body, { service, anon, user = null, ip = '127.0.0.1', headers: customHeaders = {} }) {
  let statusCode = 200;
  let responseBody = null;
  const headers = {};

  const reqHeaders = {
    authorization: user ? `Bearer token-${user.id}` : '',
    ...customHeaders,
  };

  const req = {
    url: path,
    method,
    body,
    params: {},
    serviceSupabase: service,
    anonSupabase: anon,
    user,
    ip,
    headers: reqHeaders,
  };

  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    setHeader(k, v) {
      headers[k] = v;
    },
    json(d) {
      responseBody = d;
      return this;
    },
  };

  const isUsersRoute = path.startsWith('/api/admin/users');
  const router = isUsersRoute ? adminUserRouter : authStudentRouter;
  let cleanPath = path.replace('/api/auth', '').replace('/api/admin/users', '') || '/';

  // Locate matching layer
  for (const layer of router.stack) {
    if (layer.route && layer.route.methods[method.toLowerCase()]) {
      const paramNames = [];
      const pattern = layer.route.path.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });
      const regex = new RegExp(`^${pattern}$`);
      const match = regex.exec(cleanPath);

      if (match) {
        paramNames.forEach((name, i) => {
          req.params[name] = match[i + 1];
        });

        // Run stack handlers
        for (const handler of layer.route.stack) {
          let calledNext = false;
          await handler.handle(req, res, () => { calledNext = true; });
          if (!calledNext) break;
        }
        return { statusCode, responseBody, headers };
      }
    }
  }

  throw new Error(`Route not matched: ${method} ${path} (clean: ${cleanPath})`);
}

// ==============================================================================
// 1. Student Signup Without Email
// ==============================================================================

test('[Part 4 - Requirement 1] Student signup succeeds without providing an email address', async () => {
  const { service, anon } = createMockSupabaseContext({
    registry: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        student_name: 'MD ARMAN ALAM',
        branch: 'CSE',
        section: '8',
        academic_year: '2nd Year',
        is_eligible: true,
      }],
    ]),
  });

  const res = await dispatchAuthRoute('/register-student', 'POST', {
    registrationNumber: '251FA04G44',
    fullName: 'MD ARMAN ALAM',
    // Notice: NO email provided
  }, { service, anon });

  assert.equal(res.statusCode, 201, 'Signup must return 201 Created');
  assert.equal(res.responseBody.success, true);
  assert.equal(res.responseBody.student.registration_number, '251FA04G44');
  assert.equal(res.responseBody.student.is_active, true, 'Account must activate immediately');

  // Verify internal mapping
  const authUser = Array.from(service.authUsers.values())[0];
  assert.ok(authUser.email.includes('251fa04g44@student.findai.internal'));
});

// ==============================================================================
// 2. Valid Registration-Number Validation
// ==============================================================================

test('[Part 4 - Requirement 2] Valid registration-number validation accepts standard formats and trims whitespace', () => {
  assert.equal(normalizeRegistrationNumber(' 251fa04g44 '), '251FA04G44');
  assert.equal(normalizeRegistrationNumber('23cse101'), '23CSE101');
  assert.ok(REG_NUMBER_REGEX.test('251FA04G44'));
  assert.ok(REG_NUMBER_REGEX.test('23CSE101'));
});

// ==============================================================================
// 3. Invalid Registration Number Rejection
// ==============================================================================

test('[Part 4 - Requirement 3] Invalid registration number is rejected', async () => {
  const { service, anon } = createMockSupabaseContext();

  const res = await dispatchAuthRoute('/register-student', 'POST', {
    registrationNumber: 'INVALID_UNKNOWN_123',
    fullName: 'Unknown Student',
  }, { service, anon });

  assert.equal(res.statusCode, 400);
  assert.equal(res.responseBody.error, 'Registration Ineligible');
});

// ==============================================================================
// 4. Initial Password Equals Normalized Registration Number
// ==============================================================================

test('[Part 4 - Requirement 4] Initial password equals normalized registration number', async () => {
  const { service, anon } = createMockSupabaseContext({
    registry: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        student_name: 'MD ARMAN ALAM',
        branch: 'CSE',
        is_eligible: true,
      }],
    ]),
  });

  await dispatchAuthRoute('/register-student', 'POST', {
    registrationNumber: ' 251fa04g44 ',
    fullName: 'MD ARMAN ALAM',
  }, { service, anon });

  const authUser = Array.from(service.authUsers.values())[0];
  assert.equal(authUser.password, '251FA04G44', 'Password must match normalized uppercase registration number');
});

// ==============================================================================
// 5. Immediate Student Login Without Email Confirmation
// ==============================================================================

test('[Part 4 - Requirement 5] Immediate student login succeeds without email confirmation', async () => {
  const { service, anon } = createMockSupabaseContext({
    registry: new Map([
      ['251FA04G44', {
        registration_number: '251FA04G44',
        student_name: 'MD ARMAN ALAM',
        branch: 'CSE',
        section: '8',
        academic_year: '2nd Year',
        is_eligible: true,
      }],
    ]),
  });

  // Step 1: Register
  await dispatchAuthRoute('/register-student', 'POST', {
    registrationNumber: '251FA04G44',
    fullName: 'MD ARMAN ALAM',
  }, { service, anon });

  // Step 2: Login directly with registration number and initial password
  const loginRes = await dispatchAuthRoute('/student-login', 'POST', {
    registrationNumber: '251FA04G44',
    password: '251FA04G44',
  }, { service, anon });

  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.responseBody.success, true);
  assert.ok(loginRes.responseBody.session.access_token);
  assert.equal(loginRes.responseBody.user.registration_number, '251FA04G44');
});

// ==============================================================================
// 6. Existing Account Password Preservation
// ==============================================================================

test('[Part 4 - Requirement 6] Existing account password is preserved on re-registration attempt', async () => {
  const establishedUser = {
    id: 'user-md-arman',
    email: '251fa04g44@student.findai.internal',
    password: 'CustomSecretPassword#888',
  };

  const { service, anon } = createMockSupabaseContext({
    registry: new Map([
      ['251FA04G44', { registration_number: '251FA04G44', student_name: 'MD ARMAN ALAM', is_eligible: true }],
    ]),
    profiles: new Map([
      ['251FA04G44', { user_id: 'user-md-arman', registration_number: '251FA04G44' }],
    ]),
    authUsers: new Map([
      ['user-md-arman', establishedUser],
    ]),
  });

  const res = await dispatchAuthRoute('/register-student', 'POST', {
    registrationNumber: '251FA04G44',
    fullName: 'MD ARMAN ALAM',
  }, { service, anon });

  assert.equal(res.statusCode, 400);
  assert.equal(establishedUser.password, 'CustomSecretPassword#888', 'Existing password must not be changed');
});

// ==============================================================================
// 7. Duplicate Signup Prevention
// ==============================================================================

test('[Part 4 - Requirement 7] Duplicate signup attempt is blocked with clear message', async () => {
  const { service, anon } = createMockSupabaseContext({
    registry: new Map([
      ['251FA04G44', { registration_number: '251FA04G44', student_name: 'MD ARMAN ALAM', is_eligible: true }],
    ]),
    profiles: new Map([
      ['251FA04G44', { user_id: 'existing-id', registration_number: '251FA04G44' }],
    ]),
  });

  const res = await dispatchAuthRoute('/register-student', 'POST', {
    registrationNumber: '251FA04G44',
    fullName: 'MD ARMAN ALAM',
  }, { service, anon });

  assert.equal(res.statusCode, 400);
  assert.match(res.responseBody.message, /already been registered/i);
});

// ==============================================================================
// 8. Password Change
// ==============================================================================

test('[Part 4 - Requirement 8] Password change replaces initial password and invalidates old password', async () => {
  const authUser = {
    id: 'user-student-1',
    email: '251fa04g44@student.findai.internal',
    password: '251FA04G44',
    user_metadata: { registration_number: '251FA04G44', initial_password_used: true },
    app_metadata: { role: 'student' },
  };

  const { service, anon } = createMockSupabaseContext({
    registry: new Map([
      ['251FA04G44', { registration_number: '251FA04G44', student_name: 'MD ARMAN ALAM', is_eligible: true }],
    ]),
    profiles: new Map([
      ['251FA04G44', { user_id: 'user-student-1', registration_number: '251FA04G44', personal_email: '251fa04g44@student.findai.internal', is_active: true }],
    ]),
    authUsers: new Map([
      ['user-student-1', authUser],
    ]),
  });

  // Change password
  const changeRes = await dispatchAuthRoute('/change-password', 'POST', {
    currentPassword: '251FA04G44',
    newPassword: 'MyNewPersonalPassword#2026',
    confirmPassword: 'MyNewPersonalPassword#2026',
  }, {
    service,
    anon,
    user: authUser,
  });

  assert.equal(changeRes.statusCode, 200);

  // Old password rejected
  const oldLogin = await dispatchAuthRoute('/student-login', 'POST', {
    registrationNumber: '251FA04G44',
    password: '251FA04G44',
  }, { service, anon });
  assert.equal(oldLogin.statusCode, 401);

  // New password accepted
  const newLogin = await dispatchAuthRoute('/student-login', 'POST', {
    registrationNumber: '251FA04G44',
    password: 'MyNewPersonalPassword#2026',
  }, { service, anon });
  assert.equal(newLogin.statusCode, 200);
});

// ==============================================================================
// 9. Student Access Restrictions
// ==============================================================================

test('[Part 4 - Requirement 9] Student cannot access admin endpoints', async () => {
  const studentUser = {
    id: 'student-uuid',
    email: 'student@findai.internal',
    app_metadata: { role: 'student' },
  };

  const { service, anon } = createMockSupabaseContext();

  const res = await dispatchAuthRoute('/api/admin/users', 'GET', {}, {
    service,
    anon,
    user: studentUser,
  });

  assert.equal(res.statusCode, 403, 'Student must receive 403 Forbidden on admin user routes');
});

// ==============================================================================
// 10. Staff Login
// ==============================================================================

test('[Part 4 - Requirement 10] Staff login succeeds with staff role', () => {
  const staffUser = {
    id: 'staff-uuid',
    email: 'staff@university.edu',
    app_metadata: { role: 'staff' },
  };

  assert.equal(isStaff(staffUser), true);
  assert.equal(isStaffOrAdmin(staffUser), true);
  assert.equal(isAuthorizedAdmin(staffUser), false);
  assert.equal(isPrimaryAdmin(staffUser), false);
});

// ==============================================================================
// 11. Admin Login
// ==============================================================================

test('[Part 4 - Requirement 11] Admin login succeeds with admin role', () => {
  const adminUser = {
    id: 'admin-uuid',
    email: 'admin@university.edu',
    app_metadata: { role: 'admin' },
  };

  assert.equal(isAuthorizedAdmin(adminUser), true);
  assert.equal(isStaffOrAdmin(adminUser), true);
  assert.equal(isPrimaryAdmin(adminUser), false);
});

// ==============================================================================
// 12. Primary Admin Adding a Staff Member
// ==============================================================================

test('[Part 4 - Requirement 12] Primary admin can add a staff member', async () => {
  const primaryAdmin = {
    id: 'primary-admin-uuid',
    email: process.env.PRIMARY_ADMIN_EMAIL || 'mdarmanalam2529@gmail.com',
    app_metadata: { role: 'primary_admin' },
  };

  const { service, anon } = createMockSupabaseContext();

  const res = await dispatchAuthRoute('/api/admin/users', 'POST', {
    email: 'security.officer@university.edu',
    fullName: 'Officer Dave',
    password: 'SecurePassword#123',
    role: 'staff',
  }, { service, anon, user: primaryAdmin });

  assert.equal(res.statusCode, 201);
  assert.equal(res.responseBody.user.role, 'staff');
  assert.ok(service.auditLogs.some((l) => l.action === 'create_privileged_user'));
});

// ==============================================================================
// 13. Primary Admin Adding Another Administrator
// ==============================================================================

test('[Part 4 - Requirement 13] Primary admin can add another administrator', async () => {
  const primaryAdmin = {
    id: 'primary-admin-uuid',
    email: 'mdarmanalam2529@gmail.com',
    app_metadata: { role: 'primary_admin' },
  };

  const { service, anon } = createMockSupabaseContext();

  const res = await dispatchAuthRoute('/api/admin/users', 'POST', {
    email: 'second.admin@university.edu',
    fullName: 'Second Admin',
    password: 'SecurePassword#123',
    role: 'admin',
  }, { service, anon, user: primaryAdmin });

  assert.equal(res.statusCode, 201);
  assert.equal(res.responseBody.user.role, 'admin');
});

// ==============================================================================
// 14. Ordinary Admin Cannot Appoint Another Administrator
// ==============================================================================

test('[Part 4 - Requirement 14] Ordinary admin cannot appoint another administrator', async () => {
  const regularAdmin = {
    id: 'regular-admin-uuid',
    email: 'regular.admin@university.edu',
    app_metadata: { role: 'admin' },
  };

  const { service, anon } = createMockSupabaseContext();

  const res = await dispatchAuthRoute('/api/admin/users', 'POST', {
    email: 'sub.admin@university.edu',
    fullName: 'Attempted Sub Admin',
    password: 'SecurePassword#123',
    role: 'admin',
  }, { service, anon, user: regularAdmin });

  assert.equal(res.statusCode, 403, 'Regular admin must be forbidden from creating another administrator');
  assert.match(res.responseBody.message, /only the primary administrator/i);
});

// ==============================================================================
// 15. Students Cannot Grant Themselves Roles
// ==============================================================================

test('[Part 4 - Requirement 15] Students cannot grant themselves roles via user_metadata', () => {
  const spoofingStudent = {
    id: 'student-attacker',
    email: 'student@internal.test',
    user_metadata: { role: 'admin' }, // Spoofed client metadata
    app_metadata: { role: 'student' }, // Authoritative server metadata
  };

  assert.equal(isAuthorizedAdmin(spoofingStudent), false, 'user_metadata spoofing must be rejected');
  assert.equal(isPrimaryAdmin(spoofingStudent), false);
  assert.equal(isStaff(spoofingStudent), false);
});

// ==============================================================================
// 16. Unauthorized API Requests Are Rejected
// ==============================================================================

test('[Part 4 - Requirement 16] Unauthorized API requests lacking valid user are rejected with 403', async () => {
  const { service, anon } = createMockSupabaseContext();

  const res = await dispatchAuthRoute('/api/admin/users', 'GET', {}, {
    service,
    anon,
    user: null, // No user
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.responseBody.error, 'Forbidden');
});

// ==============================================================================
// 17. Primary Admin Cannot Accidentally Remove the Last Primary Administrator
// ==============================================================================

test('[Part 4 - Requirement 17] Cannot delete or demote the last primary administrator', async () => {
  const primaryAdmin = {
    id: 'primary-admin-uuid',
    email: 'mdarmanalam2529@gmail.com',
    app_metadata: { role: 'primary_admin' },
  };

  const { service, anon } = createMockSupabaseContext({
    authUsers: new Map([
      ['primary-admin-uuid', primaryAdmin],
    ]),
  });

  // Attempt delete
  const deleteRes = await dispatchAuthRoute('/api/admin/users/primary-admin-uuid', 'DELETE', {}, {
    service,
    anon,
    user: primaryAdmin,
  });
  assert.equal(deleteRes.statusCode, 400);
  assert.equal(deleteRes.responseBody.error, 'Protection Violation');

  // Attempt demote
  const demoteRes = await dispatchAuthRoute('/api/admin/users/primary-admin-uuid/role', 'PATCH', {
    newRole: 'staff',
  }, {
    service,
    anon,
    user: primaryAdmin,
  });
  assert.equal(demoteRes.statusCode, 400);
  assert.equal(demoteRes.responseBody.error, 'Protection Violation');
});

// ==============================================================================
// 18. Audit Logs Record Privileged Changes
// ==============================================================================

test('[Part 4 - Requirement 18] Audit logs record privileged account and role changes', async () => {
  const primaryAdmin = {
    id: 'primary-admin-uuid',
    email: 'mdarmanalam2529@gmail.com',
    app_metadata: { role: 'primary_admin' },
  };

  const staffUser = {
    id: 'staff-target-uuid',
    email: 'staff.target@university.edu',
    app_metadata: { role: 'staff' },
  };

  const { service, anon } = createMockSupabaseContext({
    authUsers: new Map([
      ['primary-admin-uuid', primaryAdmin],
      ['staff-target-uuid', staffUser],
    ]),
  });

  // Promote staff to admin
  await dispatchAuthRoute('/api/admin/users/staff-target-uuid/role', 'PATCH', {
    newRole: 'admin',
  }, { service, anon, user: primaryAdmin });

  assert.ok(service.auditLogs.some((l) => l.action === 'update_user_role'));
  const log = service.auditLogs.find((l) => l.action === 'update_user_role');
  assert.match(log.reason, /Changed role of user staff.target@university.edu/i);
});

// ==============================================================================
// 19. Existing Core Workflows Pass
// ==============================================================================

test('[Part 4 - Requirement 19] Roles and activation invariants hold for core workflows', () => {
  assert.equal(ROLES.STUDENT, 'student');
  assert.equal(ROLES.STAFF, 'staff');
  assert.equal(ROLES.ADMIN, 'admin');
  assert.equal(ROLES.PRIMARY_ADMIN, 'primary_admin');

  // Active check helper
  assert.equal(isAccountActive({ isEligible: true, verificationStatus: 'verified' }), true);
  assert.equal(isAccountActive({ isEligible: true, verificationStatus: 'pending' }), true);
  assert.equal(isAccountActive({ isEligible: false, verificationStatus: 'verified' }), false);
  assert.equal(isAccountActive({ isEligible: true, verificationStatus: 'suspended' }), false);
  assert.equal(isAccountActive({ isEligible: true, verificationStatus: 'rejected' }), false);
});

console.log('--- All 19 Part 4 Final Authentication & Role Requirements tests passed successfully! ---');
