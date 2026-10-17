// First-party funnel analytics (server side). Pure helpers are exported for tests.
// Privacy: never stores raw IPs, emails, user ids or prompts. anon_id = HMAC(day | ip | user-agent), rotating daily.
import crypto from 'crypto';

export const MODES = ['image', 'video', 'effects', 'edit', 'facelock', 'animate'];
// event name -> allowed prop keys (anything else is dropped)
export const EVENTS = {
  landing_view: ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'device'],
  prompt_typed: [],
  generate_click: ['model', 'effect'],
  generation_success: ['model', 'effect'],
  generation_fail: ['model', 'effect', 'status'],
  signup_start: ['method'],
  signup_complete: [],
  pricing_view: ['from', 'need'],
  checkout_click: ['plan', 'from'],
  purchase: ['kind'],
  refund: ['kind'],
};
export const CLIENT_EVENTS = Object.keys(EVENTS).filter((n) => n !== 'purchase' && n !== 'refund');

const SECRET = () => process.env.CREDITS_SECRET || process.env.ADMIN_KEY || 'pp-analytics';
const cleanStr = (v, max = 48) => String(v).replace(/[^\w .:/@+-]/g, '').trim().slice(0, max);

// Returns { name, mode, props } or null when the event isn't allowed.
export function sanitizeEvent(input, { server = false } = {}) {
  const name = typeof input?.name === 'string' ? input.name : '';
  if (!Object.prototype.hasOwnProperty.call(EVENTS, name)) return null;
  if (!server && !CLIENT_EVENTS.includes(name)) return null;
  const raw = input.props && typeof input.props === 'object' ? input.props : {};
  const mode = MODES.includes(raw.mode) ? raw.mode : null;
  const props = {};
  for (const k of EVENTS[name]) {
    const v = raw[k];
    if (typeof v === 'number' && Number.isFinite(v)) props[k] = Math.round(v);
    else if (typeof v === 'boolean') props[k] = v;
    else if (typeof v === 'string' && v) { const s = cleanStr(v); if (s && !s.includes('@')) props[k] = s; }
  }
  return { name, mode, props };
}

// Referrer -> host only (no path/query, which may carry personal data).
export function refHost(ref) {
  try { const h = new URL(String(ref)).hostname.replace(/^www\./, ''); return h.slice(0, 60) || null; } catch { return null; }
}

export function dailyAnonId(ip, ua, day = new Date().toISOString().slice(0, 10)) {
  return crypto.createHmac('sha256', SECRET()).update(`aid|${day}|${ip || ''}|${String(ua || '').slice(0, 200)}`).digest('hex').slice(0, 24);
}

export function ipKey(ip) {
  return crypto.createHmac('sha256', SECRET()).update(`ipk|${ip || ''}`).digest('hex').slice(0, 20);
}

// Insert one event. Never throws (analytics must not break the product).
export async function logEvent(sb, evt, { anonId = null, source = 'client', revenueCents = null, currency = null } = {}) {
  if (!sb || !evt) return false;
  try {
    const { error } = await sb.from('analytics_events').insert({
      name: evt.name, mode: evt.mode, props: evt.props || {}, anon_id: anonId, source,
      revenue_cents: Number.isFinite(revenueCents) ? Math.round(revenueCents) : null,
      currency: currency ? cleanStr(currency, 8).toUpperCase() : null,
    });
    if (error) { if (!/analytics_events|42P01|PGRST205/i.test(`${error.message} ${error.code}`)) console.error('analytics insert', error.message); return false; }
    return true;
  } catch { return false; }
}

// Server-side event: our table + Vercel custom event (Vercel ignores it unless the team is on Pro).
export async function trackServer(sb, name, props = {}, opts = {}) {
  const evt = sanitizeEvent({ name, props }, { server: true });
  if (!evt) return false;
  try {
    const { track } = await import('@vercel/analytics/server');
    const vp = { ...evt.props, ...(evt.mode ? { mode: evt.mode } : {}), ...(Number.isFinite(opts.revenueCents) ? { amount: opts.revenueCents / 100 } : {}) };
    await Promise.race([track(name, vp).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  } catch {}
  return logEvent(sb, evt, { ...opts, source: 'server' });
}

// Lemon Squeezy event -> revenue in cents (refunds negative). Returns null when unknown.
export function lsRevenue(evt) {
  const a = evt?.data?.attributes || {};
  const name = evt?.meta?.event_name || '';
  const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
  if (/refunded$/.test(name)) { const r = num(a.refunded_amount) ?? num(a.total); return r === null ? null : -Math.abs(r); }
  return num(a.total);
}
