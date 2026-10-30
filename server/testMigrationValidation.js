/**
 * ==============================================================================
 * Test Suite: testMigrationValidation.js
 * Project: FindAI - University Lost-and-Found Platform
 * Audit: Supabase Migration Version Integrity & Dependency Order Verification
 * ==============================================================================
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- FindAI Migration Version & Dependency Audit Test Suite ---');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

/**
 * Extracts the version prefix from a migration filename.
 * e.g. "20261018100000_create_items_table.sql" -> "20261018100000"
 */
export function extractMigrationVersion(filename) {
  const match = filename.match(/^([0-9]+)_/);
  return match ? match[1] : null;
}

/**
 * Scans a list of migration filenames and returns any duplicate version prefixes.
 */
export function detectDuplicateVersions(filenames) {
  const versionMap = new Map();
  for (const file of filenames) {
    const version = extractMigrationVersion(file);
    if (!version) continue;
    if (!versionMap.has(version)) {
      versionMap.set(version, []);
    }
    versionMap.get(version).push(file);
  }

  const duplicates = [];
  for (const [version, files] of versionMap.entries()) {
    if (files.length > 1) {
      duplicates.push({ version, files });
    }
  }
  return duplicates;
}

/**
 * Evaluates whether an ordered list of migration files violates schema dependencies.
 */
export function evaluateDependencyOrder(sortedFiles) {
  const violations = [];

  const getIndex = (pattern) => sortedFiles.findIndex((f) => f.includes(pattern));

  const itemsIdx = getIndex('create_items_table');
  const storageIdx = getIndex('create_item_images_storage');
  const claimsIdx = getIndex('create_hybrid_claims_system');
  const adminPoliciesIdx = getIndex('add_admin_and_update_policies');
  const claimHardenIdx = getIndex('harden_claim_and_admin_authorization');
  const fkHardenIdx = getIndex('harden_foreign_key_preservation');
  const studentRegistryIdx = getIndex('create_student_registry_and_profiles');
  const accountRecoveryIdx = getIndex('create_account_recovery_and_audit_logs');
  const handoverIncidentsIdx = getIndex('create_handover_incidents_and_verification');
  const updateRolesIdx = getIndex('update_student_activation_and_roles');

  // Rule 1: items must exist before item_images_storage RLS policy references public.items
  if (itemsIdx !== -1 && storageIdx !== -1 && itemsIdx > storageIdx) {
    violations.push({
      rule: 'Items Table Before Storage Policies',
      issue: `Storage policy migration "${sortedFiles[storageIdx]}" references public.items but sorts before items creation "${sortedFiles[itemsIdx]}".`,
    });
  }

  // Rule 2: claims & handovers must exist before admin policies modify them
  if (claimsIdx !== -1 && adminPoliciesIdx !== -1 && claimsIdx > adminPoliciesIdx) {
    violations.push({
      rule: 'Claims Table Before Admin Policies',
      issue: `Admin policy migration "${sortedFiles[adminPoliciesIdx]}" modifies item_claims/handovers but sorts before claims creation "${sortedFiles[claimsIdx]}".`,
    });
  }

  // Rule 3: claims must exist before claim hardening RPC & policies
  if (claimsIdx !== -1 && claimHardenIdx !== -1 && claimsIdx > claimHardenIdx) {
    violations.push({
      rule: 'Claims Table Before Authorization Hardening',
      issue: `Claim hardening migration "${sortedFiles[claimHardenIdx]}" modifies item_claims but sorts before claims creation "${sortedFiles[claimsIdx]}".`,
    });
  }

  // Rule 4: items and claims must exist before FK preservation hardening
  if (itemsIdx !== -1 && fkHardenIdx !== -1 && itemsIdx > fkHardenIdx) {
    violations.push({
      rule: 'Items Table Before FK Hardening',
      issue: `FK preservation migration "${sortedFiles[fkHardenIdx]}" alters items(user_id) but sorts before items creation "${sortedFiles[itemsIdx]}".`,
    });
  }
  if (claimsIdx !== -1 && fkHardenIdx !== -1 && claimsIdx > fkHardenIdx) {
    violations.push({
      rule: 'Claims Table Before FK Hardening',
      issue: `FK preservation migration "${sortedFiles[fkHardenIdx]}" alters item_claims(claimant_id) but sorts before claims creation "${sortedFiles[claimsIdx]}".`,
    });
  }

  // Rule 5: student_registry must exist before account_recovery_requests references it
  if (studentRegistryIdx !== -1 && accountRecoveryIdx !== -1 && studentRegistryIdx > accountRecoveryIdx) {
    violations.push({
      rule: 'Student Registry Before Account Recovery',
      issue: `Account recovery migration "${sortedFiles[accountRecoveryIdx]}" references student_registry but sorts before registry creation "${sortedFiles[studentRegistryIdx]}".`,
    });
  }

  // Rule 6: claims and handovers must exist before handover incidents
  if (claimsIdx !== -1 && handoverIncidentsIdx !== -1 && claimsIdx > handoverIncidentsIdx) {
    violations.push({
      rule: 'Claims/Handovers Before Handover Incidents',
      issue: `Handover incidents migration "${sortedFiles[handoverIncidentsIdx]}" references item_handovers but sorts before handovers creation "${sortedFiles[claimsIdx]}".`,
    });
  }

  // Rule 7: student_profiles must exist before updating activation triggers
  if (studentRegistryIdx !== -1 && updateRolesIdx !== -1 && studentRegistryIdx > updateRolesIdx) {
    violations.push({
      rule: 'Student Profiles Before Activation Triggers',
      issue: `Role update migration "${sortedFiles[updateRolesIdx]}" updates student_profiles but sorts before profiles creation "${sortedFiles[studentRegistryIdx]}".`,
    });
  }

  return violations;
}

// ==============================================================================
// Active Directory Paths
// ==============================================================================

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const draftsDir = path.join(process.cwd(), 'supabase', 'drafts');
const activeFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

// 1. Verify every active migration has a unique 14-digit version prefix
test('Every active migration file in supabase/migrations has a unique 14-digit version prefix', () => {
  assert.equal(activeFiles.length, 10, 'Must contain exactly 10 active migration files');

  const duplicates = detectDuplicateVersions(activeFiles);
  assert.equal(duplicates.length, 0, `Expected 0 duplicate versions, found: ${JSON.stringify(duplicates)}`);

  for (const file of activeFiles) {
    const version = extractMigrationVersion(file);
    assert.ok(version, `File ${file} must have a numeric prefix`);
    assert.match(version, /^[0-9]{14}$/, `File ${file} version ${version} must be exactly 14 digits`);
  }
});

// 2. Verify filename sorting strictly preserves dependency order
test('Active migration filename sorting strictly preserves table dependency order', () => {
  const alphabeticallySorted = [...activeFiles].sort();
  assert.deepEqual(activeFiles, alphabeticallySorted, 'Files in directory must already be in alphabetical order');

  const violations = evaluateDependencyOrder(alphabeticallySorted);
  assert.equal(violations.length, 0, `Expected 0 dependency violations, found: ${JSON.stringify(violations)}`);

  // Verify the exact expected 9-step sequence
  const expectedSequence = [
    '20261018100000_create_items_table.sql',
    '20261018110000_create_item_images_storage.sql',
    '20261019100000_create_hybrid_claims_system.sql',
    '20261019110000_add_admin_and_update_policies.sql',
    '20261023100000_harden_claim_and_admin_authorization.sql',
    '20261025100000_harden_foreign_key_preservation.sql',
    '20261025110000_create_student_registry_and_profiles.sql',
    '20261025120000_create_account_recovery_and_audit_logs.sql',
    '20261026100000_create_handover_incidents_and_verification.sql',
    '20261028130000_update_student_activation_and_roles.sql',
  ];
  assert.deepEqual(activeFiles, expectedSequence, 'Active migration files must match exact expected sequence');
});

// 3. Verify obsolete OTP cleanup draft is excluded from active migrations
test('Obsolete OTP cleanup migration is moved out of active migrations directory into supabase/drafts', () => {
  const hasActiveOtp = activeFiles.some((f) => f.includes('cleanup_unused_otp'));
  assert.equal(hasActiveOtp, false, 'Active migrations directory must NOT contain cleanup_unused_otp_fields');

  assert.ok(fs.existsSync(draftsDir), 'supabase/drafts directory must exist');
  const draftFiles = fs.readdirSync(draftsDir);
  const hasDraftOtp = draftFiles.some((f) => f.includes('cleanup_unused_otp_fields'));
  assert.equal(hasDraftOtp, true, 'Drafts directory must contain cleanup_unused_otp_fields');

  // Verify that the draft itself contains zero executable statements outside comments
  const draftContent = fs.readFileSync(path.join(draftsDir, '20261026110000_cleanup_unused_otp_fields.sql'), 'utf-8');
  assert.match(draftContent, /STATUS: DRAFT ONLY - DO NOT APPLY AUTOMATICALLY TO PRODUCTION DATABASE/);
  const stripped = draftContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim();
  assert.equal(stripped, '', 'Draft OTP file must contain no executable SQL statements');
});

// 4. Verify no migration contains unexpected destructive statements
test('Active migrations contain zero unexpected destructive statements (DROP TABLE / TRUNCATE)', () => {
  for (const file of activeFiles) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    // Ensure no DROP TABLE or TRUNCATE statements exist
    assert.doesNotMatch(content, /\bDROP\s+TABLE\b/i, `File ${file} must not contain DROP TABLE`);
    assert.doesNotMatch(content, /\bTRUNCATE\b/i, `File ${file} must not contain TRUNCATE`);
    // Ensure no un-commented DROP COLUMN statements exist
    const withoutComments = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--.*$/gm, '');
    assert.doesNotMatch(withoutComments, /\bDROP\s+COLUMN\b/i, `File ${file} must not contain DROP COLUMN`);
  }
});

// 5. Verify SQL files for security: zero service-role keys exposed in migrations
test('SQL migration files contain no hardcoded service-role keys or secrets', () => {
  for (const file of activeFiles) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    assert.doesNotMatch(content, /eyJ[A-Za-z0-9-_=]{40,}/, `File ${file} must not contain JWT tokens`);
    assert.doesNotMatch(content, /service_role.*secret/i, `File ${file} must not contain service-role secrets`);
  }
});

console.log(`\nAll ${passed}/${total} Migration Audit tests passed successfully!`);
