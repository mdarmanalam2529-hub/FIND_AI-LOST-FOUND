// server/scripts/activateRegisteredStudents.js
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function activateAllRegisteredStudents() {
  console.log('--- Activating Registered Students on findai-dev ---');

  // 1. Fetch all student profiles
  const { data: profiles, error: profErr } = await serviceSupabase
    .from('student_profiles')
    .select('*');

  if (profErr) {
    console.error('Error fetching student profiles:', profErr);
    process.exit(1);
  }

  console.log(`Found ${profiles.length} student profiles in database.`);

  for (const profile of profiles) {
    const regNum = profile.registration_number;
    console.log(`\nProcessing student: ${regNum} (${profile.student_name})`);

    // Ensure student_registry has is_eligible = true
    const { error: regUpdErr } = await serviceSupabase
      .from('student_registry')
      .update({ is_eligible: true })
      .eq('registration_number', regNum);

    if (regUpdErr) {
      console.warn(`[${regNum}] Warning updating registry eligibility:`, regUpdErr.message);
    }

    // Update student_profiles to active, verified
    const { data: updatedProfile, error: profUpdErr } = await serviceSupabase
      .from('student_profiles')
      .update({
        is_active: true,
        verification_status: 'verified',
        email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('registration_number', regNum)
      .select()
      .single();

    if (profUpdErr) {
      console.error(`[${regNum}] Error activating student profile:`, profUpdErr.message);
    } else {
      console.log(`[${regNum}] Profile activated successfully! is_active:`, updatedProfile.is_active);
    }

    // Update Supabase Auth user: confirm email, set password to regNum, set role
    if (profile.user_id) {
      const { data: authUser, error: authUpdErr } = await serviceSupabase.auth.admin.updateUserById(
        profile.user_id,
        {
          password: regNum, // Initial password equals registration number
          email_confirm: true,
          app_metadata: {
            role: 'student',
          },
          user_metadata: {
            ...profile.user_metadata,
            registration_number: regNum,
            full_name: profile.student_name,
            initial_password_used: true,
          },
        }
      );

      if (authUpdErr) {
        console.error(`[${regNum}] Error updating Auth user:`, authUpdErr.message);
      } else {
        console.log(`[${regNum}] Supabase Auth user updated:`);
        console.log(`  Email: ${authUser.user.email}`);
        console.log(`  Email Confirmed: ${authUser.user.email_confirmed_at}`);
        console.log(`  Password set to: ${regNum}`);
        console.log(`  Role:`, authUser.user.app_metadata?.role);
      }
    }
  }

  console.log('\n--- Verification: Testing Student Login via Supabase Auth ---');
  for (const profile of profiles) {
    const regNum = profile.registration_number;
    const loginEmail = profile.personal_email;
    console.log(`Attempting signInWithPassword for ${regNum} (${loginEmail})...`);

    const { data: signInData, error: signInErr } = await anonSupabase.auth.signInWithPassword({
      email: loginEmail,
      password: regNum,
    });

    if (signInErr) {
      console.error(`[FAIL] Login test failed for ${regNum}:`, signInErr.message);
    } else {
      console.log(`[PASS] Login test succeeded for ${regNum}! Token received:`, !!signInData.session?.access_token);
    }
  }
}

activateAllRegisteredStudents().catch(console.error);

