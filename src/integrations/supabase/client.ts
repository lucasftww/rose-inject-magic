import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn('⚠️ Supabase env vars missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Debug logging for environment variables (safe version)
console.log("[Debug Env] Checking VITE_SUPABASE_URL:", !!SUPABASE_URL);
console.log("[Debug Env] Checking VITE_SUPABASE_PUBLISHABLE_KEY:", !!SUPABASE_PUBLISHABLE_KEY);
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.log("[Debug Env] Available VITE keys:", Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
}

// Initialize the supabase client with safety checks
export const supabase = (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) 
  ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null as any; // Fallback to avoid crash during module load

// If supabase is null, any call to it will fail, but the app can still mount.
if (!supabase) {
  console.error('Supabase client could not be initialized due to missing environment variables.');
}