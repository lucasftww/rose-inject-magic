import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/** Dev / non-production convenience only — never rely on these in production bundles. */
const DEV_FALLBACK_URL = 'https://cthqzetkshrbsjulfytl.supabase.co';
const DEV_FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aHF6ZXRrc2hyYnNqdWxmeXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0ODQ0MzMsImV4cCI6MjA4ODA2MDQzM30.j6cRaiydfGUnoXwoz34HzL3TtnYrj93qinX7aiA9ecg';

const envUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const envKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
const useDevFallback = !import.meta.env.PROD;

const SUPABASE_URL = envUrl || (useDevFallback ? DEV_FALLBACK_URL : '');
const SUPABASE_PUBLISHABLE_KEY = envKey || (useDevFallback ? DEV_FALLBACK_KEY : '');

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase configuration: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for production builds.',
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});