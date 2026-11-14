// A small record of what goes wrong, kept in the counters the site already has (no new table, no outside
// service): one counter per place and message per day. /admin shows today's and yesterday's.
// Nothing personal is kept: ids, addresses, links and numbers are taken out of the message first.
import { bump } from './usage.js';

export function cleanMessage(s) {
  return String(s || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/https?:\/\/\S+/g, '<link>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{20,}/gi, '<id>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ').trim().slice(0, 110);
}
// What a console.error call said, in one line: the words, and for an Error or an answer object its message only
// (never the whole object, which can hold a prompt).
export function textOf(args) {
  return args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : a && typeof a === 'object' ? String(a.message || a.detail || a.title || (typeof a.error === 'string' ? a.error : '') || '') : typeof a === 'number' ? String(a) : '')).filter(Boolean).join(' ');
}

// Lines that are written like errors but are not: Node's own notices about itself, and a video that needed no repair.
export const NOISE = /^\(node:#?\d*\) \w*Warning|ExperimentalWarning|DeprecationWarning|^video repair skipped/i;
// What kind of trouble a message is, for /admin: the kinds that need the owner come first, in color.
//   safety: a safety check that failed or gave no answer    rate: the model service slowing the site down
//   balance: the model service's credit is low or used up   '': everything else
export function kindOf(message) {
  const m = String(message || '');
  if (/less than \$?\s?# in credit|insufficient credit|out of credit|purchase credit|payment required|until you have/i.test(m)) return 'balance';
  if (/safety check|nsfw|classifier|moderation/i.test(m)) return 'safety';
  if (/throttl|rate limit|slow down|too many requests|\b429\b/i.test(m)) return 'rate';
  return '';
}
const KIND_ORDER = { safety: 0, balance: 1, rate: 2, '': 3 };

let windowAt = 0, sent = 0;
// At most 30 notes a minute from one server instance, so an error that repeats cannot flood the database.
export function noteError(where, message) {
  const text = cleanMessage(message);
  if (!text || /^bump_usage error/.test(text)) return; // the counter itself failing must not be counted with the counter
  if (NOISE.test(text)) return;
  const now = Date.now();
  if (now - windowAt > 60_000) { windowAt = now; sent = 0; }
  if (++sent > 30) return;
  bump(`err:${where}:${text}`, 1, 1e9).catch(() => {});
}

// For /admin: [{ where, message, today, yesterday }], most frequent first.
export function summarize(rows, today, yesterday) {
  const by = new Map();
  for (const r of rows || []) {
    const m = /^err:([a-z]+):(.*)$/s.exec(r.key || '');
    const day = String(r.day).slice(0, 10);
    if (!m || (day !== today && day !== yesterday) || NOISE.test(m[2])) continue; // noise counted before it was filtered is not shown either
    const k = `${m[1]}|${m[2]}`;
    const e = by.get(k) || { where: m[1], message: m[2], kind: kindOf(m[2]), today: 0, yesterday: 0 };
    e[day === today ? 'today' : 'yesterday'] += Math.max(0, Number(r.amount) || 0);
    by.set(k, e);
  }
  return [...by.values()].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.today - a.today || b.yesterday - a.yesterday);
}
