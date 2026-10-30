import assert from 'node:assert/strict';
import {
  parseEnvFile,
  extractSupabaseUrl,
  isLocalSupabaseUrl,
  extractSupabaseProjectRef,
  validateDevelopmentUrl,
  validateNoClientServiceRoleExposure,
  loadAndValidateEnvironment,
} from './envConfig.js';

console.log('--- FindAI Environment Hardening & Isolation Test Suite ---');

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

// 1. Missing development configuration fails closed
test('Missing development configuration (.env.local missing) throws and fails closed', () => {
  const fakeEnv = {};
  assert.throws(
    () => {
      loadAndValidateEnvironment({
        mode: 'development',
        localEnvFile: 'non_existent_.env.local',
        prodEnvFile: '.env',
        targetProcessEnv: fakeEnv,
      });
    },
    (err) => {
      assert.match(err.message, /\[Security Error\] Development mode requires \.env\.local/);
      assert.match(err.message, /Refusing silent fallback to production \.env/);
      return true;
    }
  );
  // Verify target env was not contaminated with production data
  assert.equal(fakeEnv.SUPABASE_URL, undefined);
  assert.equal(fakeEnv.SUPABASE_SERVICE_ROLE_KEY, undefined);
});

// 2. Missing development credentials fails closed
test('Missing development credentials in local env throws without fallback', () => {
  const fakeEnv = {};
  // Missing SUPABASE_SERVICE_ROLE_KEY
  assert.throws(
    () => {
      loadAndValidateEnvironment({
        mode: 'development',
        envOverride: {
          VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'local-anon-key',
          // SUPABASE_SERVICE_ROLE_KEY missing
        },
        prodEnvFile: '.env',
        targetProcessEnv: fakeEnv,
      });
    },
    (err) => {
      assert.match(err.message, /missing SUPABASE_SERVICE_ROLE_KEY/);
      assert.match(err.message, /Silent fallback to production \.env is strictly blocked/);
      return true;
    }
  );

  // Missing URL
  assert.throws(
    () => {
      loadAndValidateEnvironment({
        mode: 'development',
        envOverride: {
          VITE_SUPABASE_PUBLISHABLE_KEY: 'local-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'local-service-key',
        },
        prodEnvFile: '.env',
        targetProcessEnv: fakeEnv,
      });
    },
    (err) => {
      assert.match(err.message, /missing VITE_SUPABASE_URL or SUPABASE_URL/);
      return true;
    }
  );

  // Missing Anon Key
  assert.throws(
    () => {
      loadAndValidateEnvironment({
        mode: 'development',
        envOverride: {
          VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
          SUPABASE_SERVICE_ROLE_KEY: 'local-service-key',
        },
        prodEnvFile: '.env',
        targetProcessEnv: fakeEnv,
      });
    },
    (err) => {
      assert.match(err.message, /missing VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY/);
      return true;
    }
  );
});

// 3. Incorrect development URL validation
test('Incorrect development URL: Malformed or non-HTTP URLs are rejected', () => {
  assert.throws(
    () => validateDevelopmentUrl('not-a-url', 'https://prod.supabase.co'),
    /Development Supabase URL is not a valid URL/
  );

  assert.throws(
    () => validateDevelopmentUrl('ftp://127.0.0.1:54321', 'https://prod.supabase.co'),
    /must use http or https protocol/
  );
});

// 4. No silent production fallback: Development URL matching production is rejected
test('No silent production fallback: Development URL matching production project is strictly blocked', () => {
  const prodUrl = 'https://abcdefghijklmno.supabase.co';

  // Exact URL match
  assert.throws(
    () => validateDevelopmentUrl('https://abcdefghijklmno.supabase.co', prodUrl),
    /Development Supabase URL cannot match production project URL in \.env/
  );

  // Same project ref with trailing slash or casing
  assert.throws(
    () => validateDevelopmentUrl('https://ABCDEFGhijklmno.supabase.co/', prodUrl),
    /Development Supabase URL points to the same project ref as production in \.env/
  );

  // Successful development URL (localhost or distinct project)
  assert.equal(validateDevelopmentUrl('http://127.0.0.1:54321', prodUrl), true);
  assert.equal(validateDevelopmentUrl('http://localhost:54321', prodUrl), true);
  assert.equal(validateDevelopmentUrl('https://isolated-dev-project.supabase.co', prodUrl), true);
});

// 5. Production mode retaining its intended configuration
test('Production mode retains intended configuration when valid', () => {
  const fakeEnv = {};
  const result = loadAndValidateEnvironment({
    mode: 'production',
    envOverride: {
      SUPABASE_URL: 'https://real-prod-project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'prod-anon-key-12345',
      SUPABASE_SERVICE_ROLE_KEY: 'prod-service-role-secret-key-12345',
      ADMIN_EMAILS: 'admin@prod.edu',
    },
    targetProcessEnv: fakeEnv,
  });

  assert.equal(result.mode, 'production');
  assert.equal(result.targetUrl, 'https://real-prod-project.supabase.co');
  assert.equal(fakeEnv.NODE_ENV, 'production');
  assert.equal(fakeEnv.SUPABASE_URL, 'https://real-prod-project.supabase.co');
  assert.equal(fakeEnv.SUPABASE_SERVICE_ROLE_KEY, 'prod-service-role-secret-key-12345');
});

// 6. Service-role credentials never being exposed to frontend configuration
test('Service-role credentials exposed to VITE_ prefix throw fatal security error', () => {
  // Explicit VITE_SUPABASE_SERVICE_ROLE_KEY
  assert.throws(
    () => {
      validateNoClientServiceRoleExposure({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_SERVICE_ROLE_KEY: 'leaked-service-key',
        SUPABASE_SERVICE_ROLE_KEY: 'leaked-service-key',
      });
    },
    (err) => {
      assert.match(err.message, /Privileged service credential exposed via client variable/);
      return true;
    }
  );

  // Value matching service role key in another VITE_ variable
  assert.throws(
    () => {
      validateNoClientServiceRoleExposure({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_CUSTOM_CLIENT_KEY: 'secret-service-token-abc',
        SUPABASE_SERVICE_ROLE_KEY: 'secret-service-token-abc',
      });
    },
    (err) => {
      assert.match(err.message, /matches SUPABASE_SERVICE_ROLE_KEY/);
      return true;
    }
  );

  // Clean client configuration passes
  assert.doesNotThrow(() => {
    validateNoClientServiceRoleExposure({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'safe-anon-key-public',
      SUPABASE_SERVICE_ROLE_KEY: 'secret-service-token-private-backend-only',
    });
  });
});

// 7. Hermetic test mode verification
test('Test mode operates with isolated mock credentials without loading production .env', () => {
  const fakeEnv = {};
  const result = loadAndValidateEnvironment({
    mode: 'test',
    targetProcessEnv: fakeEnv,
  });

  assert.equal(result.mode, 'test');
  assert.equal(result.isLocal, true);
  assert.equal(fakeEnv.NODE_ENV, 'test');
  assert.equal(fakeEnv.SUPABASE_URL, 'http://127.0.0.1:54321');
  assert.equal(fakeEnv.SUPABASE_PUBLISHABLE_KEY, 'findai-test-anon-key-hermetic-mock');
});

// 8. Error messages never leak credential values
test('Security error messages never leak secret token values', () => {
  const secretKey = 'super-sensitive-jwt-token-xyz-123-do-not-leak';
  try {
    loadAndValidateEnvironment({
      mode: 'development',
      envOverride: {
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'local-anon',
        VITE_SUPABASE_SERVICE_ROLE_KEY: secretKey,
        SUPABASE_SERVICE_ROLE_KEY: secretKey,
      },
    });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.equal(
      err.message.includes(secretKey),
      false,
      'Error message must NOT contain secretKey value'
    );
  }
});

console.log(`\nAll ${passed}/${total} Environment Hardening tests passed successfully!`);
