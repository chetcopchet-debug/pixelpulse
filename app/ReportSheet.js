'use client';
import { useState } from 'react';

const REASONS = [
  ['nonconsensual', 'Real person without consent'],
  ['sexual', 'Sexual content'],
  ['minor', 'Involves a minor'],
  ['violence', 'Violence or gore'],
  ['other', 'Something else'],
];
const CSS = '.rp-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:60;display:flex;align-items:flex-end;justify-content:center;animation:ppFade .2s}.rp{width:100%;max-width:440px;background:#101018;border:1px solid #2a2a40;border-radius:24px 24px 0 0;padding:16px 16px 22px;color:#e9e7f5;font-family:inherit;animation:ppUp .25s}.rp h3{margin:4px 0 12px;font-size:17px}.rp label{display:flex;gap:10px;align-items:center;padding:11px 12px;border:1px solid #23233a;border-radius:14px;margin-bottom:8px;font-size:14px}.rp label.on{border-color:#ec4899;background:rgba(236,72,153,.08)}.rp textarea{width:100%;box-sizing:border-box;min-height:64px;background:#0b0b12;border:1px solid #23233a;border-radius:14px;color:#fff;padding:10px;font:inherit;font-size:14px}.rp .go{width:100%;margin-top:10px;padding:13px;border:none;border-radius:999px;background:linear-gradient(90deg,#9333ea,#ec4899);color:#fff;font-weight:800;font-size:15px}.rp .go:disabled{opacity:.5}.rp .x{width:100%;margin-top:8px;background:none;border:none;color:#7c7c94;font-size:14px;padding:6px}.rp small{color:#7c7c94;display:block;margin-top:8px}@keyframes ppFade{from{opacity:0}}@keyframes ppUp{from{transform:translateY(100%)}to{transform:none}}';

// Bottom sheet: reason + optional details -> POST /api/report. onDone(message, ok).
export default function ReportSheet({ id, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reason, details }) });
      const d = await r.json().catch(() => ({}));
      onDone?.(r.ok ? '⚑ Thanks — we\'ll review it' : (d.error || 'Couldn\'t send report'), r.ok);
    } catch { onDone?.('Couldn\'t send report', false); }
    setBusy(false); onClose?.();
  };
  return (
    <div className="rp-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label="Report content">
      <style>{CSS}</style>
      <div className="rp" onClick={(e) => e.stopPropagation()}>
        <h3>⚑ Report this</h3>
        {REASONS.map(([k, t]) => (
          <label key={k} className={reason === k ? 'on' : ''}>
            <input type="radio" name="rp-reason" value={k} checked={reason === k} onChange={() => setReason(k)} /> {t}
          </label>
        ))}
        <textarea maxLength={500} placeholder="Anything else we should know? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
        <button className="go" disabled={!reason || busy} onClick={send}>{busy ? 'Sending…' : 'Send report'}</button>
        <button className="x" onClick={onClose}>Cancel</button>
        <small>Reports are anonymous. Content involving a minor or a real person without consent is hidden right away while we review.</small>
      </div>
    </div>
  );
}
