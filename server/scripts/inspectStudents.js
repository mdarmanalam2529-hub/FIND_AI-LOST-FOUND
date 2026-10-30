// server/scripts/inspectStudents.js
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase service role credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('--- Connected to:', supabaseUrl);

  // 1. student_registry
  const { data: registry, error: regErr } = await supabase
    .from('student_registry')
    .select('*');
  console.log('\n--- STUDENT REGISTRY ---');
  if (regErr) {
    console.error('Registry error:', regErr);
  } else {
    console.log(`Found ${registry?.length || 0} records in student_registry:`);
    console.table(registry?.map(r => ({
      reg_num: r.registration_number,
      name: r.student_name,
      is_eligible: r.is_eligible,
      email: r.official_email,
      academic_year: r.academic_year
    })));
  }

  // 2. student_profiles
  const { data: profiles, error: profErr } = await supabase
    .from('student_profiles')
    .select('*');
  console.log('\n--- STUDENT PROFILES ---');
  if (profErr) {
    console.error('Profiles error:', profErr);
  } else {
    console.log(`Found ${profiles?.length || 0} records in student_profiles:`);
    console.table(profiles?.map(p => ({
      reg_num: p.registration_number,
      name: p.student_name,
      is_active: p.is_active,
      verification_status: p.verification_status,
      email_verified: p.email_verified,
      user_id: p.user_id,
      personal_email: p.personal_email
    })));
  }

  // 3. auth.users
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  console.log('\n--- AUTH USERS ---');
  if (authErr) {
    console.error('Auth users error:', authErr);
  } else {
    console.log(`Found ${authUsers?.users?.length || 0} users in Supabase Auth:`);
    console.table(authUsers?.users?.map(u => ({
      id: u.id,
      email: u.email,
      email_confirmed_at: u.email_confirmed_at,
      reg_num: u.user_metadata?.registration_number,
      role: u.app_metadata?.role
    })));
  }
}

run();

