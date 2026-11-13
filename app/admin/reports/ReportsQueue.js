'use client';
import { useEffect, useState } from 'react';

const fmt = (t) => (t ? new Date(t).toLocaleString() : 'not set');

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
    <>
      <div className="r" style={{ gap: 12, justifyContent: 'space-between' }}><h1>Reports</h1><button className="btn btn-s" onClick={load}>Refresh</button></div>
      {err && <p className="bad" role="alert">{err}</p>}
      {items === null && <p className="t2">Loading…</p>}
      {items?.length === 0 && !err && <p className="t2">Nothing to review.</p>}
      {items?.map((i) => (
        <section key={i.id} className="card" style={{ padding: 12, margin: '12px 0', display: 'flex', gap: 12, flexWrap: 'wrap', boxShadow: i.overdue ? 'inset 0 0 0 1px var(--neg)' : undefined }}>
          <a href={i.public_url} target="_blank" rel="noreferrer" style={{ flex: '0 0 120px' }} aria-label="Open the reported file">
            {/\.mp4(\?|$)/i.test(i.public_url) ? <video src={i.public_url} muted style={{ width: 120, borderRadius: 8 }} /> : <img src={i.public_url} alt="" style={{ width: 120, borderRadius: 8, filter: 'blur(8px)' }} />}
          </a>
          <div className="sm" style={{ flex: 1, minWidth: 220 }}>
            <p><b>{i.removed_at ? `Removed (${i.removal_reason})` : i.hidden ? 'Hidden' : 'Visible'}</b>, {i.report_count} report(s), creator {i.creator || 'unknown'}, strikes {i.strikes}{i.banned ? ', BANNED' : ''}</p>
            <p className={i.overdue ? 'bad' : 't2'}>Answer due within 48 hours: {fmt(i.slaDue)}{i.overdue ? ' (overdue)' : ''}</p>
            <p className="t3" style={{ margin: '4px 0' }}>{(i.prompt || '').slice(0, 200)}</p>
            <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
              {i.reports.map((r, k) => <li key={k}><b>{r.reason_code || 'legacy'}</b> {r.details || (!r.reason_code && r.reason) || ''} <span className="t3">({fmt(r.created_at)})</span></li>)}
            </ul>
            <div className="r" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button className="btn btn-s" onClick={() => act(i.id, 'restore')}>Restore</button>
              {!i.removed_at && <button className="btn btn-s" onClick={() => act(i.id, 'remove')}>Remove (strike)</button>}
              <button className="btn btn-s bad" onClick={() => act(i.id, 'delete')}>Delete permanently</button>
              <button className="btn btn-s" onClick={() => act(i.id, i.banned ? 'unban' : 'ban')}>{i.banned ? 'Unban creator' : 'Ban creator'}</button>
            </div>
          </div>
        </section>
      ))}
      <p style={{ marginTop: 20 }}><a className="link sm" href="/admin">Admin</a></p>
    </>
  );
}
