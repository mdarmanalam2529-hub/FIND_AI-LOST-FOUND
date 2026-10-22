import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client configuration for FindAI.
 * Reads environment variables from Vite runtime (import.meta.env).
 *
 * NOTE: Only the Project URL and the Publishable / Anon Key should be exposed here.
 * NEVER expose the service_role key or database password in frontend client code.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Accepts either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY for convenience
const supabasePublishableKey = 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY;

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
  : null;

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.info(
    '[Supabase Setup] Supabase credentials not found or incomplete in .env. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY when ready to activate backend services.'
  );
}
