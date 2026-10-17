// Server-only Supabase client. Never import this from client components.
import { createClient } from '@supabase/supabase-js';

export const BUCKET = 'images';
// Private buckets created by migration 010: raw phone uploads awaiting conversion, and removed content kept as evidence.
export const TMP_BUCKET = 'uploads-tmp';
export const QUARANTINE_BUCKET = 'quarantine';

let client = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Returns a service-role client, or null if env vars are missing (graceful fallback).
export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Next.js caches fetch() by default; Supabase reads must always be fresh
      global: { fetch: (url, opts = {}) => fetch(url, { ...opts, cache: 'no-store' }) },
    });
  }
  return client;
}

export const IMAGE_COLUMNS = 'id, created_at, prompt, style, aspect_ratio, public_url, likes, remix_of, model';
// Throwaway client for Auth calls (OTP send/verify). Never reuse the shared data client for auth:
// verifyOtp stores the user's session on the client and later queries would run as that user.
export function getAuthClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, opts = {}) => fetch(url, { ...opts, cache: 'no-store' }) },
  });
}
