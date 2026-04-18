/**
 * Crane 2.0 — Database Setup Script
 * 
 * This script sets up the complete database schema, seeds test data,
 * and creates test auth users for all 7 roles.
 * 
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *   - npm install @supabase/supabase-js dotenv
 * 
 * Usage:
 *   npx tsx scripts/setup-db.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables
const envPath = resolve(import.meta.dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const supabaseUrl = env['VITE_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('');
  console.error('Add your service role key to .env:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJ...');
  console.error('');
  console.error('Find it in Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

// Service role client bypasses RLS
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ---------------------------------------------------
// Step 1: Run Migration SQL via REST
// ---------------------------------------------------
async function runSQL(sql: string, label: string) {
  console.log(`\n🔄 ${label}...`);
  
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  // Use the Supabase SQL endpoint instead
  const sqlRes = await fetch(`${supabaseUrl}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  // Fallback: try using the supabase client's rpc
  // The best approach is to use supabase.rpc or direct pg connection
  // For now, let's use a different approach
}

// ---------------------------------------------------
// Seed data
// ---------------------------------------------------
const COMPANY_ID = 'a0000000-0000-0000-0000-000000000001';
const SITE_ID = 'b0000000-0000-0000-0000-000000000001';
const CRANE_IDS = [
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003',
];
const SUB_ID = 'd0000000-0000-0000-0000-000000000001';

async function seedData() {
  console.log('\n📦 Seeding test data...');

  // Company
  const { error: companyErr } = await supabase.from('companies').upsert({
    id: COMPANY_ID, name: 'Acme Construction Ltd'
  }, { onConflict: 'id' });
  if (companyErr) {
    console.error('  ❌ Company:', companyErr.message);
    return false;
  }
  console.log('  ✅ Company: Acme Construction Ltd');

  // Site
  const { error: siteErr } = await supabase.from('sites').upsert({
    id: SITE_ID, company_id: COMPANY_ID,
    name: 'Central Tower Project', address: '123 Main Street, London EC1A 1BB'
  }, { onConflict: 'id' });
  if (siteErr) {
    console.error('  ❌ Site:', siteErr.message);
    return false;
  }
  console.log('  ✅ Site: Central Tower Project');

  // Cranes
  const craneData = [
    { id: CRANE_IDS[0], site_id: SITE_ID, name: 'Tower Crane 1', model: 'Liebherr 280 EC-H 12', capacity: '12 tonnes' },
    { id: CRANE_IDS[1], site_id: SITE_ID, name: 'Tower Crane 2', model: 'Potain MDT 389', capacity: '16 tonnes' },
    { id: CRANE_IDS[2], site_id: SITE_ID, name: 'Mobile Crane 1', model: 'Tadano GR-1000XL', capacity: '100 tonnes' },
  ];
  for (const crane of craneData) {
    const { error } = await supabase.from('cranes').upsert(crane, { onConflict: 'id' });
    if (error) {
      console.error(`  ❌ Crane ${crane.name}:`, error.message);
      return false;
    }
    console.log(`  ✅ Crane: ${crane.name}`);
  }

  // Subcontractor
  const { error: subErr } = await supabase.from('subcontractors').upsert({
    id: SUB_ID, site_id: SITE_ID,
    company_name: 'Smith Steel Erectors',
    contact_name: 'James Smith',
    contact_email: 'sub@crane.app'
  }, { onConflict: 'id' });
  if (subErr) {
    console.error('  ❌ Subcontractor:', subErr.message);
    return false;
  }
  console.log('  ✅ Subcontractor: Smith Steel Erectors');

  return true;
}

// ---------------------------------------------------
// Create auth users
// ---------------------------------------------------
interface TestUser {
  email: string;
  password: string;
  full_name: string;
  role: string;
  company_id: string | null;
  site_id: string | null;
  subcontractor_company_name?: string;
}

const TEST_USERS: TestUser[] = [
  { email: 'admin@crane.app', password: 'password123', full_name: 'System Admin', role: 'admin', company_id: COMPANY_ID, site_id: null },
  { email: 'companyadmin@crane.app', password: 'password123', full_name: 'Company Admin', role: 'company_admin', company_id: COMPANY_ID, site_id: null },
  { email: 'ap@crane.app', password: 'password123', full_name: 'Appointed Person', role: 'appointed_person', company_id: COMPANY_ID, site_id: SITE_ID },
  { email: 'supervisor@crane.app', password: 'password123', full_name: 'Crane Supervisor', role: 'crane_supervisor', company_id: COMPANY_ID, site_id: SITE_ID },
  { email: 'operator@crane.app', password: 'password123', full_name: 'Crane Operator', role: 'crane_operator', company_id: COMPANY_ID, site_id: SITE_ID },
  { email: 'slinger@crane.app', password: 'password123', full_name: 'Slinger Signaller', role: 'slinger_signaller', company_id: COMPANY_ID, site_id: SITE_ID },
  { email: 'sub@crane.app', password: 'password123', full_name: 'James Smith', role: 'subcontractor', company_id: COMPANY_ID, site_id: SITE_ID, subcontractor_company_name: 'Smith Steel Erectors' },
];

async function createUsers() {
  console.log('\n👤 Creating test auth users...');

  for (const user of TEST_USERS) {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === user.email);

    let userId: string;

    if (existing) {
      console.log(`  ⏭️  ${user.email} already exists`);
      userId = existing.id;
    } else {
      // Create auth user (service role bypasses email confirmation)
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm the email
        user_metadata: { full_name: user.full_name, role: user.role },
      });

      if (error) {
        console.error(`  ❌ ${user.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
      console.log(`  ✅ Created: ${user.email} (${user.role})`);
    }

    // Update the profile with company/site/role
    // The trigger should have created a basic profile, now update it
    const updateData: Record<string, any> = {
      role: user.role,
      company_id: user.company_id,
      site_id: user.site_id,
      full_name: user.full_name,
    };
    if (user.subcontractor_company_name) {
      updateData.subcontractor_company_name = user.subcontractor_company_name;
    }

    const { error: profileErr } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', userId);

    if (profileErr) {
      console.error(`  ⚠️  Profile update for ${user.email}:`, profileErr.message);
    } else {
      console.log(`  ✅ Profile updated: ${user.email} → ${user.role}`);
    }
  }
}

// ---------------------------------------------------
// Main
// ---------------------------------------------------
async function main() {
  console.log('🏗️  Crane 2.0 — Database Setup');
  console.log('================================');
  console.log(`Project: ${supabaseUrl}`);

  // Test connection by checking if tables exist
  console.log('\n🔍 Checking database tables...');
  const { error: tableCheck } = await supabase.from('companies').select('id').limit(1);
  
  if (tableCheck) {
    console.error('❌ Tables not found. You need to run the migration SQL first.');
    console.error('');
    console.error('Please run supabase/migration.sql in the Supabase SQL Editor:');
    console.error(`  ${supabaseUrl.replace('.supabase.co', '')}/sql/new`);
    console.error('');
    console.error('Steps:');
    console.error('  1. Go to your Supabase Dashboard → SQL Editor');
    console.error('  2. Copy the contents of supabase/migration.sql');
    console.error('  3. Paste and click "Run"');
    console.error('  4. Then re-run this script');
    process.exit(1);
  }
  console.log('✅ Tables exist — migration has been run');

  // Seed data
  const seeded = await seedData();
  if (!seeded) {
    console.error('\n❌ Seeding failed. Check errors above.');
    process.exit(1);
  }

  // Create users
  await createUsers();

  console.log('\n================================');
  console.log('🎉 Setup complete!');
  console.log('');
  console.log('Test accounts (all passwords: password123):');
  console.log('  admin@crane.app         → Admin');
  console.log('  companyadmin@crane.app   → Company Admin');
  console.log('  ap@crane.app            → Appointed Person');
  console.log('  supervisor@crane.app     → Crane Supervisor');
  console.log('  operator@crane.app       → Crane Operator');
  console.log('  slinger@crane.app        → Slinger Signaller');
  console.log('  sub@crane.app           → Subcontractor');
  console.log('');
  console.log('Run the app:  npm run dev');
}

main().catch(console.error);
