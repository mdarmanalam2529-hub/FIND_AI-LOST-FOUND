// server/scripts/updateAdminUserRole.js
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

async function setAdminRole() {
  const adminEmail = 'mdarmanalam2529@gmail.com';
  console.log(`[AdminRoleUpdate] Searching for user ${adminEmail}...`);

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('Failed to list users:', listErr);
    process.exit(1);
  }

  const user = users.find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase());
  if (!user) {
    console.error(`User with email ${adminEmail} not found!`);
    process.exit(1);
  }

  console.log(`[AdminRoleUpdate] Found user ${user.id} (${user.email}). Current app_metadata:`, user.app_metadata);

  const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      role: 'primary_admin',
    },
    user_metadata: {
      ...user.user_metadata,
      full_name: user.user_metadata?.full_name || 'System Administrator',
      role: 'primary_admin',
    },
  });

  if (updateErr) {
    console.error('Failed to update user:', updateErr);
    process.exit(1);
  }

  console.log('[AdminRoleUpdate] Successfully updated admin account in findai-dev:');
  console.log('ID:', updated.user.id);
  console.log('Email:', updated.user.email);
  console.log('App Metadata:', updated.user.app_metadata);
  console.log('User Metadata:', updated.user.user_metadata);
}

setAdminRole();

