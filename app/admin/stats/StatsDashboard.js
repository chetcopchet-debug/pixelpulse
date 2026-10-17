'use client';
import { useEffect, useState } from 'react';

const C = { bg: '#07070a', card: '#101018', line: '#23233a', dim: '#7c7c94', text: '#e9e7f5', a: '#a855f7', b: '#ec4899', red: '#f87171', ok: '#4ade80' };
const money = (c) => `${c < 0 ? '−' : ''}$${(Math.abs(c || 0) / 100).toFixed(2)}`;
const fmt = (t) => (t ? new Date(t).toLocaleString() : '—');
const ago = (t) => { const s = (Date.now() - Date.parse(t)) / 1000; if (!(s >= 0)) return '—'; if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`; if (s < 86400) return `${Math.round(s / 3600)}h ago`; return `${Math.round(s / 86400)}d ago`; };
const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 14 };
const pill = (on) => ({ padding: '7px 13px', borderRadius: 999, border: `1px solid ${on ? 'transparent' : C.line}`, background: on ? `linear-gradient(90deg,${C.a},${C.b})` : '#15151f', color: '#fff', fontSize: 13, fontWeight: 700 });
const MODE_ICON = { image: '◆ Image', video: '▶ Video', effects: '✦ Effects', edit: '✎ Edit', facelock: '◉ Face Lock', animate: '▶ Animate', other: '· Other tools' };

function Kpi({ label, value, sub, warn }) {
  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ fontSize: 12, color: C.dim }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: warn ? C.red : C.text, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.dim }}>{sub}</div>}
    </div>
  );
}

function DailyChart({ days }) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.visitors, d.generations)));
  return (
    <div style={card}>
      <b style={{ fontSize: 14 }}>Daily</b>
      <span style={{ fontSize: 12, color: C.dim, marginLeft: 8 }}><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.a }} /> visitors <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.b, marginLeft: 8 }} /> generations</span>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130, marginTop: 12 }}>
        {days.map((d) => (
          <div key={d.day} title={`${d.day}: ${d.visitors} visitors · ${d.generations} generations · ${money(d.revenueCents)}`} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%' }}>
            <div style={{ flex: 1, height: `${(d.visitors / max) * 100}%`, minHeight: d.visitors ? 2 : 0, background: C.a, borderRadius: '4px 4px 0 0' }} />
            <div style={{ flex: 1, height: `${(d.generations / max) * 100}%`, minHeight: d.generations ? 2 : 0, background: C.b, borderRadius: '4px 4px 0 0' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.dim, marginTop: 4 }}>
        <span>{days[0]?.day.slice(5)}</span><span>{days.at(-1)?.day.slice(5)}</span>
      </div>
    </div>
  );
}

function Funnel({ steps }) {
  const top = Math.max(1, steps[0]?.uniques || 0);
  return (
    <div style={card}>
      <b style={{ fontSize: 14 }}>Funnel</b> <span style={{ fontSize: 12, color: C.dim }}>unique visitors per day, summed</span>
      {steps.map((s, i) => (
        <div key={s.key} style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{s.label}</span>
            <span><b>{s.uniques.toLocaleString('en-US')}</b> <span style={{ color: C.dim }}>{i ? `· ${s.pctOfPrev}% of prev` : ''}</span></span>
          </div>
          <div style={{ height: 8, background: '#1a1a28', borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (s.uniques / top) * 100)}%`, height: '100%', background: `linear-gradient(90deg,${C.a},${C.b})`, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ByMode({ rows }) {
  const th = { textAlign: 'right', padding: '6px 4px', color: C.dim, fontWeight: 600 };
  const td = { textAlign: 'right', padding: '7px 4px' };
  return (
    <div style={card}>
      <b style={{ fontSize: 14 }}>Generations by mode</b>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
        <thead><tr><th style={{ ...th, textAlign: 'left' }}>Mode</th><th style={th}>Clicks</th><th style={th}>OK</th><th style={th}>Failed</th><th style={th} title="Server generation log">Logged</th><th style={th}>Blocked</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const rate = r.clicks ? Math.round((r.success / r.clicks) * 100) : null;
            return (
              <tr key={r.mode} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ ...td, textAlign: 'left' }}>{MODE_ICON[r.mode] || r.mode}</td>
                <td style={td}>{r.clicks}</td>
                <td style={td}>{r.success}{rate !== null && <small style={{ color: C.dim }}> {rate}%</small>}</td>
                <td style={{ ...td, color: r.fail ? C.red : C.text }}>{r.fail}</td>
                <td style={td}>{r.logged}</td>
                <td style={{ ...td, color: r.blocked ? '#fbbf24' : C.text }}>{r.blocked}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Errors({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={card}>
      <b style={{ fontSize: 14 }}>Errors</b> <span style={{ fontSize: 12, color: C.dim }}>grouped, newest first</span>
      {!items.length && <p style={{ color: C.ok, fontSize: 13 }}>No errors in this period.</p>}
      {items.map((e) => (
        <div key={e.fingerprint} onClick={() => setOpen(open === e.fingerprint ? null : e.fingerprint)} style={{ borderTop: `1px solid ${C.line}`, padding: '9px 0', cursor: 'pointer' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: e.source === 'server' ? '#3b0a1e' : '#1e1438', color: e.source === 'server' ? '#fda4af' : '#c4b5fd' }}>{e.source}</span>
            <span style={{ flex: 1, fontSize: 13, wordBreak: 'break-word' }}>{e.message}</span>
            <b style={{ fontSize: 13 }}>×{e.count}</b>
          </div>
          <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3 }}>{e.route || '—'} · last {ago(e.last_seen)}{e.release ? ` · ${e.release}` : ''}</div>
          {open === e.fingerprint && (
            <div style={{ fontSize: 11.5, color: C.dim, marginTop: 6 }}>
              First seen {fmt(e.first_seen)} · last seen {fmt(e.last_seen)}
              {e.stack && <pre style={{ whiteSpace: 'pre-wrap', background: '#0b0b12', border: `1px solid ${C.line}`, borderRadius: 10, padding: 8, marginTop: 6, maxHeight: 200, overflow: 'auto' }}>{e.stack}</pre>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// /admin/stats — visitors, funnel, generations by mode, revenue and errors (requires the admin cookie from /admin).
export default function StatsDashboard() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = async (d = days) => {
    setErr('');
    const r = await fetch(`/api/admin/stats?days=${d}`, { cache: 'no-store' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setErr(r?.status === 404 ? 'Log in at /admin first.' : j.error || 'Stats are unavailable.'); setData(null); return; }
    setData(j);
  };
  useEffect(() => { load(days); }, [days]);
  const t = data?.totals;
  return (
    <main style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui,sans-serif', padding: 16, maxWidth: 820, margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 18, flex: 1 }}>◉ PixelPulse stats</b>
        {[7, 14, 30].map((d) => <button key={d} style={pill(days === d)} onClick={() => setDays(d)}>{d}d</button>)}
        <button style={pill(false)} onClick={() => load()}>↻</button>
      </div>
      {err && <p style={{ color: C.red }}>{err}</p>}
      {!data && !err && <p style={{ color: C.dim }}>Loading…</p>}
      {data && (
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))' }}>
            <Kpi label="Visitors" value={t.visitors.toLocaleString('en-US')} sub="unique per day, summed" />
            <Kpi label="Generations" value={t.generations.toLocaleString('en-US')} sub="server log" />
            <Kpi label="Sign-ins" value={t.signupComplete} sub={`${t.signupStart} started`} />
            <Kpi label="Purchases" value={t.purchases} sub={t.refunds ? `${t.refunds} refunded` : 'no refunds'} />
            <Kpi label="Revenue" value={money(t.revenueCents)} sub="gross, before fees" />
            <Kpi label="Errors" value={t.errorOccurrences} sub={`${t.errorTypes} distinct`} warn={t.errorOccurrences > 0} />
          </div>
          <DailyChart days={data.days} />
          <Funnel steps={data.funnel} />
          <ByMode rows={data.byMode} />
          <Errors items={data.errors} />
          <p style={{ fontSize: 11.5, color: C.dim, margin: 0 }}>Days are UTC. Visitors are counted with a one-way hash that changes daily — no IPs, emails or prompts are stored. Your own visits while logged in as admin are not counted.</p>
        </div>
      )}
      <p style={{ display: 'flex', gap: 14, fontSize: 13 }}><a href="/admin" style={{ color: C.dim }}>Admin login</a><a href="/admin/reports" style={{ color: C.dim }}>Reports queue</a></p>
    </main>
  );
}
