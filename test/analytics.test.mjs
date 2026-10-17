import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) {
  try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.m?js$/.test(s)) return next(s + '.js', c); throw e; } }`));
const { sanitizeEvent, refHost, dailyAnonId, lsRevenue, logEvent, CLIENT_EVENTS } = await import('../lib/analytics.js');
const { scrub, fingerprint, routeTemplate } = await import('../lib/errorCore.js');
const { buildStats } = await import('../lib/statsAggregate.js');
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('sanitizeEvent: whitelist names, modes and props; no PII', () => {
  assert.equal(sanitizeEvent({ name: 'evil' }), null);
  assert.equal(sanitizeEvent({ name: '__proto__' }), null);
  assert.equal(sanitizeEvent({ name: 'purchase', props: { kind: 'pack' } }), null, 'clients cannot fake purchases');
  assert.ok(sanitizeEvent({ name: 'purchase', props: { kind: 'pack' } }, { server: true }));
  const e = sanitizeEvent({ name: 'generate_click', props: { mode: 'video', model: 'kling', prompt: 'a secret prompt', email: 'a@b.co' } });
  assert.deepEqual(e, { name: 'generate_click', mode: 'video', props: { model: 'kling' } });
  assert.equal(sanitizeEvent({ name: 'generate_click', props: { mode: 'hack' } }).mode, null);
  assert.equal(sanitizeEvent({ name: 'checkout_click', props: { plan: 'x@y.com' } }).props.plan, undefined, 'emails dropped');
  assert.equal(sanitizeEvent({ name: 'pricing_view', props: { need: 'n'.repeat(500) } }).props.need.length, 48);
  assert.equal(sanitizeEvent({ name: 'prompt_typed', props: { text: 'hello' } }).props.text, undefined);
  assert.ok(!CLIENT_EVENTS.includes('refund'));
});

test('referrer host only, daily anon id rotates and is not the IP', () => {
  assert.equal(refHost('https://www.tiktok.com/@user/video/1?x=y'), 'tiktok.com');
  assert.equal(refHost('nope'), null);
  const a = dailyAnonId('1.2.3.4', 'UA', '2026-10-17');
  assert.equal(a, dailyAnonId('1.2.3.4', 'UA', '2026-10-17'));
  assert.notEqual(a, dailyAnonId('1.2.3.4', 'UA', '2026-10-18'));
  assert.ok(!a.includes('1.2.3.4') && a.length === 24);
});

test('lsRevenue: totals in cents, refunds negative', () => {
  assert.equal(lsRevenue({ meta: { event_name: 'order_created' }, data: { attributes: { total: 990 } } }), 990);
  assert.equal(lsRevenue({ meta: { event_name: 'order_refunded' }, data: { attributes: { total: 990, refunded_amount: 990 } } }), -990);
  assert.equal(lsRevenue({ meta: { event_name: 'subscription_payment_success' }, data: { attributes: {} } }), null);
});

test('logEvent never throws and tolerates a missing table', async () => {
  assert.equal(await logEvent(null, { name: 'x' }), false);
  const sb = { from: () => ({ insert: async () => ({ error: { message: 'relation analytics_events does not exist', code: '42P01' } }) }) };
  assert.equal(await logEvent(sb, { name: 'landing_view', mode: null, props: {} }), false);
  const boom = { from: () => { throw new Error('down'); } };
  assert.equal(await logEvent(boom, { name: 'landing_view', props: {} }), false);
  let row; const ok = { from: () => ({ insert: async (r) => { row = r; return { error: null }; } }) };
  assert.equal(await logEvent(ok, { name: 'purchase', mode: null, props: { kind: 'pack' } }, { source: 'server', revenueCents: 990.4, currency: 'usd' }), true);
  assert.deepEqual(row, { name: 'purchase', mode: null, props: { kind: 'pack' }, anon_id: null, source: 'server', revenue_cents: 990, currency: 'USD' });
});

test('scrub removes emails, IPs, tokens and query strings', () => {
  const s = scrub('fail for bob@mail.com from 10.1.2.3 token=abc123 https://x.supabase.co/obj?sig=zzz eyJhbGciOi.eyJzdWIi.sig ' + 'A'.repeat(40));
  assert.ok(!s.includes('bob@mail.com') && s.includes('[email]'));
  assert.ok(!s.includes('10.1.2.3'));
  assert.ok(!s.includes('abc123'));
  assert.ok(!s.includes('sig=zzz') && s.includes('?[query]'));
  assert.ok(!s.includes('eyJhbGciOi'));
  assert.ok(!s.includes('A'.repeat(40)));
  assert.equal(scrub('ab '.repeat(400)).length, 500);
});

test('fingerprint groups the same bug across ids/numbers, separates different bugs', () => {
  const a = fingerprint('server', '/api/generate', 'Image 1234 failed for 0b6f1c2e-1111-4222-8333-444455556666', 'Error\n    at run (/var/task/x.js:10:5)');
  const b = fingerprint('server', '/api/generate', 'Image 98 failed for 9c6f1c2e-1111-4222-8333-444455556666', 'Error\n    at run (/var/task/x.js:99:1)');
  const c = fingerprint('server', '/api/edit', 'Image 98 failed for x', '');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, fingerprint('client', '/api/generate', 'Image 1 failed for x', ''));
  assert.equal(routeTemplate('/p/0b6f1c2e-1111-4222-8333-444455556666?x=1'), '/p/:id');
});

test('buildStats: visitors, funnel, modes, revenue, errors', () => {
  const today = '2026-10-17';
  const events = [
    { day: '2026-10-16', name: 'landing_view', mode: null, events: 120, uniques: 100, revenue_cents: 0 },
    { day: '2026-10-17', name: 'landing_view', mode: null, events: 60, uniques: 50, revenue_cents: 0 },
    { day: '2026-10-17', name: 'prompt_typed', mode: 'image', events: 30, uniques: 30, revenue_cents: 0 },
    { day: '2026-10-17', name: 'generate_click', mode: 'image', events: 40, uniques: 20, revenue_cents: 0 },
    { day: '2026-10-17', name: 'generate_click', mode: 'video', events: 5, uniques: 5, revenue_cents: 0 },
    { day: '2026-10-17', name: 'generation_success', mode: 'image', events: 36, uniques: 18, revenue_cents: 0 },
    { day: '2026-10-17', name: 'generation_fail', mode: 'video', events: 1, uniques: 1, revenue_cents: 0 },
    { day: '2026-10-17', name: 'purchase', mode: null, events: 2, uniques: 0, revenue_cents: 1980 },
    { day: '2026-10-17', name: 'refund', mode: null, events: 1, uniques: 0, revenue_cents: -990 },
    { day: '2026-09-01', name: 'landing_view', mode: null, events: 999, uniques: 999, revenue_cents: 0 },
  ];
  const generations = [
    { day: '2026-10-17', mode: 'generate', moderation: 'passed', n: 30 },
    { day: '2026-10-17', mode: 'generate:guided', moderation: 'passed', n: 2 },
    { day: '2026-10-17', mode: 'generate', moderation: 'blocked:text', n: 3 },
    { day: '2026-10-17', mode: 't2v:kling', moderation: 'passed', n: 4 },
    { day: '2026-10-17', mode: 'effect:hug', moderation: 'passed', n: 1 },
    { day: '2026-10-17', mode: 'repaint', moderation: 'passed', n: 2 },
  ];
  const errors = [{ fingerprint: 'f1', source: 'server', route: 'POST /api/generate', message: 'HTTP 500', count: 4, first_seen: '2026-10-15T00:00:00Z', last_seen: '2026-10-17T01:00:00Z' }];
  const s = buildStats({ events, generations, errors, days: 7, today });
  assert.equal(s.days.length, 7);
  assert.equal(s.days.at(-1).day, today);
  assert.equal(s.totals.visitors, 150, 'old rows outside the range are ignored');
  assert.equal(s.totals.generations, 39, 'blocked attempts are not generations');
  assert.equal(s.totals.revenueCents, 990);
  assert.equal(s.totals.purchases, 2);
  assert.equal(s.totals.refunds, 1);
  assert.equal(s.funnel[0].uniques, 150);
  assert.equal(s.funnel[1].pctOfTop, 20);
  assert.equal(s.funnel.at(-1).key, 'purchase');
  const img = s.byMode.find((r) => r.mode === 'image');
  assert.deepEqual([img.clicks, img.success, img.logged, img.blocked], [40, 36, 32, 3]);
  assert.equal(s.byMode.find((r) => r.mode === 'video').logged, 4);
  assert.equal(s.byMode.find((r) => r.mode === 'effects').logged, 1);
  assert.equal(s.byMode.find((r) => r.mode === 'other').logged, 2);
  assert.equal(s.totals.errorOccurrences, 4);
  assert.equal(buildStats({ days: 7, today }).funnel[1].pctOfTop, 0, 'empty data does not divide by zero');
});

test('wiring: routes wrapped, events instrumented, migration safe', () => {
  for (const r of ['generate', 'edit', 'facelock', 'animate', 'repaint', 'amplify', 'upload', 'checkout', 'webhooks/lemonsqueezy', 'webhooks/replicate']) {
    assert.match(src(`app/api/${r}/route.js`), /export const (POST|GET) = withErrorLog\(/, r);
  }
  const page = src('app/page.js');
  for (const m of ['image', 'video', 'effects', 'edit', 'facelock', 'animate']) assert.match(page, new RegExp(`track\\("generate_click", \\{ mode: "${m}"`), m);
  for (const n of ['landing_view', 'prompt_typed', 'signup_complete', 'pricing_view', 'generation_success', 'generation_fail']) assert.ok(page.includes(`"${n}"`), n);
  assert.ok(!/track\([^)]*prompt:/.test(page), 'prompts are never sent to analytics');
  assert.match(src('app/AuthSheet.js'), /signup_start/);
  assert.match(src('app/PricingModal.js'), /checkout_click/);
  assert.match(src('app/api/webhooks/lemonsqueezy/route.js'), /if \(bal !== null\) await trackServer\(/);
  const sql = src('supabase/migrations/011_analytics_monitoring.sql');
  assert.match(sql, /create table if not exists public\.analytics_events/);
  assert.match(sql, /create table if not exists public\.error_log/);
  assert.equal((sql.match(/enable row level security/g) || []).length, 2);
  assert.ok(!/create policy/i.test(sql), 'service-role only');
  assert.ok(!/\bip\b\s+text|prompt\s+text|email/i.test(sql.replace(/--.*$/gm, '')), 'no PII columns');
  assert.match(src('app/layout.js'), /VercelAnalytics/);
  assert.match(src('app/VercelAnalytics.js'), /beforeSend/);
});
