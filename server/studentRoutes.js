/**
-- ==============================================================================
-- Module: studentRoutes.js
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 1 - Stage 2: Student Registry Admin & Verified Registration Endpoints
-- ==============================================================================
*/

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { isAuthorizedAdmin, isPrimaryAdmin, isStaffOrAdmin } from './claimWorkflow.js';
import {
  parseAndValidateCsv,
  evaluateDbDuplicates,
  evaluateStudentEligibility,
  normalizeRegistrationNumber,
  EMAIL_REGEX,
  REG_NUMBER_REGEX,
} from './studentValidation.js';

export const adminStudentRouter = express.Router();
export const authStudentRouter = express.Router();

/**
 * Middleware: Verify authorized admin or security reviewer.
 * Reuses the authoritative isAuthorizedAdmin implementation from claimWorkflow.js.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !isAuthorizedAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied: Requires administrator or security reviewer privileges.',
    });
  }
  next();
}

/**
 * Middleware: Verify authorized primary administrator.
 */
export function requirePrimaryAdmin(req, res, next) {
  if (!req.user || !isPrimaryAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied: Requires primary administrator privileges.',
    });
  }
  next();
}

/**
 * Middleware: Verify staff or administrator privileges.
 */
export function requireStaffOrAdmin(req, res, next) {
  if (!req.user || !isStaffOrAdmin(req.user)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied: Requires staff or administrator privileges.',
    });
  }
  next();
}

/**
 * GET /api/admin/student-registry/check-access
 * Verifies caller has administrator or security reviewer privileges.
 */
adminStudentRouter.get('/check-access', requireAdmin, (req, res) => {
  res.json({
    authorized: true,
    role: req.user.app_metadata?.role || 'admin',
    email: req.user.email,
  });
});

/**
 * POST /api/admin/student-registry/preview
 * Analyzes CSV without modifying the database.
 * Returns aggregate counts, duplicate detection, and sample preview.
 */
adminStudentRouter.post('/preview', requireAdmin, async (req, res) => {
  const { csvContent } = req.body;
  const serviceSupabase = req.serviceSupabase;

  if (!csvContent || typeof csvContent !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'CSV content must be provided as a non-empty string in the "csvContent" field.',
    });
  }

  // 1. Parse and validate CSV data
  const parseResult = parseAndValidateCsv(csvContent);

  if (!parseResult.valid && parseResult.missingColumns) {
    return res.status(400).json({
      error: 'Invalid CSV Header Format',
      message: parseResult.error,
      missingColumns: parseResult.missingColumns,
    });
  }

  // 2. Query database for existing registration numbers to detect duplicates against DB
  const existingRegSet = new Set();

  if (serviceSupabase && parseResult.rows.length > 0) {
    try {
      const allRegs = parseResult.rows.map((r) => r.registration_number);
      // Batch query in chunks of 200
      const CHUNK_SIZE = 200;
      for (let i = 0; i < allRegs.length; i += CHUNK_SIZE) {
        const chunk = allRegs.slice(i, i + CHUNK_SIZE);
        const { data: dbRecords, error: dbError } = await serviceSupabase
          .from('student_registry')
          .select('registration_number')
          .in('registration_number', chunk);

        if (dbError) {
          console.warn('[Student Registry Preview] Database query error:', dbError.message);
        } else if (dbRecords) {
          dbRecords.forEach((rec) => existingRegSet.add(rec.registration_number));
        }
      }
    } catch (err) {
      console.warn('[Student Registry Preview] Error checking database records:', err.message);
    }
  }

  const dbDuplicateResult = evaluateDbDuplicates(parseResult.rows, existingRegSet);

  // Mark status on preview sample rows
  const sampleWithStatus = parseResult.rows.slice(0, 15).map((row) => ({
    ...row,
    existsInDb: existingRegSet.has(row.registration_number),
    hasDuplicateInCsv: parseResult.duplicatesInCsv.some(
      (d) => d.registration_number === row.registration_number
    ),
  }));

  return res.json({
    success: true,
    summary: {
      totalRows: parseResult.totalRows,
      validRowsCount: parseResult.validCount,
      invalidRowsCount: parseResult.invalidCount,
      duplicateInCsvCount: parseResult.duplicateInCsvCount,
      duplicateInDbCount: dbDuplicateResult.existingInDbCount,
      newRecordsCount: dbDuplicateResult.newRowsCount,
    },
    duplicatesInCsv: parseResult.duplicatesInCsv.slice(0, 25),
    invalidRows: parseResult.invalidRows.slice(0, 25),
    sampleRows: sampleWithStatus,
  });
});

/**
 * POST /api/admin/student-registry/import
 * Imports validated CSV records into student_registry.
 * Prevents silent overwrites: existing records are skipped unless overwriteExisting is true.
 * Service role credentials are kept strictly server-side.
 */
adminStudentRouter.post('/import', requireAdmin, async (req, res) => {
  const { csvContent, overwriteExisting = false } = req.body;
  const serviceSupabase = req.serviceSupabase;

  if (!serviceSupabase) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Server service-role client is not configured to perform registry imports.',
    });
  }

  if (!csvContent || typeof csvContent !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'CSV content must be provided as a non-empty string in the "csvContent" field.',
    });
  }

  // 1. Parse and validate CSV data
  const parseResult = parseAndValidateCsv(csvContent);

  if (parseResult.rows.length === 0) {
    return res.status(400).json({
      error: 'Empty or Invalid CSV',
      message: parseResult.error || 'No valid student records could be parsed from the provided CSV.',
      invalidRows: parseResult.invalidRows.slice(0, 20),
    });
  }

  // 2. Query database for existing registration numbers
  const allRegs = parseResult.rows.map((r) => r.registration_number);
  const existingRegSet = new Set();
  const CHUNK_SIZE = 200;

  try {
    for (let i = 0; i < allRegs.length; i += CHUNK_SIZE) {
      const chunk = allRegs.slice(i, i + CHUNK_SIZE);
      const { data: dbRecords, error: dbError } = await serviceSupabase
        .from('student_registry')
        .select('registration_number')
        .in('registration_number', chunk);

      if (dbError) {
        console.error('[Student Registry Import] Database check error:', dbError.message);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to verify existing registry records before import.',
        });
      }

      if (dbRecords) {
        dbRecords.forEach((rec) => existingRegSet.add(rec.registration_number));
      }
    }
  } catch (err) {
    console.error('[Student Registry Import] Verification error:', err.message);
    return res.status(500).json({
      error: 'Internal Error',
      message: 'An unexpected error occurred while verifying existing records.',
    });
  }

  // Deduplicate within the CSV (keep first occurrence)
  const seenRegs = new Set();
  const deduplicatedRows = [];
  let inCsvDuplicateCount = 0;

  for (const row of parseResult.rows) {
    if (seenRegs.has(row.registration_number)) {
      inCsvDuplicateCount++;
      continue;
    }
    seenRegs.add(row.registration_number);
    deduplicatedRows.push(row);
  }

  // Separate records to insert vs skip vs update
  const recordsToInsert = [];
  const recordsToUpdate = [];
  let skippedCount = 0;

  for (const row of deduplicatedRows) {
    const isExisting = existingRegSet.has(row.registration_number);

    if (isExisting) {
      if (overwriteExisting === true) {
        recordsToUpdate.push(row);
      } else {
        skippedCount++;
      }
    } else {
      recordsToInsert.push(row);
    }
  }

  // 3. Perform database operations using serviceSupabase
  let insertedCount = 0;
  let updatedCount = 0;

  try {
    const nowIso = new Date().toISOString();
    const adminUserId = req.user.id;

    // A. Insert new records in batches
    if (recordsToInsert.length > 0) {
      for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
        const batch = recordsToInsert.slice(i, i + CHUNK_SIZE).map((r) => ({
          registration_number: r.registration_number,
          student_name: r.student_name,
          section: r.section,
          academic_year: r.academic_year,
          branch: r.branch,
          official_email: r.official_email,
          is_eligible: true,
          imported_at: nowIso,
          imported_by: adminUserId,
        }));

        const { error: insertError } = await serviceSupabase
          .from('student_registry')
          .insert(batch);

        if (insertError) {
          console.error('[Student Registry Import] Batch insert error:', insertError.message);
          return res.status(500).json({
            error: 'Database Insert Error',
            message: `Failed to insert batch starting at index ${i}: ${insertError.message}`,
            insertedSoFar: insertedCount,
          });
        }

        insertedCount += batch.length;
      }
    }

    // B. Update existing records in batches if overwrite was explicitly requested
    if (recordsToUpdate.length > 0 && overwriteExisting === true) {
      for (let i = 0; i < recordsToUpdate.length; i += CHUNK_SIZE) {
        const batch = recordsToUpdate.slice(i, i + CHUNK_SIZE).map((r) => ({
          registration_number: r.registration_number,
          student_name: r.student_name,
          section: r.section,
          academic_year: r.academic_year,
          branch: r.branch,
          official_email: r.official_email,
          is_eligible: true,
          updated_at: nowIso,
        }));

        const { error: upsertError } = await serviceSupabase
          .from('student_registry')
          .upsert(batch, { onConflict: 'registration_number' });

        if (upsertError) {
          console.error('[Student Registry Import] Batch upsert error:', upsertError.message);
          return res.status(500).json({
            error: 'Database Upsert Error',
            message: `Failed to update records starting at index ${i}: ${upsertError.message}`,
            updatedSoFar: updatedCount,
          });
        }

        updatedCount += batch.length;
      }
    }

    return res.json({
      success: true,
      message: 'Student registry import processed successfully.',
      counts: {
        totalParsedRows: parseResult.totalRows,
        importedCount: insertedCount,
        updatedCount: updatedCount,
        skippedCount: skippedCount,
        inCsvDuplicatesSkipped: inCsvDuplicateCount,
        invalidRowsCount: parseResult.invalidCount,
      },
    });
  } catch (err) {
    console.error('[Student Registry Import] Unexpected processing failure:', err.message || 'Processing error');
    return res.status(500).json({
      error: 'Import Failure',
      message: 'An unexpected server error occurred during the import process.',
    });
  }
});

/**
 * GET /api/admin/student-registry/stats
 * Returns aggregate metrics without exposing individual student records.
 */
adminStudentRouter.get('/stats', requireAdmin, async (req, res) => {
  const serviceSupabase = req.serviceSupabase;
  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Service client unavailable.' });
  }

  try {
    const [
      { count: totalStudents, error: regError },
      { count: activeProfiles, error: activeError },
      { count: pendingProfiles, error: pendingError },
    ] = await Promise.all([
      serviceSupabase.from('student_registry').select('*', { count: 'exact', head: true }),
      serviceSupabase.from('student_profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
      serviceSupabase.from('student_profiles').select('*', { count: 'exact', head: true }).eq('is_active', false),
    ]);

    if (regError) {
      return res.status(500).json({ error: 'Database Error', message: regError.message });
    }

    return res.json({
      success: true,
      stats: {
        totalRegistryStudents: totalStudents || 0,
        activeStudentProfiles: activeProfiles || 0,
        pendingStudentProfiles: pendingProfiles || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * POST /api/auth/register-student
 * Server-side student registration with eligibility validation.
 * Anti-enumeration defense: Requires registration number, full name, email, and password.
 * Does not expose public search or linked email discovery.
 */
authStudentRouter.post('/register-student', async (req, res) => {
  const { registrationNumber, fullName, email, password } = req.body;
  const serviceSupabase = req.serviceSupabase;

  if (!serviceSupabase) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Student registration service is temporarily unavailable. Please try again later.',
    });
  }

  // 1. Strict Input Format Validation
  const normalizedReg = normalizeRegistrationNumber(registrationNumber);
  const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
  const cleanEmail = (typeof email === 'string' && email.trim() && EMAIL_REGEX.test(email.trim()))
    ? email.trim().toLowerCase()
    : null;

  if (!normalizedReg || normalizedReg.length < 3 || !REG_NUMBER_REGEX.test(normalizedReg)) {
    return res.status(400).json({
      error: 'Invalid Registration Number',
      message: 'A valid university registration number is required (at least 3 characters).',
    });
  }

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({
      error: 'Invalid Name',
      message: 'Full name is required (at least 2 characters).',
    });
  }

  // Registration number as initial password support:
  // If password is not provided or empty, use normalized registration number as initial password.
  const initialPassword = (typeof password === 'string' && password.trim().length > 0)
    ? password.trim()
    : normalizedReg;

  if (initialPassword.length < 6) {
    return res.status(400).json({
      error: 'Invalid Password',
      message: 'Password or registration number must be at least 6 characters.',
    });
  }

  try {
    // 2. Query Student Registry for eligibility
    const { data: registryRecord, error: regError } = await serviceSupabase
      .from('student_registry')
      .select('*')
      .eq('registration_number', normalizedReg)
      .maybeSingle();

    if (regError) {
      console.error('[Student Registration] Registry query error:', regError.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Could not verify student eligibility records.',
      });
    }

    // 3. Query existing profile to check if already registered
    const { data: existingProfile, error: profileError } = await serviceSupabase
      .from('student_profiles')
      .select('user_id, registration_number')
      .eq('registration_number', normalizedReg)
      .maybeSingle();

    if (profileError) {
      console.error('[Student Registration] Profile lookup error:', profileError.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Could not verify profile uniqueness records.',
      });
    }

    // 4. Run eligibility evaluation
    const effectiveEmail = cleanEmail || registryRecord?.official_email || `${normalizedReg.toLowerCase()}@student.findai.internal`;

    const eligibility = evaluateStudentEligibility(
      { registrationNumber: normalizedReg, studentName: cleanName, email: effectiveEmail },
      registryRecord,
      existingProfile
    );

    if (!eligibility.eligible) {
      return res.status(400).json({
        error: 'Registration Ineligible',
        message: eligibility.userFacingMessage,
      });
    }

    // 5. Create Supabase Auth user
    const isInitialPassword = initialPassword === normalizedReg;
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email: effectiveEmail,
      password: initialPassword,
      email_confirm: true, // Auto-confirm internal identity; no email verification link required
      user_metadata: {
        full_name: cleanName,
        registration_number: normalizedReg,
        section: registryRecord.section,
        academic_year: registryRecord.academic_year,
        branch: registryRecord.branch,
        initial_password_used: isInitialPassword,
      },
      app_metadata: {
        role: 'student',
      },
    });

    if (authError) {
      // If user already exists with this email
      if (authError.message?.toLowerCase().includes('already registered')) {
        return res.status(400).json({
          error: 'Registration Conflict',
          message: 'An account with this email address already exists. Please log in or request a password reset.',
        });
      }

      console.error('[Student Registration] Auth user creation error:', authError.message);
      return res.status(400).json({
        error: 'Registration Failed',
        message: authError.message || 'Failed to create student account.',
      });
    }

    const createdUserId = authData.user.id;

    // 6. Create student profile in database
    // Simplified flow: Account activates immediately for eligible students
    const { error: insertProfileError } = await serviceSupabase
      .from('student_profiles')
      .insert({
        user_id: createdUserId,
        registration_number: normalizedReg,
        personal_email: effectiveEmail,
        student_name: registryRecord.student_name,
        section: registryRecord.section,
        academic_year: registryRecord.academic_year,
        branch: registryRecord.branch,
        email_verified: true,
        verification_status: eligibility.initialVerificationStatus,
        is_active: true,
      });

    if (insertProfileError) {
      console.error('[Student Registration] Profile insert error:', insertProfileError.message);
      // Rollback auth user creation if profile insert failed
      await serviceSupabase.auth.admin.deleteUser(createdUserId).catch(() => {});
      return res.status(500).json({
        error: 'Profile Creation Error',
        message: 'Could not link student profile to registry. Registration aborted.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Student registration completed. You can sign in immediately with your registration number and initial password.',
      student: {
        registration_number: normalizedReg,
        student_name: registryRecord.student_name,
        section: registryRecord.section,
        branch: registryRecord.branch,
        academic_year: registryRecord.academic_year,
        verification_status: eligibility.initialVerificationStatus,
        is_active: true,
      },
    });
  } catch (err) {
    console.error('[Student Registration] Unexpected error:', err.message || 'Unknown error');
    return res.status(500).json({
      error: 'Registration Error',
      message: 'An unexpected error occurred during student registration.',
    });
  }
});

// ==============================================================================
// Login Rate Limiter (Anti Brute-Force & Enumeration Defense)
// ==============================================================================
export const loginAttemptTracker = new Map();
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_LOGIN_ATTEMPTS = 5;

// Periodically purge stale entries from loginAttemptTracker
const loginTrackerCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttemptTracker.entries()) {
    if (now - record.windowStart > LOGIN_ATTEMPT_WINDOW_MS) {
      loginAttemptTracker.delete(key);
    }
  }
}, 5 * 60 * 1000);
if (loginTrackerCleanup.unref) loginTrackerCleanup.unref();

export function checkLoginRateLimit(key) {
  const now = Date.now();
  const record = loginAttemptTracker.get(key);
  if (!record || now - record.windowStart > LOGIN_ATTEMPT_WINDOW_MS) {
    return { allowed: true };
  }
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfter = Math.ceil((record.windowStart + LOGIN_ATTEMPT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

export function recordFailedLogin(key) {
  const now = Date.now();
  const record = loginAttemptTracker.get(key);
  if (!record || now - record.windowStart > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttemptTracker.set(key, { windowStart: now, count: 1 });
  } else {
    record.count++;
  }
}

export function clearLoginAttempts(key) {
  loginAttemptTracker.delete(key);
}

/**
 * POST /api/auth/student-login
 * Server-side student login using university registration number and password.
 * Resolves registration number to user email server-side; authenticates via Supabase Auth.
 * Never exposes personal_email, service role key, or plaintext passwords.
 */
authStudentRouter.post('/student-login', async (req, res) => {
  const { registrationNumber, password } = req.body;
  const serviceSupabase = req.serviceSupabase;

  if (!serviceSupabase) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Student login service is temporarily unavailable. Please try again later.',
    });
  }

  // 1. Normalize registration number consistently
  const normalizedReg = normalizeRegistrationNumber(registrationNumber);
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'anonymous';
  const rateLimitKey = `${clientIp}:${normalizedReg || 'empty'}`;

  // 2. Enforce login rate limiting
  const rateCheck = checkLoginRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', rateCheck.retryAfter);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many failed login attempts. Please wait 15 minutes before trying again.',
    });
  }

  // Registration number is the student's password: if password is blank, default to normalizedReg
  const effectivePassword = (password && typeof password === 'string' && password.trim())
    ? password.trim()
    : normalizedReg;

  // 3. Strict format validation; returns generic error to avoid enumeration
  if (!normalizedReg || normalizedReg.length < 3 || !REG_NUMBER_REGEX.test(normalizedReg) || !effectivePassword) {
    recordFailedLogin(rateLimitKey);
    return res.status(401).json({
      error: 'Invalid Credentials',
      message: 'Invalid university registration number or password.',
    });
  }

  try {
    // 4. Query registry eligibility
    const { data: registryRecord, error: regErr } = await serviceSupabase
      .from('student_registry')
      .select('registration_number, is_eligible, student_name, branch, section, academic_year, official_email')
      .eq('registration_number', normalizedReg)
      .maybeSingle();

    if (regErr) {
      console.error('[Student Login] Registry query error:', regErr.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Could not verify university registry eligibility.',
      });
    }

    // 5. Server-side lookup of linked student profile
    let { data: profile, error: profileErr } = await serviceSupabase
      .from('student_profiles')
      .select('*')
      .eq('registration_number', normalizedReg)
      .maybeSingle();

    if (profileErr) {
      console.error('[Student Login] Profile lookup error:', profileErr.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Could not verify student records.',
      });
    }

    // Check account eligibility in student registry
    if (registryRecord && registryRecord.is_eligible !== true) {
      recordFailedLogin(rateLimitKey);
      return res.status(403).json({
        error: 'Account Ineligible',
        message: 'This university registration number is not currently eligible for access. Please contact administration.',
      });
    }

    // Unknown student: not in profile and not in registry -> generic 401 prevents enumeration
    if (!profile && !registryRecord) {
      recordFailedLogin(rateLimitKey);
      return res.status(401).json({
        error: 'Invalid Credentials',
        message: 'Invalid university registration number or password.',
      });
    }

    // If student is eligible in registry but has no profile yet:
    // Allow seamless initial login using registration number as initial password
    if (!profile && registryRecord && registryRecord.is_eligible === true) {
      if (password !== normalizedReg) {
        recordFailedLogin(rateLimitKey);
        return res.status(401).json({
          error: 'Invalid Credentials',
          message: 'Invalid university registration number or password.',
        });
      }

      // Provision account for eligible registry student
      const effectiveEmail = registryRecord.official_email || `${normalizedReg.toLowerCase()}@student.findai.internal`;
      let authUserId = null;

      if (serviceSupabase.auth?.admin?.createUser) {
        try {
          const { data: createdAuth, error: createAuthErr } = await serviceSupabase.auth.admin.createUser({
            email: effectiveEmail,
            password: normalizedReg,
            email_confirm: true,
            user_metadata: {
              full_name: registryRecord.student_name,
              registration_number: normalizedReg,
              section: registryRecord.section,
              academic_year: registryRecord.academic_year,
              branch: registryRecord.branch,
              initial_password_used: true,
            },
            app_metadata: {
              role: 'student',
            },
          });

          if (createAuthErr) {
            if (serviceSupabase.auth.admin.listUsers) {
              const { data: listData } = await serviceSupabase.auth.admin.listUsers();
              const existingAuth = listData?.users?.find(u => u.email?.toLowerCase() === effectiveEmail.toLowerCase());
              if (existingAuth) {
                authUserId = existingAuth.id;
                await serviceSupabase.auth.admin.updateUserById(authUserId, {
                  password: normalizedReg,
                  email_confirm: true,
                  app_metadata: { role: 'student' },
                });
              }
            }
          } else if (createdAuth?.user?.id) {
            authUserId = createdAuth.user.id;
          }
        } catch (authCreateCatch) {
          console.warn('[Student Login JIT] Non-fatal auth creation error:', authCreateCatch.message);
        }
      }

      // Insert active student profile
      if (serviceSupabase.from) {
        try {
          await serviceSupabase.from('student_profiles').insert({
            user_id: authUserId || `student-${normalizedReg.toLowerCase()}`,
            registration_number: normalizedReg,
            personal_email: effectiveEmail,
            student_name: registryRecord.student_name,
            section: registryRecord.section,
            academic_year: registryRecord.academic_year,
            branch: registryRecord.branch,
            email_verified: true,
            verification_status: 'verified',
            is_active: true,
          });

          // Fetch newly created profile
          const { data: fetchedProfile } = await serviceSupabase
            .from('student_profiles')
            .select('*')
            .eq('registration_number', normalizedReg)
            .maybeSingle();

          profile = fetchedProfile || {
            user_id: authUserId || `student-${normalizedReg.toLowerCase()}`,
            registration_number: normalizedReg,
            student_name: registryRecord.student_name,
            section: registryRecord.section,
            academic_year: registryRecord.academic_year,
            branch: registryRecord.branch,
            personal_email: effectiveEmail,
            is_active: true,
            verification_status: 'verified',
          };
        } catch (profInsertCatch) {
          console.warn('[Student Login JIT] Profile insert fallback:', profInsertCatch.message);
          profile = {
            registration_number: normalizedReg,
            student_name: registryRecord.student_name,
            personal_email: effectiveEmail,
            is_active: true,
            verification_status: 'verified',
          };
        }
      }
    }

    if (!profile) {
      recordFailedLogin(rateLimitKey);
      return res.status(401).json({
        error: 'Invalid Credentials',
        message: 'Invalid university registration number or password.',
      });
    }

    // Explicit suspension or rejection check
    if (profile.verification_status === 'suspended' || profile.verification_status === 'rejected') {
      recordFailedLogin(rateLimitKey);
      return res.status(403).json({
        error: 'Account Inactive',
        message: 'Your student account is not active or has been suspended. Please contact university administration.',
      });
    }

    // Auto-activate profile if student is eligible and in good standing
    if (profile.is_active !== true) {
      if (registryRecord && registryRecord.is_eligible === true) {
        profile.is_active = true;
        profile.verification_status = 'verified';
        profile.email_verified = true;
        if (serviceSupabase.from) {
          await serviceSupabase
            .from('student_profiles')
            .update({ is_active: true, verification_status: 'verified', email_verified: true })
            .eq('registration_number', normalizedReg)
            .catch(() => {});
        }
      } else {
        recordFailedLogin(rateLimitKey);
        return res.status(403).json({
          error: 'Account Inactive',
          message: 'Your student account is not active or has been suspended. Please contact university administration.',
        });
      }
    }

    // 7. Authenticate password using Supabase Auth (via standard client; never custom password hash/comparison)
    const anonClient = req.anonSupabase || (
      (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) && (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)
        ? createClient(
            process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
          )
        : null
    );

    if (!anonClient) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Authentication service client is not configured.',
      });
    }

    const loginEmail = profile.personal_email || `${normalizedReg.toLowerCase()}@student.findai.internal`;
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: loginEmail,
      password: effectivePassword,
    });

    if (authError || !authData?.session) {
      recordFailedLogin(rateLimitKey);
      return res.status(401).json({
        error: 'Invalid Credentials',
        message: 'Invalid university registration number or password.',
      });
    }

    // 8. Authentication successful: reset rate limit attempts for this key
    clearLoginAttempts(rateLimitKey);

    // 9. Return only session tokens and minimum required user profile information
    // Crucial: personal_email is NEVER returned in response.
    return res.json({
      success: true,
      message: 'Student authentication successful.',
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in,
        token_type: authData.session.token_type,
      },
      user: {
        id: authData.user.id,
        registration_number: normalizedReg,
        student_name: profile.student_name,
        branch: profile.branch,
        section: profile.section,
        academic_year: profile.academic_year,
        role: authData.user.app_metadata?.role || 'authenticated',
        initial_password_used: authData.user.user_metadata?.initial_password_used === true,
      },
    });
  } catch (err) {
    console.error('[Student Login] Unexpected error:', err.message || 'Unknown error');
    return res.status(500).json({
      error: 'Authentication Error',
      message: 'An unexpected error occurred during login. Please try again.',
    });
  }
});

/**
 * POST /api/auth/change-password
 * Secure student & user password change endpoint.
 * Requirements enforced:
 * 1. Authenticated session required (JWT verified via Bearer header or req.user).
 * 2. Current password verified against Supabase Auth.
 * 3. Strong new password verified (min 6 chars, confirm match, different from current).
 * 4. Rejection if new password matches registration number.
 * 5. Supabase Auth update via service-role client (clears initial_password_used flag).
 * 6. Consequential change audited in admin_audit_logs.
 * 7. Plaintext passwords never logged or stored in PostgreSQL.
 */
authStudentRouter.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const serviceSupabase = req.serviceSupabase;
  const anonClient = req.anonSupabase || (
    (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) && (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)
      ? createClient(
          process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
      : null
  );

  if (!serviceSupabase || !anonClient) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Authentication service is temporarily unavailable. Please try again later.',
    });
  }

  // 1. Authenticate caller: Verify session token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be signed in to change your password.',
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.trim() === '') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or empty authentication token.',
    });
  }

  let user = req.user;
  if (!user) {
    try {
      const { data: userData, error: userError } = await anonClient.auth.getUser(token);
      if (userError || !userData?.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid, expired, or revoked authentication session. Please sign in again.',
        });
      }
      user = userData.user;
    } catch {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Could not verify authentication session.',
      });
    }
  }

  // 2. Validate input fields
  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({
      error: 'Invalid Request',
      message: 'Your current password is required to verify your identity.',
    });
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({
      error: 'Invalid Request',
      message: 'New password must be at least 6 characters.',
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      error: 'Invalid Request',
      message: 'New password and confirmation password do not match.',
    });
  }

  if (newPassword === currentPassword) {
    return res.status(400).json({
      error: 'Invalid Request',
      message: 'New password cannot be identical to your current password.',
    });
  }

  // Prevent setting password equal to registration number
  const regNumber = user.user_metadata?.registration_number;
  if (regNumber && newPassword.trim().toUpperCase() === regNumber.trim().toUpperCase()) {
    return res.status(400).json({
      error: 'Insecure Password',
      message: 'New password cannot be your university registration number. Please choose a strong personal password.',
    });
  }

  try {
    // 3. Verify current password with Supabase Auth
    const { error: verifyError } = await anonClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return res.status(400).json({
        error: 'Invalid Current Password',
        message: 'The current password you entered is incorrect.',
      });
    }

    // 4. Update password via service-role Supabase client
    const { error: updateError } = await serviceSupabase.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        user_metadata: {
          ...(user.user_metadata || {}),
          initial_password_used: false,
          password_updated_at: new Date().toISOString(),
        },
      }
    );

    if (updateError) {
      console.error('[Account Security] Auth update error:', updateError.message);
      return res.status(500).json({
        error: 'Password Update Failed',
        message: updateError.message || 'Failed to update your password.',
      });
    }

    // 5. Audit log
    await serviceSupabase.from('admin_audit_logs').insert({
      actor_id: user.id,
      actor_role: user.app_metadata?.role || 'student',
      action: 'password_change',
      reason: 'User successfully updated their password via account settings.',
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Your password has been changed successfully. Your old password is no longer valid.',
    });
  } catch (err) {
    console.error('[Account Security] Unexpected error:', err.message || 'Unknown error');
    return res.status(500).json({
      error: 'Server Error',
      message: 'An unexpected error occurred while updating your password.',
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Anti-enumeration password recovery request endpoint.
 * Accepts either registered university email or registration number.
 * If registration number is supplied, looks up linked active profile email.
 * Always returns a generic success message to prevent user enumeration.
 */
authStudentRouter.post('/forgot-password', async (req, res) => {
  const { identifier } = req.body;
  const serviceSupabase = req.serviceSupabase;
  const anonClient = req.anonSupabase || (
    (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) && (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)
      ? createClient(
          process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
      : null
  );

  const genericResponse = {
    success: true,
    message: 'If an account exists matching that identifier, a password recovery link has been sent to the registered email address.',
  };

  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Please provide your registered university email or registration number.',
    });
  }

  const cleanInput = identifier.trim();

  try {
    let targetEmail = null;

    if (EMAIL_REGEX.test(cleanInput)) {
      targetEmail = cleanInput.toLowerCase();
    } else {
      const normalizedReg = normalizeRegistrationNumber(cleanInput);
      if (normalizedReg && serviceSupabase) {
        const { data: profile } = await serviceSupabase
          .from('student_profiles')
          .select('personal_email, is_active')
          .eq('registration_number', normalizedReg)
          .maybeSingle();

        if (profile && profile.personal_email && profile.is_active) {
          targetEmail = profile.personal_email;
        }
      }
    }

    if (targetEmail && anonClient) {
      const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
      await anonClient.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${frontendOrigin}/reset-password`,
      }).catch((err) => {
        console.warn('[Account Recovery] Supabase reset trigger notice:', err.message);
      });
    }

    return res.json(genericResponse);
  } catch (err) {
    console.error('[Account Recovery] Unexpected error:', err.message || 'Unknown error');
    return res.json(genericResponse);
  }
});

/**
 * GET /api/admin/student-registry/search
 * Secure admin search for student records by registration number or name.
 * Supports pagination via `page` (default 1) and `limit` (default 20, max 100), plus status filtering.
 * Returns combined registry and profile data (eligibility, verification status, active flag).
 */
adminStudentRouter.get(['/search', '/student-registry/search'], requireAdmin, async (req, res) => {
  const serviceSupabase = req.serviceSupabase;
  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Supabase client not configured.' });
  }
  const { q = '', page = '1', limit = '20', status = 'all' } = req.query;
  const pageNum = Math.max(parseInt(page, 10), 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 100);
  const offset = (pageNum - 1) * limitNum;

  try {
    // Base query on registry with exact total count
    let query = serviceSupabase
      .from('student_registry')
      .select('registration_number,student_name,section,academic_year,branch,is_eligible,official_email', { count: 'exact' })
      .order('registration_number', { ascending: true });

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      query = query.or(`registration_number.ilike.${term},student_name.ilike.${term}`);
    }

    if (status === 'eligible') {
      query = query.eq('is_eligible', true);
    } else if (status === 'ineligible') {
      query = query.eq('is_eligible', false);
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data: registryRows, count, error } = await query;
    if (error) {
      console.error('[Admin Student Search] DB error:', error.message);
      return res.status(500).json({ error: 'Database Error', message: error.message });
    }

    // Fetch matching profiles in batch to get verification_status and is_active
    const regNumbers = (registryRows || []).map((r) => r.registration_number);
    const profileMap = {};
    if (regNumbers.length > 0) {
      const { data: profiles, error: profileErr } = await serviceSupabase
        .from('student_profiles')
        .select('registration_number,verification_status,is_active,created_at')
        .in('registration_number', regNumbers);

      if (!profileErr && profiles) {
        profiles.forEach((p) => {
          profileMap[p.registration_number] = {
            verification_status: p.verification_status,
            is_active: p.is_active,
            created_at: p.created_at,
          };
        });
      }
    }

    let combined = (registryRows || []).map((row) => {
      const prof = profileMap[row.registration_number] || null;
      return {
        registration_number: row.registration_number,
        student_name: row.student_name,
        section: row.section,
        academic_year: row.academic_year,
        branch: row.branch,
        official_email: row.official_email,
        is_eligible: row.is_eligible,
        is_registered: !!prof,
        verification_status: prof?.verification_status || (prof ? 'pending' : 'unregistered'),
        is_active: prof?.is_active ?? false,
        created_at: prof?.created_at || null,
      };
    });

    if (status === 'active') {
      combined = combined.filter((s) => s.is_active === true);
    } else if (status === 'inactive') {
      combined = combined.filter((s) => s.is_active === false);
    }

    return res.json({
      success: true,
      pagination: { page: pageNum, limit: limitNum, total: count ?? combined.length },
      students: combined,
    });
  } catch (err) {
    console.error('[Admin Student Search] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

/**
 * PATCH /api/admin/student-registry/:regNumber
 * Update eligibility, verification status, or active flag for a student.
 * Body may contain `is_eligible` (boolean), `verification_status` (string), and/or `is_active` (boolean).
 * Audited in admin_audit_logs.
 */
adminStudentRouter.patch(['/:regNumber', '/student-registry/:regNumber'], requireAdmin, async (req, res) => {
  const { regNumber } = req.params;
  const { is_eligible, verification_status, is_active } = req.body;
  const serviceSupabase = req.serviceSupabase;

  if (!serviceSupabase) {
    return res.status(503).json({ error: 'Service Unavailable', message: 'Supabase client not configured.' });
  }

  if (typeof is_eligible === 'undefined' && typeof verification_status === 'undefined' && typeof is_active === 'undefined') {
    return res.status(400).json({ error: 'Bad Request', message: 'At least one of is_eligible, verification_status, or is_active must be provided.' });
  }

  const normalizedReg = normalizeRegistrationNumber(regNumber);

  try {
    const updates = {};
    if (typeof is_eligible !== 'undefined') updates.is_eligible = !!is_eligible;
    if (typeof verification_status !== 'undefined') updates.verification_status = String(verification_status).trim();
    if (typeof is_active !== 'undefined') updates.is_active = !!is_active;

    // 1. Update student_registry if is_eligible changed
    if (typeof updates.is_eligible !== 'undefined') {
      const { error: updErr } = await serviceSupabase
        .from('student_registry')
        .update({ is_eligible: updates.is_eligible })
        .eq('registration_number', normalizedReg);

      if (updErr) {
        console.error('[Admin Update] Registry update error:', updErr.message);
        return res.status(500).json({ error: 'Database Error', message: updErr.message });
      }
    }

    // 2. Update student_profiles if verification_status or is_active changed
    const profileUpdates = {};
    if (typeof updates.verification_status !== 'undefined') {
      profileUpdates.verification_status = updates.verification_status;
    }
    if (typeof updates.is_active !== 'undefined') {
      profileUpdates.is_active = updates.is_active;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profUpdErr } = await serviceSupabase
        .from('student_profiles')
        .update(profileUpdates)
        .eq('registration_number', normalizedReg);

      if (profUpdErr) {
        console.error('[Admin Update] Profile update error:', profUpdErr.message);
        return res.status(500).json({ error: 'Database Error', message: profUpdErr.message });
      }
    }

    // 3. Record audit log safely
    try {
      await serviceSupabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_name: req.user.user_metadata?.full_name || req.user.email?.split('@')[0] || 'Administrator',
        actor_email: req.user.email || 'admin@findai.org',
        actor_role: req.user.app_metadata?.role || 'admin',
        action: 'update_student_status',
        target_type: 'student_registry',
        target_identifier: normalizedReg,
        reason: `Updated student ${normalizedReg}: ${JSON.stringify(updates)}`,
      });
    } catch (auditErr) {
      console.warn('[Admin Update] Non-fatal audit log warning:', auditErr.message);
    }

    return res.json({
      success: true,
      message: `Student ${normalizedReg} record updated successfully.`,
      updates,
    });
  } catch (err) {
    console.error('[Admin Update] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Error', message: err.message });
  }
});

