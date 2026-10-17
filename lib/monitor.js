// Error monitoring without an external account: errors are deduped by fingerprint into Supabase error_log
// (migration 011) and shown in /admin/stats. Pure helpers are exported for tests.
//
// Optional Sentry later (not installed): `npm i @sentry/nextjs`, set SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN, and call
// Sentry.captureException(err) inside reportError() below and in app/telemetry.js reportClientError(). See README.
import { scrub, normalizeForFingerprint, routeTemplate, fingerprint } from './errorCore.js';
import { NextResponse } from 'next/server';
import { getSupabase } from './supabase.js';

const RELEASE = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null;

export { scrub, normalizeForFingerprint, routeTemplate, fingerprint };

// Store an error (deduped). Never throws.
export async function reportError({ source = 'server', route = '', message = '', stack = '', release = RELEASE } = {}, sb = getSupabase()) {
  // Sentry hook point (optional, see header comment).
  if (!sb) return null;
  const msg = scrub(message || 'Unknown error');
  try {
    const { data, error } = await sb.rpc('log_error', {
      p_fp: fingerprint(source, route, msg, stack), p_source: source, p_route: routeTemplate(route),
      p_message: msg, p_stack: stack ? scrub(stack, 2000) : null, p_release: release ? String(release).slice(0, 40) : null,
    });
    return error ? null : data;
  } catch { return null; }
}

// Wrap an App Router handler: thrown errors and 5xx responses are recorded; behaviour is otherwise unchanged
// (a thrown error becomes the same generic 500 Next.js would send, but as JSON).
export function withErrorLog(route, handler) {
  return async function wrapped(request, ctx) {
    try {
      const res = await handler(request, ctx);
      if (res && typeof res.status === 'number' && res.status >= 500 && res.status !== 503) {
        let message = `HTTP ${res.status}`;
        try { const d = await res.clone().json(); if (d?.error) message = `HTTP ${res.status}: ${d.error}`; } catch {}
        await reportError({ source: 'server', route: `${request?.method || ''} ${route}`.trim(), message });
      }
      return res;
    } catch (err) {
      console.error(`[${route}]`, err);
      await reportError({ source: 'server', route: `${request?.method || ''} ${route}`.trim(), message: err?.message || String(err), stack: err?.stack });
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  };
}
