/**
-- ==============================================================================
-- Module: studentValidation.js
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 1 - Stage 2: Student Registry CSV & Identity Validation Service
-- ==============================================================================
*/

export const REQUIRED_COLUMNS = [
  'registration_number',
  'student_name',
  'section',
  'academic_year',
  'branch',
];

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export const REG_NUMBER_REGEX = /^[A-Z0-9_-]{3,64}$/;

export const COLUMN_ALIASES = {
  // Registration Number aliases
  registration_number: 'registration_number',
  reg_no: 'registration_number',
  regno: 'registration_number',
  registration_no: 'registration_number',
  registrationno: 'registration_number',
  'registration number': 'registration_number',
  'reg number': 'registration_number',
  'reg. no': 'registration_number',
  'reg no': 'registration_number',
  roll_no: 'registration_number',
  rollno: 'registration_number',

  // Student Name aliases
  student_name: 'student_name',
  studentname: 'student_name',
  'student name': 'student_name',
  full_name: 'student_name',
  fullname: 'student_name',
  'full name': 'student_name',
  name: 'student_name',

  // Section aliases
  section: 'section',
  sec: 'section',

  // Academic Year aliases
  academic_year: 'academic_year',
  academicyear: 'academic_year',
  'academic year': 'academic_year',
  year: 'academic_year',

  // Branch aliases
  branch: 'branch',
  department: 'branch',
  dept: 'branch',

  // Optional Official Email aliases
  official_email: 'official_email',
  officialemail: 'official_email',
  'official email': 'official_email',
  email: 'official_email',
  'college email': 'official_email',
  'university email': 'official_email',
};

/**
 * Robust CSV line tokenizer supporting quoted fields, escaped quotes, and commas.
 */
export function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote: "" -> "
        current += '"';
        i += 2;
        continue;
      } else {
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  result.push(current.trim());
  return result;
}

/**
 * Normalizes a header string using standard aliases.
 */
export function normalizeHeader(header) {
  if (!header || typeof header !== 'string') return '';
  const cleaned = header.replace(/^\uFEFF/, '').trim().toLowerCase();
  return COLUMN_ALIASES[cleaned] || cleaned;
}

/**
 * Normalizes a student registration number (trim + uppercase).
 */
export function normalizeRegistrationNumber(reg) {
  if (!reg || typeof reg !== 'string') return '';
  return reg.trim().toUpperCase();
}

/**
 * Parses and validates an entire CSV string.
 * Detects missing required columns, in-CSV duplicates, and invalid row values.
 */
export function parseAndValidateCsv(csvText) {
  if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
    return {
      valid: false,
      error: 'CSV content is empty or unreadable.',
      headers: [],
      rows: [],
      duplicatesInCsv: [],
      invalidRows: [],
      totalRows: 0,
      validCount: 0,
    };
  }

  // Remove potential BOM and split into lines
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  const rawLines = cleanText.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (rawLines.length === 0) {
    return {
      valid: false,
      error: 'CSV file contains no records.',
      headers: [],
      rows: [],
      duplicatesInCsv: [],
      invalidRows: [],
      totalRows: 0,
      validCount: 0,
    };
  }

  // 1. Parse header row
  const headerTokens = parseCsvLine(rawLines[0]);
  const normalizedHeaders = headerTokens.map(normalizeHeader);

  // 2. Validate required columns
  const missingColumns = REQUIRED_COLUMNS.filter(
    (col) => !normalizedHeaders.includes(col)
  );

  if (missingColumns.length > 0) {
    return {
      valid: false,
      error: `Missing required column(s): ${missingColumns.join(', ')}. Expected: ${REQUIRED_COLUMNS.join(', ')}.`,
      missingColumns,
      headers: normalizedHeaders,
      rows: [],
      duplicatesInCsv: [],
      invalidRows: [],
      totalRows: 0,
      validCount: 0,
    };
  }

  // Map column name to index
  const colIndex = {};
  normalizedHeaders.forEach((col, idx) => {
    colIndex[col] = idx;
  });

  const parsedRows = [];
  const invalidRows = [];
  const regMap = new Map(); // reg -> array of 1-based line numbers

  // 3. Process each data row
  for (let lineIdx = 1; lineIdx < rawLines.length; lineIdx++) {
    const rawLine = rawLines[lineIdx];
    const rowNumber = lineIdx + 1; // 1-indexed line in file
    const tokens = parseCsvLine(rawLine);

    // If completely empty row, skip
    if (tokens.every((t) => !t)) {
      continue;
    }

    const regRaw = tokens[colIndex.registration_number] || '';
    const nameRaw = tokens[colIndex.student_name] || '';
    const secRaw = tokens[colIndex.section] || 'A';
    const yearRaw = tokens[colIndex.academic_year] || '2nd Year';
    const branchRaw = tokens[colIndex.branch] || 'CSE';
    const emailRaw = colIndex.official_email !== undefined ? tokens[colIndex.official_email] : null;

    const regNorm = normalizeRegistrationNumber(regRaw);
    const nameNorm = nameRaw.trim();
    const secNorm = secRaw.trim().toUpperCase();
    const yearNorm = yearRaw.trim();
    const branchNorm = branchRaw.trim().toUpperCase();
    const emailNorm = emailRaw ? emailRaw.trim().toLowerCase() : null;

    const rowErrors = [];

    // Validation checks
    if (!regNorm || regNorm.length < 3) {
      rowErrors.push('Registration number must be at least 3 characters.');
    } else if (!REG_NUMBER_REGEX.test(regNorm)) {
      rowErrors.push('Registration number contains invalid characters (allowed: alphanumeric, hyphen, underscore).');
    }

    if (!nameNorm || nameNorm.length < 2) {
      rowErrors.push('Student name must be at least 2 characters.');
    }

    if (!secNorm) {
      rowErrors.push('Section is required.');
    }

    if (!yearNorm) {
      rowErrors.push('Academic year is required.');
    }

    if (!branchNorm) {
      rowErrors.push('Branch is required.');
    }

    if (emailNorm && !EMAIL_REGEX.test(emailNorm)) {
      rowErrors.push(`Invalid official email format: "${emailNorm}".`);
    }

    if (rowErrors.length > 0) {
      invalidRows.push({
        rowNumber,
        registration_number: regNorm || regRaw,
        student_name: nameNorm || nameRaw,
        errors: rowErrors,
      });
      continue;
    }

    // In-CSV duplicate tracking
    if (!regMap.has(regNorm)) {
      regMap.set(regNorm, [rowNumber]);
    } else {
      regMap.get(regNorm).push(rowNumber);
    }

    parsedRows.push({
      rowNumber,
      registration_number: regNorm,
      student_name: nameNorm,
      section: secNorm,
      academic_year: yearNorm,
      branch: branchNorm,
      official_email: emailNorm,
      is_eligible: true,
    });
  }

  // 4. Compute In-CSV duplicates
  const duplicatesInCsv = [];
  for (const [reg, lines] of regMap.entries()) {
    if (lines.length > 1) {
      duplicatesInCsv.push({
        registration_number: reg,
        occurrences: lines.length,
        lines,
      });
    }
  }

  return {
    valid: invalidRows.length === 0,
    headers: normalizedHeaders,
    rows: parsedRows,
    duplicatesInCsv,
    duplicateInCsvCount: duplicatesInCsv.length,
    invalidRows,
    invalidCount: invalidRows.length,
    totalRows: parsedRows.length + invalidRows.length,
    validCount: parsedRows.length,
  };
}

/**
 * Checks parsed rows against an existing Set of database registration numbers.
 */
export function evaluateDbDuplicates(rows, existingRegNumbersSet) {
  const newRows = [];
  const existingInDb = [];

  for (const row of rows) {
    if (existingRegNumbersSet.has(row.registration_number)) {
      existingInDb.push(row);
    } else {
      newRows.push(row);
    }
  }

  return {
    newRows,
    existingInDb,
    existingInDbCount: existingInDb.length,
    newRowsCount: newRows.length,
  };
}

/**
 * Checks student signup eligibility against official registry.
 * Decoupled from email verification and identity activation.
 */
export function evaluateStudentEligibility({ registrationNumber: _registrationNumber, studentName, email }, registryRecord, existingProfileRecord) {
  // 1. Verify existence in student registry
  if (!registryRecord) {
    return {
      eligible: false,
      reason: 'The registration number was not found in the official university student registry.',
      userFacingMessage: 'The provided registration number is not eligible for student registration or could not be verified with university records. Please check your credentials or contact university administration.',
    };
  }

  // 2. Verify eligibility flag in registry
  if (!registryRecord.is_eligible) {
    return {
      eligible: false,
      reason: 'Student registry record is marked as ineligible (suspended or inactive).',
      userFacingMessage: 'The provided registration number is currently not eligible for registration. Please contact university administration.',
    };
  }

  // 3. Verify no duplicate profile already registered
  if (existingProfileRecord) {
    return {
      eligible: false,
      reason: 'This registration number is already linked to an existing account.',
      userFacingMessage: 'This university registration number has already been registered. If you have lost access to your account, please submit an account recovery request.',
    };
  }

  // 4. Verify student name consistency
  if (studentName && registryRecord.student_name) {
    const providedTokens = studentName.trim().toLowerCase().split(/\s+/);
    const officialTokens = registryRecord.student_name.trim().toLowerCase().split(/\s+/);
    const hasOverlap = providedTokens.some((tok) => tok.length > 2 && officialTokens.includes(tok));

    if (!hasOverlap) {
      return {
        eligible: false,
        reason: `Student name "${studentName}" does not reasonably match official registry name "${registryRecord.student_name}".`,
        userFacingMessage: 'The student name provided does not match official university records. Please enter your name exactly as registered with the university.',
      };
    }
  }

  // 5. Determine initial verification status
  // If registered with their official university email matching registry, mark as verified.
  // Otherwise, mark as pending (requiring verification).
  let initialVerificationStatus = 'pending';
  if (
    registryRecord.official_email &&
    email &&
    registryRecord.official_email.toLowerCase() === email.trim().toLowerCase()
  ) {
    initialVerificationStatus = 'verified';
  }

  return {
    eligible: true,
    initialVerificationStatus,
    registryData: {
      registration_number: registryRecord.registration_number,
      student_name: registryRecord.student_name,
      section: registryRecord.section,
      academic_year: registryRecord.academic_year,
      branch: registryRecord.branch,
      official_email: registryRecord.official_email,
    },
  };
}

/**
 * Evaluates student account activation state.
 * Activation requires registry eligibility (is_eligible = true) and non-suspended status.
 * Email confirmation and verification are removed as activation blockers for the simplified student flow.
 */
export function isAccountActive({ isEligible, verificationStatus }) {
  if (isEligible !== true) return false;
  if (verificationStatus === 'suspended' || verificationStatus === 'rejected') return false;
  return true;
}
