import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep the app booting in development with a clear failure message at runtime.
  // eslint-disable-next-line no-console
  console.warn("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
