import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

// Using untyped client to avoid strict type issues during development.
// Once Supabase CLI generates types, replace with createClient<Database>().
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Admin client for privileged operations (user creation, etc.)
 * Uses the service_role key which bypasses RLS.
 * 
 * ⚠️  SECURITY WARNING: This exposes the service role key to the browser.
 * In production, user creation should be handled via Supabase Edge Functions
 * or a backend API. This is acceptable for development only.
 */
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
