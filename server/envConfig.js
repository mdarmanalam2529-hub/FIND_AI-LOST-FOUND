import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Extracts and parses environment key-values from a file in-memory
 * without modifying process.env or leaking secret values.
 *
 * @param {string} filePath - Absolute or relative path to the env file.
 * @returns {Record<string, string> | null}
 */
export function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return dotenv.parse(content);
  } catch (err) {
    throw new Error(`[Env Config Error] Failed to read ${filePath}: ${err.message}`);
  }
}

/**
 * Extracts the Supabase project URL from an environment map.
 *
 * @param {Record<string, string> | null} envObj
 * @returns {string | null}
 */
export function extractSupabaseUrl(envObj) {
  if (!envObj) return null;
  const url = (envObj.VITE_SUPABASE_URL || envObj.SUPABASE_URL || '').trim();
  return url || null;
}

/**
 * Checks whether a given URL is a local development Supabase instance.
 *
 * @param {string | null} url
 * @returns {boolean}
 */
export function isLocalSupabaseUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === '127.0.0.1' ||
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

/**
 * Extracts the Supabase project reference ID from a cloud URL.
 * e.g. "https://abcdefghijk.supabase.co" -> "abcdefghijk"
 *
 * @param {string | null} url
 * @returns {string | null}
 */
export function extractSupabaseProjectRef(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.supabase.co')) {
      const parts = parsed.hostname.split('.');
      return parts[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates that a development URL is structurally valid and does not collide
 * with the production project URL in .env.
 *
 * @param {string} devUrl - Target development URL.
 * @param {string | null} prodUrl - Production URL from .env (for collision detection).
 * @returns {boolean}
 */
export function validateDevelopmentUrl(devUrl, prodUrl) {
  if (!devUrl || typeof devUrl !== 'string' || devUrl.trim() === '') {
    throw new Error('[Security Error] Development Supabase URL is missing or empty.');
  }

  const trimmedDev = devUrl.trim();
  let parsedDev;
  try {
    parsedDev = new URL(trimmedDev);
  } catch {
    throw new Error('[Security Error] Development Supabase URL is not a valid URL.');
  }

  // Validate protocol
  if (parsedDev.protocol !== 'http:' && parsedDev.protocol !== 'https:') {
    throw new Error('[Security Error] Development Supabase URL must use http or https protocol.');
  }

  // Collision detection against production project
  if (prodUrl) {
    const trimmedProd = prodUrl.trim();
    if (trimmedDev.toLowerCase() === trimmedProd.toLowerCase()) {
      throw new Error(
        '[Security Error] Development Supabase URL cannot match production project URL in .env. Accidental production writes prevented.'
      );
    }

    const devRef = extractSupabaseProjectRef(trimmedDev);
    const prodRef = extractSupabaseProjectRef(trimmedProd);
    if (devRef && prodRef && devRef.toLowerCase() === prodRef.toLowerCase()) {
      throw new Error(
        '[Security Error] Development Supabase URL points to the same project ref as production in .env. Accidental production writes prevented.'
      );
    }
  }

  return true;
}

/**
 * Scans environment variables to verify that no privileged service-role credentials
 * are exposed via client-accessible VITE_ prefixes.
 *
 * @param {Record<string, string>} envObj
 */
export function validateNoClientServiceRoleExposure(envObj) {
  if (!envObj) return;

  const serviceRoleKey = (envObj.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  for (const [key, val] of Object.entries(envObj)) {
    if (key.startsWith('VITE_')) {
      const upperKey = key.toUpperCase();
      if (
        upperKey.includes('SERVICE_ROLE') ||
        upperKey.includes('SERVICE_KEY') ||
        upperKey.includes('SECRET_KEY')
      ) {
        throw new Error(
          `[Security Error] Privileged service credential exposed via client variable ${key}. Service keys must never use the VITE_ prefix.`
        );
      }

      if (serviceRoleKey && val && typeof val === 'string' && val.trim() === serviceRoleKey) {
        throw new Error(
          `[Security Error] Value of ${key} matches SUPABASE_SERVICE_ROLE_KEY. Client variables must never contain service role secrets.`
        );
      }
    }
  }
}

/**
 * Loads, isolates, and validates the environment configuration based on mode.
 *
 * Rules:
 * 1. 'development': Requires explicit .env.local. NEVER falls back to production .env.
 * 2. 'production': Loads .env. Validates required production credentials.
 * 3. 'test': Hermetic mock environment. Never loads production .env.
 *
 * @param {object} options
 * @param {string} [options.mode] - 'development' | 'production' | 'test'
 * @param {string} [options.rootDir] - Workspace directory
 * @param {string} [options.localEnvFile] - Path to local env file
 * @param {string} [options.prodEnvFile] - Path to prod env file
 * @param {Record<string, string>} [options.envOverride] - In-memory env map (for testing)
 * @param {Record<string, string>} [options.targetProcessEnv] - Target process.env (defaults to process.env)
 * @returns {object} Validated environment summary (never contains credentials)
 */
export function loadAndValidateEnvironment(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const localEnvFile = options.localEnvFile || path.join(rootDir, '.env.local');
  const prodEnvFile = options.prodEnvFile || path.join(rootDir, '.env');
  const targetEnv = options.targetProcessEnv || process.env;

  const mode = options.mode || targetEnv.NODE_ENV || 'development';

  // Read production file in-memory strictly for collision detection.
  // Secrets from prodEnvFile are NEVER automatically injected into targetEnv in development mode.
  const prodParsed = fs.existsSync(prodEnvFile) ? parseEnvFile(prodEnvFile) : null;
  const prodUrl = extractSupabaseUrl(prodParsed);

  if (mode === 'development') {
    let devVars = options.envOverride || null;

    if (!devVars) {
      if (!fs.existsSync(localEnvFile)) {
        throw new Error(
          '[Security Error] Development mode requires .env.local with an isolated development Supabase target. Refusing silent fallback to production .env.'
        );
      }
      devVars = parseEnvFile(localEnvFile);
    }

    if (!devVars || Object.keys(devVars).length === 0) {
      throw new Error(
        `[Security Error] Development environment file ${localEnvFile} is empty. Silent fallback to production .env is strictly blocked.`
      );
    }

    const devUrl = extractSupabaseUrl(devVars);
    if (!devUrl) {
      throw new Error(
        `[Security Error] Incomplete credentials in ${localEnvFile}: missing VITE_SUPABASE_URL or SUPABASE_URL. Silent fallback to production .env is strictly blocked.`
      );
    }

    const anonKey =
      devVars.VITE_SUPABASE_PUBLISHABLE_KEY ||
      devVars.VITE_SUPABASE_ANON_KEY ||
      devVars.SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error(
        `[Security Error] Incomplete credentials in ${localEnvFile}: missing VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY. Silent fallback to production .env is strictly blocked.`
      );
    }

    if (!devVars.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        `[Security Error] Incomplete credentials in ${localEnvFile}: missing SUPABASE_SERVICE_ROLE_KEY. Silent fallback to production .env is strictly blocked.`
      );
    }

    // Validate URL safety (blocks collision with prod)
    validateDevelopmentUrl(devUrl, prodUrl);

    // Validate that service role key is not exposed to frontend
    validateNoClientServiceRoleExposure(devVars);

    // Apply exclusively development variables to target environment
    for (const [key, val] of Object.entries(devVars)) {
      targetEnv[key] = val;
    }
    targetEnv.NODE_ENV = 'development';
    targetEnv.SUPABASE_URL = devUrl;
    targetEnv.VITE_SUPABASE_URL = devUrl;
    targetEnv.SUPABASE_PUBLISHABLE_KEY = anonKey;
    targetEnv.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;

    return {
      mode: 'development',
      isLocal: isLocalSupabaseUrl(devUrl),
      targetUrl: devUrl,
      source: localEnvFile,
    };
  }

  if (mode === 'production') {
    let prodVars = options.envOverride || null;
    if (!prodVars) {
      if (!fs.existsSync(prodEnvFile)) {
        throw new Error(`[Security Error] Production mode requires ${prodEnvFile}.`);
      }
      prodVars = parseEnvFile(prodEnvFile);
    }

    const url = extractSupabaseUrl(prodVars);
    const anonKey =
      prodVars.VITE_SUPABASE_PUBLISHABLE_KEY ||
      prodVars.VITE_SUPABASE_ANON_KEY ||
      prodVars.SUPABASE_ANON_KEY;
    const serviceRole = prodVars.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceRole) {
      throw new Error(
        `[Security Error] Incomplete production credentials in ${prodEnvFile}: missing required Supabase configuration.`
      );
    }

    validateNoClientServiceRoleExposure(prodVars);

    for (const [key, val] of Object.entries(prodVars)) {
      targetEnv[key] = val;
    }
    targetEnv.NODE_ENV = 'production';
    targetEnv.SUPABASE_URL = url;
    targetEnv.VITE_SUPABASE_URL = url;
    targetEnv.SUPABASE_PUBLISHABLE_KEY = anonKey;
    targetEnv.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;

    return {
      mode: 'production',
      isLocal: false,
      targetUrl: url,
      source: prodEnvFile,
    };
  }

  if (mode === 'test') {
    let testVars = options.envOverride || null;
    if (!testVars && options.localEnvFile && fs.existsSync(localEnvFile)) {
      testVars = parseEnvFile(localEnvFile);
    }

    if (!testVars) {
      testVars = {
        NODE_ENV: 'test',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        SUPABASE_ANON_KEY: 'findai-test-anon-key-hermetic-mock',
        SUPABASE_PUBLISHABLE_KEY: 'findai-test-anon-key-hermetic-mock',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'findai-test-anon-key-hermetic-mock',
        SUPABASE_SERVICE_ROLE_KEY: 'findai-test-service-role-hermetic-mock',
        PORT: '3001',
      };
    }

    validateNoClientServiceRoleExposure(testVars);

    for (const [key, val] of Object.entries(testVars)) {
      targetEnv[key] = val;
    }
    targetEnv.NODE_ENV = 'test';

    return {
      mode: 'test',
      isLocal: true,
      targetUrl: testVars.SUPABASE_URL,
      source: 'test-environment',
    };
  }

  throw new Error(`[Security Error] Unsupported environment mode: "${mode}".`);
}
