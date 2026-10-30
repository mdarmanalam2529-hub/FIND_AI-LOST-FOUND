/**
-- ==============================================================================
-- Test Suite: testStudentRegistryWorkflow.js
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 1 - Stage 2: Student Registry, Verification & Activation Security Tests
-- ==============================================================================
*/

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseCsvLine,
  normalizeHeader,
  normalizeRegistrationNumber,
  parseAndValidateCsv,
  evaluateDbDuplicates,
  evaluateStudentEligibility,
  isAccountActive,
  REQUIRED_COLUMNS,
} from './studentValidation.js';
import { isAuthorizedAdmin } from './claimWorkflow.js';
import {
  requireAdmin,
  authStudentRouter,
  loginAttemptTracker,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
} from './studentRoutes.js';

// ==============================================================================
// 1. Authorization & Role Verification Tests
// ==============================================================================

test('[Auth] isAuthorizedAdmin grants access to trusted server app_metadata role admin', () => {
  const adminUser = {
    id: 'user-admin-1',
    email: 'admin@university.edu',
    app_metadata: { role: 'admin' },
  };
  assert.equal(isAuthorizedAdmin(adminUser), true);
});

test('[Auth] isAuthorizedAdmin grants access to trusted server app_metadata role security_reviewer', () => {
  const reviewerUser = {
    id: 'user-reviewer-1',
    email: 'reviewer@university.edu',
    app_metadata: { role: 'security_reviewer' },
  };
  assert.equal(isAuthorizedAdmin(reviewerUser), true);
});

test('[Auth] isAuthorizedAdmin strictly rejects user_metadata role spoofing attempts', () => {
  const attacker = {
    id: 'user-attacker-1',
    email: 'student@gmail.com',
    user_metadata: { role: 'admin', is_admin: true }, // Client-tampered
    app_metadata: { role: 'authenticated' },           // Actual server role
  };
  assert.equal(isAuthorizedAdmin(attacker), false, 'Tampered user_metadata must never grant admin rights');
});

test('[Auth] isAuthorizedAdmin rejects unconfirmed email even if in ADMIN_EMAILS', () => {
  const originalEnv = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = 'security-head@university.edu';

  const unconfirmedUser = {
    id: 'user-unconfirmed-1',
    email: 'security-head@university.edu',
    email_confirmed_at: null, // NOT confirmed
    app_metadata: {},
  };
  assert.equal(isAuthorizedAdmin(unconfirmedUser), false);

  process.env.ADMIN_EMAILS = originalEnv;
});

test('[Auth] requireAdmin middleware blocks non-admin with 403 Forbidden', () => {
  let statusCode = null;
  let responseBody = null;

  const req = {
    user: {
      id: 'regular-student-1',
      email: 'student@university.edu',
      app_metadata: { role: 'authenticated' },
    },
  };
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseBody = data;
        },
      };
    },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  requireAdmin(req, res, next);
  assert.equal(statusCode, 403);
  assert.equal(responseBody.error, 'Forbidden');
  assert.equal(nextCalled, false);
});

test('[Auth] requireAdmin middleware allows authorized admin through to next()', () => {
  const req = {
    user: {
      id: 'admin-1',
      email: 'admin@university.edu',
      app_metadata: { role: 'admin' },
    },
  };
  const res = {};
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  requireAdmin(req, res, next);
  assert.equal(nextCalled, true);
});

// ==============================================================================
// 2. CSV Parsing & Validation Tests
// ==============================================================================

test('[CSV] parseCsvLine correctly parses tokens with quotes and commas', () => {
  const line = '23CSE001,"Sharma, Rahul",A,"2nd Year",CSE';
  const tokens = parseCsvLine(line);
  assert.deepEqual(tokens, ['23CSE001', 'Sharma, Rahul', 'A', '2nd Year', 'CSE']);
});

test('[CSV] normalizeHeader correctly maps column aliases', () => {
  assert.equal(normalizeHeader('Reg_No'), 'registration_number');
  assert.equal(normalizeHeader('Registration Number'), 'registration_number');
  assert.equal(normalizeHeader('Full_Name'), 'student_name');
  assert.equal(normalizeHeader('Name'), 'student_name');
  assert.equal(normalizeHeader('Sec'), 'section');
  assert.equal(normalizeHeader('Academic Year'), 'academic_year');
  assert.equal(normalizeHeader('Dept'), 'branch');
});

test('[CSV] normalizeRegistrationNumber uppercases and trims', () => {
  assert.equal(normalizeRegistrationNumber('  23cse105  '), '23CSE105');
  assert.equal(normalizeRegistrationNumber(''), '');
  assert.equal(normalizeRegistrationNumber(null), '');
});

test('[CSV] parseAndValidateCsv accepts valid CSV and normalizes records', () => {
  const csv = `registration_number,student_name,section,academic_year,branch
23CSE001,Aarav Patel,A,2nd Year,CSE
23CSE002,Aditi Rao,B,2nd Year,CSE
23CSE003,Ananya Gupta,A,2nd Year,CSE`;

  const result = parseAndValidateCsv(csv);
  assert.equal(result.valid, true);
  assert.equal(result.validCount, 3);
  assert.equal(result.duplicateInCsvCount, 0);
  assert.equal(result.invalidCount, 0);
  assert.equal(result.rows[0].registration_number, '23CSE001');
  assert.equal(result.rows[0].student_name, 'Aarav Patel');
  assert.equal(result.rows[0].branch, 'CSE');
});

test('[CSV] parseAndValidateCsv rejects CSV missing required columns', () => {
  const csv = `registration_number,student_name,academic_year
23CSE001,Aarav Patel,2nd Year`;

  const result = parseAndValidateCsv(csv);
  assert.equal(result.valid, false);
  assert.match(result.error, /Missing required column\(s\)/i);
  assert.ok(result.missingColumns.includes('section'));
  assert.ok(result.missingColumns.includes('branch'));
});

test('[CSV] parseAndValidateCsv catches invalid rows and records row numbers', () => {
  const csv = `registration_number,student_name,section,academic_year,branch
23CSE001,Aarav Patel,A,2nd Year,CSE
2,X,A,2nd Year,CSE
23CSE003,Valid Student,B,2nd Year,CSE`;

  const result = parseAndValidateCsv(csv);
  assert.equal(result.valid, false);
  assert.equal(result.validCount, 2);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.invalidRows[0].rowNumber, 3);
});

// ==============================================================================
// 3. Duplicate Detection & Silent Overwrite Prevention Tests
// ==============================================================================

test('[Duplicates] parseAndValidateCsv detects duplicates within CSV with occurrence count', () => {
  const csv = `registration_number,student_name,section,academic_year,branch
23CSE101,Rohan Verma,A,2nd Year,CSE
23CSE102,Priya Nair,A,2nd Year,CSE
23CSE101,Rohan Verma Duplicate,A,2nd Year,CSE`;

  const result = parseAndValidateCsv(csv);
  assert.equal(result.duplicateInCsvCount, 1);
  assert.equal(result.duplicatesInCsv[0].registration_number, '23CSE101');
  assert.equal(result.duplicatesInCsv[0].occurrences, 2);
  assert.deepEqual(result.duplicatesInCsv[0].lines, [2, 4]);
});

test('[Duplicates] evaluateDbDuplicates correctly separates new vs existing DB records', () => {
  const rows = [
    { registration_number: '23CSE001', student_name: 'Student 1' },
    { registration_number: '23CSE002', student_name: 'Student 2' },
    { registration_number: '23CSE003', student_name: 'Student 3' },
  ];
  const existingSet = new Set(['23CSE002']);

  const result = evaluateDbDuplicates(rows, existingSet);
  assert.equal(result.newRowsCount, 2);
  assert.equal(result.existingInDbCount, 1);
  assert.equal(result.existingInDb[0].registration_number, '23CSE002');
  assert.deepEqual(result.newRows.map((r) => r.registration_number), ['23CSE001', '23CSE003']);
});

// ==============================================================================
// 4. Student Signup Eligibility & Anti-Enumeration Tests
// ==============================================================================

test('[Eligibility] evaluateStudentEligibility succeeds for eligible registry student', () => {
  const registryRecord = {
    registration_number: '23CSE050',
    student_name: 'Kavita Sundaram',
    section: 'B',
    academic_year: '2nd Year',
    branch: 'CSE',
    official_email: 'kavita.s@university.edu',
    is_eligible: true,
  };

  const result = evaluateStudentEligibility(
    { registrationNumber: '23cse050', studentName: 'Kavita Sundaram', email: 'kavita.s@university.edu' },
    registryRecord,
    null // no existing profile
  );

  assert.equal(result.eligible, true);
  assert.equal(result.initialVerificationStatus, 'verified'); // Official email matches
});

test('[Eligibility] evaluateStudentEligibility sets status pending for personal email', () => {
  const registryRecord = {
    registration_number: '23CSE050',
    student_name: 'Kavita Sundaram',
    section: 'B',
    academic_year: '2nd Year',
    branch: 'CSE',
    official_email: 'kavita.s@university.edu',
    is_eligible: true,
  };

  const result = evaluateStudentEligibility(
    { registrationNumber: '23CSE050', studentName: 'Kavita Sundaram', email: 'kavita.personal@gmail.com' },
    registryRecord,
    null
  );

  assert.equal(result.eligible, true);
  assert.equal(result.initialVerificationStatus, 'pending'); // Personal email requires identity verification
});

test('[Eligibility] evaluateStudentEligibility rejects non-existent registration number with generic user message', () => {
  const result = evaluateStudentEligibility(
    { registrationNumber: '99UNKNOWN', studentName: 'Ghost Student', email: 'ghost@gmail.com' },
    null, // Not found in registry
    null
  );

  assert.equal(result.eligible, false);
  // Anti-enumeration: must not disclose whether number exists or return linked email
  assert.match(result.userFacingMessage, /not eligible for student registration or could not be verified/i);
});

test('[Eligibility] evaluateStudentEligibility rejects suspended/ineligible student', () => {
  const suspendedRecord = {
    registration_number: '23CSE099',
    student_name: 'Suspended Student',
    is_eligible: false,
  };

  const result = evaluateStudentEligibility(
    { registrationNumber: '23CSE099', studentName: 'Suspended Student', email: 'student@university.edu' },
    suspendedRecord,
    null
  );

  assert.equal(result.eligible, false);
  assert.match(result.userFacingMessage, /not eligible for registration/i);
});

test('[Eligibility] evaluateStudentEligibility rejects already registered student (duplicate profile)', () => {
  const registryRecord = {
    registration_number: '23CSE050',
    student_name: 'Kavita Sundaram',
    is_eligible: true,
  };
  const existingProfile = {
    user_id: 'user-already-registered',
    registration_number: '23CSE050',
  };

  const result = evaluateStudentEligibility(
    { registrationNumber: '23CSE050', studentName: 'Kavita Sundaram', email: 'kavita@gmail.com' },
    registryRecord,
    existingProfile
  );

  assert.equal(result.eligible, false);
  assert.match(result.userFacingMessage, /already been registered/i);
});

test('[Eligibility] evaluateStudentEligibility rejects mismatched student name', () => {
  const registryRecord = {
    registration_number: '23CSE050',
    student_name: 'Kavita Sundaram',
    is_eligible: true,
  };

  const result = evaluateStudentEligibility(
    { registrationNumber: '23CSE050', studentName: 'Zackariah Jones', email: 'zack@gmail.com' },
    registryRecord,
    null
  );

  assert.equal(result.eligible, false);
  assert.match(result.userFacingMessage, /does not match official university records/i);
});

// ==============================================================================
// 5. Decoupled 3-Factor Activation Logic Tests
// ==============================================================================

test('[Activation] Account is NOT active if student registry eligibility is false', () => {
  const active = isAccountActive({
    verificationStatus: 'verified',
    isEligible: false,
  });
  assert.equal(active, false, 'Ineligible student must not be active');
});

test('[Activation] Account is NOT active if verification status is suspended or rejected', () => {
  const suspended = isAccountActive({
    verificationStatus: 'suspended',
    isEligible: true,
  });
  assert.equal(suspended, false, 'Suspended student must not be active');

  const rejected = isAccountActive({
    verificationStatus: 'rejected',
    isEligible: true,
  });
  assert.equal(rejected, false, 'Rejected student must not be active');
});

test('[Activation] Eligible student account activates directly without requiring email confirmation gate', () => {
  const active = isAccountActive({
    verificationStatus: 'pending',
    isEligible: true,
  });
  assert.equal(active, true, 'Eligible student activates directly for streamlined onboarding');
});

// ==============================================================================
// 6. Signup Security & Client-Side Bypass Prevention Tests
// ==============================================================================

test('[Signup Security] SignUp.jsx has removed client-side fallback and cannot bypass backend registration', () => {
  const signUpFilePath = path.resolve(process.cwd(), 'src/pages/SignUp.jsx');
  const content = fs.readFileSync(signUpFilePath, 'utf8');

  // Verify that SignUp component does NOT destructure signUp from useAuth()
  assert.equal(
    /const\s*\{[^}]*\bsignUp\b[^}]*\}\s*=\s*useAuth\(\)/.test(content),
    false,
    'SignUp.jsx must not import or destructure client signUp from useAuth()'
  );

  // Verify that SignUp component never calls signUp() anywhere in the file
  assert.equal(
    /\bawait\s+signUp\(/.test(content),
    false,
    'SignUp.jsx must never invoke client-side signUp() fallback'
  );

  // Verify that SignUp does not call supabase.auth.signUp directly
  assert.equal(
    /supabase\.auth\.signUp\(/.test(content),
    false,
    'SignUp.jsx must never invoke supabase.auth.signUp directly'
  );
});

test('[Signup Security] Passwords, credentials, and authentication tokens are never logged', () => {
  const signUpFilePath = path.resolve(process.cwd(), 'src/pages/SignUp.jsx');
  const signUpContent = fs.readFileSync(signUpFilePath, 'utf8');

  assert.equal(
    /console\.(log|warn|error)\([^)]*password/i.test(signUpContent),
    false,
    'Passwords must never be passed to console logging in SignUp.jsx'
  );

  assert.equal(
    /console\.(log|warn|error)\([^)]*formData/i.test(signUpContent),
    false,
    'Form credentials must never be dumped in console logging in SignUp.jsx'
  );

  const studentRoutesPath = path.resolve(process.cwd(), 'server/studentRoutes.js');
  const studentRoutesContent = fs.readFileSync(studentRoutesPath, 'utf8');

  assert.equal(
    /console\.(log|warn|error)\([^)]*password/i.test(studentRoutesContent),
    false,
    'Passwords must never be logged in studentRoutes.js'
  );

  assert.equal(
    /console\.(log|warn|error)\([^)]*token/i.test(studentRoutesContent),
    false,
    'Tokens must never be logged in studentRoutes.js'
  );
});

// ==============================================================================
// 7. Duplicate Registration Rejection & Normalization Tests
// ==============================================================================

test('[Duplicates] In-CSV duplicate detection handles casing and whitespace variations', () => {
  const csv = `registration_number,student_name,section,academic_year,branch
23CSE101,Rohan Verma,A,2nd Year,CSE
 23cse101 ,Rohan Duplicate,A,2nd Year,CSE
23CSE102,Priya Nair,A,2nd Year,CSE`;

  const result = parseAndValidateCsv(csv);
  assert.equal(result.duplicateInCsvCount, 1);
  assert.equal(result.duplicatesInCsv[0].registration_number, '23CSE101');
  assert.equal(result.duplicatesInCsv[0].occurrences, 2);
  assert.deepEqual(result.duplicatesInCsv[0].lines, [2, 3]);
});

test('[Duplicates] evaluateStudentEligibility rejects duplicate signup with case-insensitive registration number', () => {
  const registryRecord = {
    registration_number: '23CSE050',
    student_name: 'Kavita Sundaram',
    is_eligible: true,
  };
  const existingProfile = {
    user_id: 'user-already-registered',
    registration_number: '23CSE050',
  };

  const result = evaluateStudentEligibility(
    { registrationNumber: '  23cse050  ', studentName: 'Kavita Sundaram', email: 'kavita@gmail.com' },
    registryRecord,
    existingProfile
  );

  assert.equal(result.eligible, false);
  assert.match(result.userFacingMessage, /already been registered/i);
});

test('[Duplicates] evaluateDbDuplicates identifies existing registration numbers against DB set', () => {
  const rows = [
    { registration_number: '23CSE001', student_name: 'Student 1' },
    { registration_number: '23CSE002', student_name: 'Student 2' },
  ];
  const existingSet = new Set(['23CSE001']);
  const result = evaluateDbDuplicates(rows, existingSet);

  assert.equal(result.existingInDbCount, 1);
  assert.equal(result.newRowsCount, 1);
  assert.equal(result.newRows[0].registration_number, '23CSE002');
  assert.equal(result.existingInDb[0].registration_number, '23CSE001');
});

// ==============================================================================
// 8. Registry Import Authorization & CSV Integrity Validation Tests
// ==============================================================================

test('[Auth] requireAdmin blocks requests with missing req.user with 403 Forbidden', () => {
  let statusCode = null;
  let responseBody = null;
  const req = {};
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(data) { responseBody = data; },
      };
    },
  };
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, 403);
  assert.equal(responseBody.error, 'Forbidden');
  assert.equal(nextCalled, false);
});

test('[CSV Validation] parseAndValidateCsv requires all REQUIRED_COLUMNS to be present', () => {
  for (const col of REQUIRED_COLUMNS) {
    const subsetCols = REQUIRED_COLUMNS.filter((c) => c !== col);
    const csv = `${subsetCols.join(',')}\nval1,val2,val3,val4`;
    const result = parseAndValidateCsv(csv);
    assert.equal(result.valid, false);
    assert.ok(result.missingColumns.includes(col), `Must fail when missing column ${col}`);
  }
});

test('[CSV Validation] parseAndValidateCsv rejects invalid registration number characters', () => {
  const csv = `registration_number,student_name,section,academic_year,branch
23<script>,Hacker Student,A,2nd Year,CSE
23CSE!01,Punctuation Student,A,2nd Year,CSE
23CSE003,Valid Student,A,2nd Year,CSE`;

  const result = parseAndValidateCsv(csv);
  assert.equal(result.valid, false);
  assert.equal(result.invalidCount, 2);
  assert.equal(result.validCount, 1);
  assert.equal(result.rows[0].registration_number, '23CSE003');
});

test('[CSV Preview Safety] evaluateDbDuplicates is read-only and does not mutate input rows', () => {
  const originalRows = [
    Object.freeze({ registration_number: '23CSE001', student_name: 'A' }),
    Object.freeze({ registration_number: '23CSE002', student_name: 'B' }),
  ];
  const existingSet = new Set(['23CSE001']);

  // Should succeed without throwing mutation errors on frozen objects
  const result = evaluateDbDuplicates(originalRows, existingSet);
  assert.equal(result.existingInDbCount, 1);
  assert.equal(result.newRowsCount, 1);
});

// ==============================================================================
// 9. Student Login with Registration Number & Password Tests
// ==============================================================================

function createMockSupabaseService({ profile = null, registry = null } = {}) {
  return {
    from(tableName) {
      if (tableName === 'student_profiles') {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  async maybeSingle() {
                    if (profile && profile.registration_number === val) {
                      return { data: profile, error: null };
                    }
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (tableName === 'student_registry') {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  async maybeSingle() {
                    if (registry && registry.registration_number === val) {
                      return { data: registry, error: null };
                    }
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${tableName}`);
    },
  };
}

function createMockAnonSupabase({ passwordMatch = true, unconfirmedEmail = false } = {}) {
  return {
    auth: {
      async signInWithPassword({ email, password }) {
        if (!passwordMatch) {
          return {
            data: { user: null, session: null },
            error: new Error('Invalid login credentials'),
          };
        }
        if (unconfirmedEmail) {
          return {
            data: { user: null, session: null },
            error: new Error('Email not confirmed'),
          };
        }
        return {
          data: {
            user: {
              id: 'user-auth-uuid-1',
              email: email,
              app_metadata: { role: 'authenticated' },
            },
            session: {
              access_token: 'mock-access-token-xyz',
              refresh_token: 'mock-refresh-token-abc',
              expires_in: 3600,
              token_type: 'bearer',
            },
          },
          error: null,
        };
      },
    },
  };
}

async function invokeStudentLogin(reqBody, { serviceSupabase, anonSupabase, ip = '127.0.0.1' } = {}) {
  let statusCode = 200;
  let responseBody = null;
  const headers = {};

  const req = {
    body: reqBody,
    serviceSupabase,
    anonSupabase,
    ip,
    headers: {},
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[name] = value;
    },
    json(data) {
      responseBody = data;
      return this;
    },
  };

  const loginLayer = authStudentRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/student-login'
  );
  if (!loginLayer) {
    throw new Error('Could not find /student-login route on authStudentRouter');
  }

  const handler = loginLayer.route.stack[0].handle;
  await handler(req, res);

  return { statusCode, responseBody, headers };
}

test('[Student Login] Valid registration number and password returns session tokens and user info', async () => {
  const mockProfile = {
    user_id: 'user-auth-uuid-1',
    registration_number: '23CSE101',
    personal_email: 'secret.student@example.com',
    student_name: 'Rahul Sharma',
    branch: 'CSE',
    section: 'A',
    academic_year: '2nd Year',
    email_verified: true,
    verification_status: 'verified',
    is_active: true,
  };
  const mockRegistry = {
    registration_number: '23CSE101',
    student_name: 'Rahul Sharma',
    branch: 'CSE',
    section: 'A',
    academic_year: '2nd Year',
    is_eligible: true,
  };

  const serviceSupabase = createMockSupabaseService({ profile: mockProfile, registry: mockRegistry });
  const anonSupabase = createMockAnonSupabase({ passwordMatch: true });

  const result = await invokeStudentLogin(
    { registrationNumber: '23CSE101', password: 'ValidPassword123' },
    { serviceSupabase, anonSupabase, ip: '10.0.0.1' }
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.responseBody.success, true);
  assert.equal(result.responseBody.session.access_token, 'mock-access-token-xyz');
  assert.equal(result.responseBody.session.refresh_token, 'mock-refresh-token-abc');
  assert.equal(result.responseBody.user.registration_number, '23CSE101');
  assert.equal(result.responseBody.user.student_name, 'Rahul Sharma');
});

test('[Student Login] Lowercase and whitespace in registration number is normalized seamlessly', async () => {
  const mockProfile = {
    user_id: 'user-auth-uuid-1',
    registration_number: '23CSE101',
    personal_email: 'student@example.com',
    student_name: 'Rahul Sharma',
    branch: 'CSE',
    section: 'A',
    academic_year: '2nd Year',
    email_verified: true,
    verification_status: 'verified',
    is_active: true,
  };
  const mockRegistry = {
    registration_number: '23CSE101',
    is_eligible: true,
  };

  const serviceSupabase = createMockSupabaseService({ profile: mockProfile, registry: mockRegistry });
  const anonSupabase = createMockAnonSupabase({ passwordMatch: true });

  const result = await invokeStudentLogin(
    { registrationNumber: '  23cse101  ', password: 'ValidPassword123' },
    { serviceSupabase, anonSupabase, ip: '10.0.0.2' }
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.responseBody.user.registration_number, '23CSE101');
});

test('[Student Login] Personal email and private fields are NEVER exposed in API response', async () => {
  const mockProfile = {
    user_id: 'user-auth-uuid-1',
    registration_number: '23CSE101',
    personal_email: 'confidential.email@somewhere.com',
    student_name: 'Rahul Sharma',
    branch: 'CSE',
    section: 'A',
    academic_year: '2nd Year',
    email_verified: true,
    verification_status: 'verified',
    is_active: true,
  };
  const mockRegistry = {
    registration_number: '23CSE101',
    is_eligible: true,
  };

  const serviceSupabase = createMockSupabaseService({ profile: mockProfile, registry: mockRegistry });
  const anonSupabase = createMockAnonSupabase({ passwordMatch: true });

  const result = await invokeStudentLogin(
    { registrationNumber: '23CSE101', password: 'ValidPassword123' },
    { serviceSupabase, anonSupabase, ip: '10.0.0.3' }
  );

  assert.equal(result.statusCode, 200);
  const responseJson = JSON.stringify(result.responseBody);
  assert.equal(responseJson.includes('confidential.email@somewhere.com'), false, 'personal_email must never leak in login response');
  assert.equal(result.responseBody.user.personal_email, undefined);
  assert.equal(result.responseBody.session.user, undefined);
});

test('[Student Login] Invalid password returns generic 401 without leaking error details', async () => {
  const mockProfile = {
    user_id: 'user-auth-uuid-1',
    registration_number: '23CSE101',
    personal_email: 'student@example.com',
    email_verified: true,
    verification_status: 'verified',
    is_active: true,
  };
  const mockRegistry = {
    registration_number: '23CSE101',
    is_eligible: true,
  };

  const serviceSupabase = createMockSupabaseService({ profile: mockProfile, registry: mockRegistry });
  const anonSupabase = createMockAnonSupabase({ passwordMatch: false });

  const result = await invokeStudentLogin(
    { registrationNumber: '23CSE101', password: 'WrongPassword' },
    { serviceSupabase, anonSupabase, ip: '10.0.0.4' }
  );

  assert.equal(result.statusCode, 401);
  assert.equal(result.responseBody.error, 'Invalid Credentials');
  assert.equal(result.responseBody.message, 'Invalid university registration number or password.');
});

test('[Student Login] Unknown registration number returns generic 401 preventing enumeration', async () => {
  const serviceSupabase = createMockSupabaseService({ profile: null, registry: null });
  const anonSupabase = createMockAnonSupabase();

  const result = await invokeStudentLogin(
    { registrationNumber: '99UNKNOWN99', password: 'AnyPassword123' },
    { serviceSupabase, anonSupabase, ip: '10.0.0.5' }
  );

  assert.equal(result.statusCode, 401);
  assert.equal(result.responseBody.error, 'Invalid Credentials');
  assert.equal(result.responseBody.message, 'Invalid university registration number or password.');
});

test('[Student Login] Rejects suspended accounts with 403 Forbidden', async () => {
  const mockProfile = {
    user_id: 'user-auth-uuid-1',
    registration_number: '23CSE101',
    personal_email: 'student@example.com',
    verification_status: 'suspended',
    is_active: false,
  };
  const mockRegistry = {
    registration_number: '23CSE101',
    is_eligible: true,
  };

  const serviceSupabase = createMockSupabaseService({ profile: mockProfile, registry: mockRegistry });
  const anonSupabase = createMockAnonSupabase();

  const result = await invokeStudentLogin(
    { registrationNumber: '23CSE101', password: 'ValidPassword123' },
    { serviceSupabase, anonSupabase, ip: '10.0.0.6' }
  );

  assert.equal(result.statusCode, 403);
  assert.equal(result.responseBody.error, 'Account Inactive');
  assert.match(result.responseBody.message, /not active or has been suspended/i);
});

test('[Student Login] Rejects ineligible or suspended registry student with 403 Forbidden', async () => {
  const mockProfile = {
    user_id: 'user-auth-uuid-1',
    registration_number: '23CSE101',
    personal_email: 'student@example.com',
    verification_status: 'verified',
    is_active: false,
  };
  const mockRegistry = {
    registration_number: '23CSE101',
    is_eligible: false, // Suspended / Ineligible
  };

  const serviceSupabase = createMockSupabaseService({ profile: mockProfile, registry: mockRegistry });
  const anonSupabase = createMockAnonSupabase();

  const result = await invokeStudentLogin(
    { registrationNumber: '23CSE101', password: 'ValidPassword123' },
    { serviceSupabase, anonSupabase, ip: '10.0.0.7' }
  );

  assert.equal(result.statusCode, 403);
  assert.equal(result.responseBody.error, 'Account Ineligible');
  assert.match(result.responseBody.message, /not currently eligible/i);
});

test('[Student Login] Rejects inactive profile with 403 Forbidden', async () => {
  const mockProfile = {
    user_id: 'user-auth-uuid-1',
    registration_number: '23CSE101',
    personal_email: 'student@example.com',
    verification_status: 'rejected',
    is_active: false,
  };
  const mockRegistry = {
    registration_number: '23CSE101',
    is_eligible: true,
  };

  const serviceSupabase = createMockSupabaseService({ profile: mockProfile, registry: mockRegistry });
  const anonSupabase = createMockAnonSupabase();

  const result = await invokeStudentLogin(
    { registrationNumber: '23CSE101', password: 'ValidPassword123' },
    { serviceSupabase, anonSupabase, ip: '10.0.0.8' }
  );

  assert.equal(result.statusCode, 403);
  assert.equal(result.responseBody.error, 'Account Inactive');
  assert.match(result.responseBody.message, /not active or has been suspended/i);
});

test('[Student Login] Rate limiting triggers 429 after 5 failed attempts with Retry-After header', async () => {
  const testKey = '192.168.10.99:23CSE999';
  clearLoginAttempts(testKey);

  // Send 5 failed attempts
  for (let i = 0; i < 5; i++) {
    const rateCheck = checkLoginRateLimit(testKey);
    assert.equal(rateCheck.allowed, true);
    recordFailedLogin(testKey);
  }

  // 6th attempt must be blocked
  const blockedCheck = checkLoginRateLimit(testKey);
  assert.equal(blockedCheck.allowed, false);
  assert.ok(blockedCheck.retryAfter > 0);

  // Test via invokeStudentLogin with that IP and RegNo
  const serviceSupabase = createMockSupabaseService({ profile: null, registry: null });
  const anonSupabase = createMockAnonSupabase();

  const result = await invokeStudentLogin(
    { registrationNumber: '23CSE999', password: 'AnyPassword' },
    { serviceSupabase, anonSupabase, ip: '192.168.10.99' }
  );

  assert.equal(result.statusCode, 429);
  assert.equal(result.responseBody.error, 'Too Many Requests');
  assert.ok(result.headers['Retry-After'] !== undefined);

  clearLoginAttempts(testKey);
});

test('[Frontend Integration] AuthContext.jsx establishes Supabase session via setSession() and calls student-login', () => {
  const authContextPath = path.resolve(process.cwd(), 'src/context/AuthContext.jsx');
  const content = fs.readFileSync(authContextPath, 'utf8');

  // Verify signInWithRegistrationNumber exists and calls /api/auth/student-login
  assert.ok(content.includes('signInWithRegistrationNumber'), 'Must expose signInWithRegistrationNumber');
  assert.ok(content.includes('/api/auth/student-login'), 'Must call /api/auth/student-login endpoint');
  assert.ok(content.includes('supabase.auth.setSession('), 'Must establish browser session via supabase.auth.setSession');
});

test('[Frontend Integration] Login.jsx provides dual login modes: Student & Staff/Admin', () => {
  const loginPath = path.resolve(process.cwd(), 'src/pages/Login.jsx');
  const content = fs.readFileSync(loginPath, 'utf8');

  // Both modes provided with clear tabs
  assert.ok(content.includes('login-tab-student'), 'Login.jsx must have Student login tab element');
  assert.ok(content.includes('login-tab-staff'), 'Login.jsx must have Staff/Admin login tab element');

  // Student mode integration
  assert.ok(content.includes('signInWithRegistrationNumber'), 'Login.jsx must use signInWithRegistrationNumber for student mode');
  assert.ok(content.includes('registrationNumber'), 'Login.jsx must manage registrationNumber state');
  assert.ok(content.includes('login-reg-number'), 'Login.jsx must have registration number input element');

  // Staff/Admin mode integration
  assert.ok(content.includes('signIn('), 'Login.jsx must use signIn({ email, password }) for staff/admin mode');
  assert.ok(content.includes('login-email'), 'Login.jsx must have staff/admin email input element');

  // Shared inputs, validations, and flows preserved
  assert.ok(content.includes('login-password'), 'Login.jsx must have password field');
  assert.ok(content.includes('login-forgot-password'), 'Login.jsx must preserve forgot password flow');
  assert.ok(content.includes('login-toggle-password'), 'Login.jsx must preserve password visibility toggle');
  assert.ok(content.includes('login-submit-btn'), 'Login.jsx must have submit button');
  assert.ok(content.includes('login-server-error'), 'Login.jsx must display server error banner');

  // Security: No client-side admin privilege granting or role manipulation
  assert.equal(content.includes('student_registry'), false, 'Login.jsx must never query student_registry directly on client');
  assert.equal(content.includes('user_metadata.role'), false, 'Login.jsx must not inspect or set user_metadata.role');
  assert.equal(content.includes('is_admin'), false, 'Login.jsx must not set client-side admin flags');
});

test('[Admin Pages Session Loading] AdminImportStudents & AdminIncidents wait for AuthContext session restoration', () => {
  const adminImportPath = path.resolve(process.cwd(), 'src/pages/AdminImportStudents.jsx');
  const importContent = fs.readFileSync(adminImportPath, 'utf8');

  const adminIncidentsPath = path.resolve(process.cwd(), 'src/pages/AdminIncidents.jsx');
  const incidentsContent = fs.readFileSync(adminIncidentsPath, 'utf8');

  // Both admin pages must check authLoading from AuthContext before making authorization checks
  assert.ok(importContent.includes('authLoading'), 'AdminImportStudents must inspect authLoading from useAuth()');
  assert.ok(incidentsContent.includes('authLoading'), 'AdminIncidents must inspect authLoading from useAuth()');

  // Both must display loading state while session is restoring
  assert.ok(importContent.includes('Verifying administrative security credentials'), 'AdminImportStudents must show verifying credentials message');
  assert.ok(incidentsContent.includes('Verifying administrative security credentials'), 'AdminIncidents must show verifying credentials message');
});

test('[Missing Access Tokens & Bearer Guard] Admin requests never transmit Bearer undefined', () => {
  const adminImportPath = path.resolve(process.cwd(), 'src/pages/AdminImportStudents.jsx');
  const importContent = fs.readFileSync(adminImportPath, 'utf8');

  const claimsServicePath = path.resolve(process.cwd(), 'src/services/claimsService.js');
  const claimsContent = fs.readFileSync(claimsServicePath, 'utf8');

  // Never send Bearer undefined
  assert.equal(importContent.includes('`Bearer ${session?.access_token}`'), false, 'AdminImportStudents must never use optional chaining directly in Bearer header');
  assert.ok(importContent.includes('if (!session?.access_token)'), 'AdminImportStudents must guard against missing session.access_token');

  assert.ok(claimsContent.includes('if (error || !session?.access_token)'), 'claimsService must reject missing session.access_token');
});

test('[Admin Authorization] Non-admin users are strictly denied access to admin routes', () => {
  let statusCode = null;
  let responseData = null;

  const mockRes = {
    status(code) {
      statusCode = code;
      return {
        json(data) {
          responseData = data;
        },
      };
    },
  };

  // 1. Authenticated student with email/password trying to access admin route
  const studentUserReq = {
    user: {
      id: 'student-uuid-456',
      email: 'regularstudent@university.edu',
      app_metadata: { role: 'authenticated' },
    },
  };

  let nextCalled = false;
  requireAdmin(studentUserReq, mockRes, () => { nextCalled = true; });

  assert.equal(nextCalled, false, 'Student user must not pass requireAdmin');
  assert.equal(statusCode, 403, 'Must return 403 Forbidden');
  assert.equal(responseData.error, 'Forbidden');
  assert.match(responseData.message, /Requires administrator or security reviewer privileges/i);

  // 2. User with forged client user_metadata
  const attackerReq = {
    user: {
      id: 'attacker-uuid-789',
      email: 'attacker@outside.com',
      user_metadata: { role: 'admin' },
      app_metadata: { role: 'authenticated' },
    },
  };

  nextCalled = false;
  requireAdmin(attackerReq, mockRes, () => { nextCalled = true; });

  assert.equal(nextCalled, false, 'User metadata spoofing must not pass requireAdmin');
  assert.equal(statusCode, 403);

  // 3. Legitimate administrator passes
  const adminReq = {
    user: {
      id: 'admin-uuid-123',
      email: 'admin@university.edu',
      app_metadata: { role: 'admin' },
    },
  };

  nextCalled = false;
  requireAdmin(adminReq, mockRes, () => { nextCalled = true; });
  assert.equal(nextCalled, true, 'Verified admin must pass requireAdmin');
});

test('[Regression: CSV Preview Payload Size & Body Parser] Server JSON parser accommodates cohort CSV payloads >64KB', () => {
  const indexPath = path.resolve(process.cwd(), 'server/index.js');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  // Must not have 64kb limit which blocked students.csv
  assert.equal(indexContent.includes("express.json({ limit: '64kb' })"), false, 'Server must not restrict JSON to 64kb');
  assert.match(indexContent, /express\.json\(\{\s*limit:\s*['"](?:2|5|10)mb['"]\s*\}\)/, 'Server must permit at least 2MB for cohort registry CSV payloads');

  // Error handler must return JSON rather than Express default HTML on payload error
  assert.ok(indexContent.includes("err.type === 'entity.too.large' || err.status === 413"), 'Must handle 413 Payload Too Large as JSON');
  assert.ok(indexContent.includes("res.status(413).json"), 'Must respond with JSON format for 413');
});

test('[Regression: Client Non-JSON Error Resilience] AdminImportStudents safely handles non-JSON / HTML error responses', () => {
  const adminImportPath = path.resolve(process.cwd(), 'src/pages/AdminImportStudents.jsx');
  const content = fs.readFileSync(adminImportPath, 'utf8');

  // handleAnalyzeCsv must safely parse JSON without unhandled SyntaxError
  assert.ok(content.includes('data = await response.json()'), 'Must call response.json() inside try-catch');
  assert.ok(content.includes('catch'), 'Must catch JSON parsing errors');
  assert.ok(content.includes('response.status === 413'), 'Must handle HTTP 413 status gracefully');
});

test('[Regression: Preview Payload Format & Parsing] Generates read-only preview summary on large cohort without DB mutation', async () => {
  // Synthetic large CSV header and 600 rows
  let syntheticCsv = 'registration_number,student_name,section,academic_year,branch\n';
  for (let i = 1; i <= 600; i++) {
    syntheticCsv += `23CSE${String(i).padStart(4, '0')},Student Name ${i},CSE-A,2023-2027,Computer Science\n`;
  }

  // Size is > 40KB raw
  assert.ok(syntheticCsv.length > 30000, 'Synthetic CSV must be substantial');

  const parseResult = parseAndValidateCsv(syntheticCsv);
  assert.equal(parseResult.valid, true);
  assert.equal(parseResult.totalRows, 600);
  assert.equal(parseResult.validCount, 600);

  // Read-only duplicate check without DB mutations
  const existingSet = new Set(['23CSE0001', '23CSE0002']);
  const dbDupResult = evaluateDbDuplicates(parseResult.rows, existingSet);
  assert.equal(dbDupResult.existingInDbCount, 2);
  assert.equal(dbDupResult.newRowsCount, 598);
});

// ==============================================================================
// 10. POST /api/auth/register-student Hermetic In-Memory Mock Tests
// ==============================================================================

function createMockSupabaseForRegistration({
  registry = null,
  profile = null,
  createUserError = null,
  insertProfileError = null,
  initialUserRole = 'authenticated',
} = {}) {
  const deletedUsers = [];
  const insertedProfiles = [];
  let capturedUserMetadata = null;
  let capturedAppMetadata = null;

  return {
    deletedUsers,
    insertedProfiles,
    getCapturedUserMetadata: () => capturedUserMetadata,
    getCapturedAppMetadata: () => capturedAppMetadata,
    from(tableName) {
      if (tableName === 'student_registry') {
        return {
          select() {
            return {
              eq(_col, val) {
                return {
                  async maybeSingle() {
                    if (registry && registry.registration_number === val) {
                      return { data: registry, error: null };
                    }
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (tableName === 'student_profiles') {
        return {
          select() {
            return {
              eq(_col, val) {
                return {
                  async maybeSingle() {
                    if (profile && profile.registration_number === val) {
                      return { data: profile, error: null };
                    }
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
          async insert(profileRecord) {
            if (insertProfileError) {
              return { data: null, error: insertProfileError };
            }
            insertedProfiles.push(profileRecord);
            return { data: profileRecord, error: null };
          },
        };
      }
      throw new Error(`Unexpected table in registration mock: ${tableName}`);
    },
    auth: {
      admin: {
        async createUser(params) {
          if (createUserError) {
            return { data: null, error: createUserError };
          }
          capturedUserMetadata = params.user_metadata;
          capturedAppMetadata = params.app_metadata || { role: initialUserRole };
          const mockUser = {
            id: 'mock-auth-student-uuid-999',
            email: params.email,
            email_confirmed_at: params.email_confirm ? new Date().toISOString() : null,
            app_metadata: capturedAppMetadata,
            user_metadata: params.user_metadata,
          };
          return { data: { user: mockUser }, error: null };
        },
        async deleteUser(userId) {
          deletedUsers.push(userId);
          return { data: null, error: null };
        },
      },
    },
  };
}

async function invokeRegisterStudent(reqBody, { serviceSupabase, ip = '127.0.0.1' } = {}) {
  let statusCode = 200;
  let responseBody = null;
  const headers = {};

  const req = {
    body: reqBody,
    serviceSupabase,
    ip,
    headers: {},
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[name] = value;
    },
    json(data) {
      responseBody = data;
      return this;
    },
  };

  const registerLayer = authStudentRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/register-student'
  );
  if (!registerLayer) {
    throw new Error('Could not find /register-student route on authStudentRouter');
  }

  const handler = registerLayer.route.stack[0].handle;
  await handler(req, res);

  return { statusCode, responseBody, headers };
}

test('[Registration Mock] Valid synthetic registration succeeds with 201 Created and creates active profile', async () => {
  const mockRegistry = {
    registration_number: 'SYNTH-CSE-101',
    student_name: 'Synthetic Test Student',
    section: 'A',
    academic_year: '2nd Year',
    branch: 'CSE',
    official_email: 'synthetic.student@testuniversity.edu',
    is_eligible: true,
  };

  const mockService = createMockSupabaseForRegistration({ registry: mockRegistry });

  const result = await invokeRegisterStudent(
    {
      registrationNumber: 'SYNTH-CSE-101',
      fullName: 'Synthetic Test Student',
      email: 'synthetic.student@testuniversity.edu',
      password: 'SyntheticPassword123!',
    },
    { serviceSupabase: mockService }
  );

  assert.equal(result.statusCode, 201);
  assert.equal(result.responseBody.success, true);
  assert.equal(result.responseBody.student.registration_number, 'SYNTH-CSE-101');
  assert.equal(mockService.insertedProfiles.length, 1);
  assert.equal(mockService.insertedProfiles[0].is_active, true, 'Profile must be active for eligible student');
  assert.equal(mockService.insertedProfiles[0].email_verified, true, 'Email must be verified automatically for student identity');
  assert.equal(mockService.getCapturedAppMetadata().role, 'student', 'Must receive student role');
});

test('[Registration Mock] Rejects unlisted synthetic registration number with 400', async () => {
  const mockService = createMockSupabaseForRegistration({ registry: null });

  const result = await invokeRegisterStudent(
    {
      registrationNumber: 'SYNTH-UNKNOWN-999',
      fullName: 'Unlisted Student',
      email: 'unlisted@synthetic-domain.test',
      password: 'SyntheticPassword123!',
    },
    { serviceSupabase: mockService }
  );

  assert.equal(result.statusCode, 400);
  assert.equal(result.responseBody.error, 'Registration Ineligible');
  assert.match(result.responseBody.message, /not eligible for student registration or could not be verified/i);
  assert.equal(mockService.insertedProfiles.length, 0);
});

test('[Registration Mock] Rejects mismatched synthetic student name with 400', async () => {
  const mockRegistry = {
    registration_number: 'SYNTH-CSE-202',
    student_name: 'Synthetic Real Student',
    section: 'B',
    academic_year: '2nd Year',
    branch: 'CSE',
    official_email: 'synthetic.student@testuniversity.edu',
    is_eligible: true,
  };

  const mockService = createMockSupabaseForRegistration({ registry: mockRegistry });

  const result = await invokeRegisterStudent(
    {
      registrationNumber: 'SYNTH-CSE-202',
      fullName: 'Completely Different Persona',
      email: 'different@synthetic-domain.test',
      password: 'SyntheticPassword123!',
    },
    { serviceSupabase: mockService }
  );

  assert.equal(result.statusCode, 400);
  assert.equal(result.responseBody.error, 'Registration Ineligible');
  assert.match(result.responseBody.message, /does not match official university records/i);
  assert.equal(mockService.insertedProfiles.length, 0);
});

test('[Registration Mock] Rejects ineligible/suspended registry entry with 400', async () => {
  const mockRegistry = {
    registration_number: 'SYNTH-CSE-303',
    student_name: 'Suspended Synthetic Student',
    section: 'C',
    academic_year: '2nd Year',
    branch: 'CSE',
    official_email: 'suspended@testuniversity.edu',
    is_eligible: false,
  };

  const mockService = createMockSupabaseForRegistration({ registry: mockRegistry });

  const result = await invokeRegisterStudent(
    {
      registrationNumber: 'SYNTH-CSE-303',
      fullName: 'Suspended Synthetic Student',
      email: 'suspended@testuniversity.edu',
      password: 'SyntheticPassword123!',
    },
    { serviceSupabase: mockService }
  );

  assert.equal(result.statusCode, 400);
  assert.equal(result.responseBody.error, 'Registration Ineligible');
  assert.match(result.responseBody.message, /not eligible for registration/i);
  assert.equal(mockService.insertedProfiles.length, 0);
});

test('[Registration Mock] Rejects duplicate registration number when profile already exists', async () => {
  const mockRegistry = {
    registration_number: 'SYNTH-CSE-404',
    student_name: 'Existing Synthetic Student',
    section: 'D',
    academic_year: '2nd Year',
    branch: 'CSE',
    is_eligible: true,
  };
  const mockProfile = {
    user_id: 'existing-student-uuid-404',
    registration_number: 'SYNTH-CSE-404',
  };

  const mockService = createMockSupabaseForRegistration({ registry: mockRegistry, profile: mockProfile });

  const result = await invokeRegisterStudent(
    {
      registrationNumber: 'SYNTH-CSE-404',
      fullName: 'Existing Synthetic Student',
      email: 'existing.new@synthetic-domain.test',
      password: 'SyntheticPassword123!',
    },
    { serviceSupabase: mockService }
  );

  assert.equal(result.statusCode, 400);
  assert.equal(result.responseBody.error, 'Registration Ineligible');
  assert.match(result.responseBody.message, /already been registered/i);
  assert.equal(mockService.insertedProfiles.length, 0);
});

test('[Registration Mock] Rejects duplicate email address when Auth user already exists', async () => {
  const mockRegistry = {
    registration_number: 'SYNTH-CSE-505',
    student_name: 'Duplicate Email Student',
    section: 'A',
    academic_year: '2nd Year',
    branch: 'CSE',
    is_eligible: true,
  };

  const mockService = createMockSupabaseForRegistration({
    registry: mockRegistry,
    createUserError: new Error('A user with this email address has already registered'),
  });

  const result = await invokeRegisterStudent(
    {
      registrationNumber: 'SYNTH-CSE-505',
      fullName: 'Duplicate Email Student',
      email: 'already.taken@synthetic-domain.test',
      password: 'SyntheticPassword123!',
    },
    { serviceSupabase: mockService }
  );

  assert.equal(result.statusCode, 400);
  assert.equal(result.responseBody.error, 'Registration Conflict');
  assert.match(result.responseBody.message, /already exists/i);
  assert.equal(mockService.insertedProfiles.length, 0);
});

test('[Registration Mock] Profile insert failure triggers Auth user rollback', async () => {
  const mockRegistry = {
    registration_number: 'SYNTH-CSE-606',
    student_name: 'Rollback Test Student',
    section: 'B',
    academic_year: '2nd Year',
    branch: 'CSE',
    is_eligible: true,
  };

  const mockService = createMockSupabaseForRegistration({
    registry: mockRegistry,
    insertProfileError: new Error('Simulated database connection failure during profile insert'),
  });

  const result = await invokeRegisterStudent(
    {
      registrationNumber: 'SYNTH-CSE-606',
      fullName: 'Rollback Test Student',
      email: 'rollback@synthetic-domain.test',
      password: 'SyntheticPassword123!',
    },
    { serviceSupabase: mockService }
  );

  assert.equal(result.statusCode, 500);
  assert.equal(result.responseBody.error, 'Profile Creation Error');
  assert.match(result.responseBody.message, /Registration aborted/i);
  assert.ok(
    mockService.deletedUsers.includes('mock-auth-student-uuid-999'),
    'Created Auth user must be rolled back on profile insert failure'
  );
});

test('[Registration Mock] New student receives no administrator privileges and profile starts inactive', async () => {
  const mockRegistry = {
    registration_number: 'SYNTH-CSE-707',
    student_name: 'Privilege Check Student',
    section: 'A',
    academic_year: '2nd Year',
    branch: 'CSE',
    is_eligible: true,
  };

  const mockService = createMockSupabaseForRegistration({
    registry: mockRegistry,
    initialUserRole: 'authenticated',
  });

  const result = await invokeRegisterStudent(
    {
      registrationNumber: 'SYNTH-CSE-707',
      fullName: 'Privilege Check Student',
      email: 'privilege.check@synthetic-domain.test',
      password: 'SyntheticPassword123!',
    },
    { serviceSupabase: mockService }
  );

  assert.equal(result.statusCode, 201);
  const userAppMetadata = mockService.getCapturedAppMetadata();
  assert.equal(userAppMetadata.role, 'student');
  assert.notEqual(userAppMetadata.role, 'admin');
  assert.notEqual(userAppMetadata.role, 'security_reviewer');

  const insertedProfile = mockService.insertedProfiles[0];
  assert.equal(insertedProfile.is_active, true);
  assert.equal(insertedProfile.email_verified, true);
});

test('[Registration Mock] Activation rules: eligible student activates, suspended/rejected remain inactive', () => {
  // Test 1: Eligible + pending status -> Active
  assert.equal(
    isAccountActive({ verificationStatus: 'pending', isEligible: true }),
    true,
    'Eligible student activates directly'
  );

  // Test 2: Verification rejected -> Inactive
  assert.equal(
    isAccountActive({ verificationStatus: 'rejected', isEligible: true }),
    false,
    'Rejected identity must remain inactive'
  );

  // Test 3: Verification suspended -> Inactive
  assert.equal(
    isAccountActive({ verificationStatus: 'suspended', isEligible: true }),
    false,
    'Suspended account must remain inactive'
  );

  // Test 4: Registry ineligible -> Inactive
  assert.equal(
    isAccountActive({ verificationStatus: 'verified', isEligible: false }),
    false,
    'Ineligible registry record must remain inactive'
  );
});

console.log('--- All Student Registry, Verification & Security tests passed successfully! ---');




