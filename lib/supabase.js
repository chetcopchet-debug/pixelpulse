// Server-only Supabase client. Never import this from client components.
import { createClient } from '@supabase/supabase-js';

export const BUCKET = 'images';

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

export const IMAGE_COLUMNS = 'id, created_at, prompt, style, aspect_ratio, public_url, likes, remix_of';
