// Pure aggregation for /admin/stats. Inputs are the rows returned by analytics_daily / generation_daily / error_log.
export const FUNNEL = [
  ['landing_view', 'Visited'],
  ['prompt_typed', 'Typed a prompt'],
  ['generate_click', 'Clicked generate'],
  ['generation_success', 'Got a result'],
  ['pricing_view', 'Saw pricing'],
  ['checkout_click', 'Clicked checkout'],
];
export const STAT_MODES = ['image', 'video', 'effects', 'edit', 'facelock', 'animate'];

const n = (v) => Number(v) || 0;

function dayList(days, today) {
  const out = [];
  const t = Date.parse(`${today}T00:00:00Z`);
  for (let i = days - 1; i >= 0; i--) out.push(new Date(t - i * 86400_000).toISOString().slice(0, 10));
  return out;
}

export function buildStats({ events = [], generations = [], errors = [], days = 14, today = new Date().toISOString().slice(0, 10) } = {}) {
  const list = dayList(days, today);
  const inRange = new Set(list);
  const ev = events.filter((r) => inRange.has(String(r.day).slice(0, 10)));
  const gen = generations.filter((r) => inRange.has(String(r.day).slice(0, 10)));

  // Visitors per day = distinct daily anon ids on landing_view (rows are per day+name+mode, so sum uniques over modes
  // only for landing_view which has no mode).
  const byDay = Object.fromEntries(list.map((d) => [d, { day: d, visitors: 0, generations: 0, revenueCents: 0, purchases: 0 }]));
  for (const r of ev) {
    const d = byDay[String(r.day).slice(0, 10)];
    if (r.name === 'landing_view') d.visitors += n(r.uniques);
    if (r.name === 'purchase') { d.revenueCents += n(r.revenue_cents); d.purchases += n(r.events); }
    if (r.name === 'refund') d.revenueCents += n(r.revenue_cents);
  }
  for (const r of gen) {
    if (!/^blocked/.test(r.moderation || '')) byDay[String(r.day).slice(0, 10)].generations += n(r.n);
  }

  // Funnel: visitor-days that reached each step (sum of daily uniques).
  const uniq = (name) => ev.filter((r) => r.name === name).reduce((s, r) => s + n(r.uniques), 0);
  const top = uniq(FUNNEL[0][0]);
  const funnel = FUNNEL.map(([key, label], i) => {
    const u = uniq(key);
    const prev = i ? uniq(FUNNEL[i - 1][0]) : u;
    return { key, label, uniques: u, pctOfTop: top ? Math.round((u / top) * 1000) / 10 : 0, pctOfPrev: prev ? Math.round((u / prev) * 1000) / 10 : 0 };
  });
  const purchases = ev.filter((r) => r.name === 'purchase').reduce((s, r) => s + n(r.events), 0);
  funnel.push({ key: 'purchase', label: 'Purchased', uniques: purchases, pctOfTop: top ? Math.round((purchases / top) * 1000) / 10 : 0, pctOfPrev: funnel.at(-1).uniques ? Math.round((purchases / funnel.at(-1).uniques) * 1000) / 10 : 0 });

  // Generations by mode: client clicks/success/fail + server-logged generations.
  const serverMode = (m0) => { const m = String(m0 || ''); if (m.startsWith('generate')) return 'image'; if (m.startsWith('t2v')) return 'video'; if (m.startsWith('effect')) return 'effects'; return m; };
  const modes = Object.fromEntries(STAT_MODES.map((m) => [m, { mode: m, clicks: 0, success: 0, fail: 0, logged: 0, blocked: 0 }]));
  const other = { mode: 'other', clicks: 0, success: 0, fail: 0, logged: 0, blocked: 0 };
  for (const r of ev) {
    const row = modes[r.mode]; if (!row) continue;
    if (r.name === 'generate_click') row.clicks += n(r.events);
    if (r.name === 'generation_success') row.success += n(r.events);
    if (r.name === 'generation_fail') row.fail += n(r.events);
  }
  for (const r of gen) {
    const row = modes[serverMode(r.mode)] || other;
    if (/^blocked/.test(r.moderation || '')) row.blocked += n(r.n); else row.logged += n(r.n);
  }
  const byMode = [...Object.values(modes), ...(other.logged || other.blocked ? [other] : [])];

  const sumEv = (name, field = 'events') => ev.filter((r) => r.name === name).reduce((s, r) => s + n(r[field]), 0);
  const revenueCents = Object.values(byDay).reduce((s, d) => s + d.revenueCents, 0);
  const since = Date.parse(`${list[0]}T00:00:00Z`);
  const recentErrors = errors.filter((e) => Date.parse(e.last_seen) >= since);
  return {
    days: list.map((d) => byDay[d]),
    totals: {
      visitors: Object.values(byDay).reduce((s, d) => s + d.visitors, 0),
      generations: Object.values(byDay).reduce((s, d) => s + d.generations, 0),
      signupStart: sumEv('signup_start', 'uniques'),
      signupComplete: sumEv('signup_complete', 'uniques'),
      purchases,
      refunds: sumEv('refund'),
      revenueCents,
      errorOccurrences: recentErrors.reduce((s, e) => s + n(e.count), 0),
      errorTypes: recentErrors.length,
    },
    funnel,
    byMode,
    errors: recentErrors.slice(0, 50).map((e) => ({ fingerprint: e.fingerprint, source: e.source, route: e.route, message: e.message, count: n(e.count), first_seen: e.first_seen, last_seen: e.last_seen, release: e.release, stack: e.stack })),
  };
}
