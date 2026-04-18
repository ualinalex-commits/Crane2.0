import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

// Using untyped client to avoid strict type issues during development.
// Once Supabase CLI generates types, replace with createClient<Database>().
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
