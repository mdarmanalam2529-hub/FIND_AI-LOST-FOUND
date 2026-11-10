import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client configuration for FindAI.
 * Reads environment variables from Vite runtime (import.meta.env).
 *
 * NOTE: Only the Project URL and the Publishable / Anon Key should be exposed here.
 * NEVER expose the service_role key or database password in frontend client code.
 */

// Critical Security Check: Ensure service-role credentials are NEVER present in client bundle
if (typeof import.meta !== 'undefined' && import.meta.env) {
  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey && serviceRoleKey.trim() !== '') {
    throw new Error(
      '[Security Fatal] SUPABASE_SERVICE_ROLE_KEY detected in frontend client environment (VITE_SUPABASE_SERVICE_ROLE_KEY). Service keys must remain strictly backend-only.'
    );
  }
}

const clientEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});
const supabaseUrl = clientEnv?.VITE_SUPABASE_URL;
// Accepts either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY for convenience
const supabasePublishableKey = 
  clientEnv?.VITE_SUPABASE_PUBLISHABLE_KEY || 
  clientEnv?.VITE_SUPABASE_ANON_KEY;

/**
 * Checks if the Supabase environment variables are properly provided
 * and not set to dummy/placeholder values.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  supabaseUrl.trim() !== '' &&
  !supabaseUrl.includes('your-project-id') &&
  supabasePublishableKey.trim() !== '' &&
  !supabasePublishableKey.includes('your-supabase-publishable')
);

// Create the Supabase client only if valid configuration credentials exist
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : // Proxy that throws a helpful error on any property access when not configured
    new Proxy(
      {},
      {
        get(_target, _prop) {
          throw new Error(
            '[Supabase] Configuration missing or unconfigured for current environment. ' +
            'For local development, copy .env.local.example to .env.local with your isolated development credentials.'
          );
        },
      }
    );

if (!isSupabaseConfigured && (typeof import.meta !== 'undefined' && import.meta.env?.DEV)) {
  console.info(
    '[Supabase Setup] Development Supabase credentials not found in .env.local. Configure .env.local when ready to activate backend services.'
  );
}
