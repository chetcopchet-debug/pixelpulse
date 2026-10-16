'use client';
import { useEffect, useState } from 'react';

const fmt = (t) => (t ? new Date(t).toLocaleString() : '—');
const btn = (bg) => ({ padding: '8px 12px', borderRadius: 999, border: '1px solid #2a2a40', background: bg || '#15151f', color: '#fff', fontSize: 13, fontWeight: 700 });

// Admin report queue (requires the admin cookie from /admin). Restore, remove, delete permanently, ban/unban.
export default function ReportsQueue() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const load = async () => {
    const r = await fetch('/api/admin/reports', { cache: 'no-store' }); const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(r.status === 404 ? 'Log in at /admin first.' : d.error || 'Unavailable'); setItems([]); return; }
    setErr(''); setItems(d.items || []);
  };
  useEffect(() => { load(); }, []);
  const act = async (id, action) => {
    if (action === 'delete' && !window.confirm('Delete permanently? This cannot be undone.')) return;
    const r = await fetch('/api/admin/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error || 'Failed'); return; }
    load();
  };
  return (
    <main style={{ minHeight: '100vh', background: '#07070a', color: '#e9e7f5', fontFamily: 'system-ui,sans-serif', padding: 16, maxWidth: 760, margin: '0 auto' }}>
      <b style={{ fontSize: 18 }}>◉ Reports queue</b> <button style={btn()} onClick={load}>Refresh</button>
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      {items === null && <p>Loading…</p>}
      {items?.length === 0 && !err && <p style={{ color: '#7c7c94' }}>Nothing to review.</p>}
      {items?.map((i) => (
        <section key={i.id} style={{ border: `1px solid ${i.overdue ? '#f87171' : '#23233a'}`, borderRadius: 18, padding: 12, margin: '12px 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href={i.public_url} target="_blank" rel="noreferrer" style={{ flex: '0 0 120px' }}>
            {/\.mp4(\?|$)/i.test(i.public_url) ? <video src={i.public_url} muted style={{ width: 120, borderRadius: 12 }} /> : <img src={i.public_url} alt="" style={{ width: 120, borderRadius: 12, filter: 'blur(8px)' }} />}
          </a>
          <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            <div><b>{i.removed_at ? `Removed (${i.removal_reason})` : i.hidden ? 'Hidden' : 'Visible'}</b> · {i.report_count} report(s) · creator {i.creator || '—'} · strikes {i.strikes}{i.banned ? ' · BANNED' : ''}</div>
            <div style={{ color: i.overdue ? '#f87171' : '#fbbf24' }}>48h SLA due: {fmt(i.slaDue)}{i.overdue ? ' — OVERDUE' : ''}</div>
            <div style={{ color: '#7c7c94', margin: '4px 0' }}>{(i.prompt || '').slice(0, 200)}</div>
            <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
              {i.reports.map((r, k) => <li key={k}><b>{r.reason_code || 'legacy'}</b> {r.details || (!r.reason_code && r.reason) || ''} <span style={{ color: '#7c7c94' }}>· {fmt(r.created_at)}</span></li>)}
            </ul>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <button style={btn()} onClick={() => act(i.id, 'restore')}>Restore</button>
              {!i.removed_at && <button style={btn()} onClick={() => act(i.id, 'remove')}>Remove (strike)</button>}
              <button style={btn('#7f1d1d')} onClick={() => act(i.id, 'delete')}>Delete permanently</button>
              <button style={btn()} onClick={() => act(i.id, i.banned ? 'unban' : 'ban')}>{i.banned ? 'Unban creator' : 'Ban creator'}</button>
            </div>
          </div>
        </section>
      ))}
      <p><a href="/admin" style={{ color: '#7c7c94' }}>Admin login</a></p>
    </main>
  );
}
