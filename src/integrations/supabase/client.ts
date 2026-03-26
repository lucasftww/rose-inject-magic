import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// These keys are used as fallbacks if environment variables are missing (e.g. on hosted platforms)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://cthqzetkshrbsjulfytl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aHF6ZXRrc2hyYnNqdWxmeXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODQ0MzMsImV4cCI6MjA4ODA2MDQzM30.j6cRaiydfGUnoXwoz34HzL3TtnYrj93qinX7aiA9ecg';

// Debug logging for environment variables (safe version)
console.log("[Debug Env] Checking VITE_SUPABASE_URL:", !!import.meta.env.VITE_SUPABASE_URL);
console.log("[Debug Env] Checking VITE_SUPABASE_PUBLISHABLE_KEY:", !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.log("[Debug Env] Using hardcoded fallback keys - System Active.");
}

// Initialize the supabase client with safety checks
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});