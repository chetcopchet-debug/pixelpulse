"use client";
import { useState } from "react";

// One consistent action row: up to 3 primary pills + ⋯ opening a bottom sheet with the rest.
// Each action: { key, icon, label, onClick, tone?: 'accent'|'on'|'danger'|'liked', disabled?, hint? }
export default function ImageActions({ primary = [], more = [], compact = false, title }) {
  const [open, setOpen] = useState(false);
  const p = primary.filter(Boolean).slice(0, 3);
  const m = more.filter(Boolean);
  return (
    <>
      <div className={`ia-row${compact ? " ia-compact" : ""}`}>
        {p.map((a) => (
          <button key={a.key} className={`ia-pill${a.tone ? ` ia-${a.tone}` : ""}`} onClick={a.onClick} disabled={a.disabled} aria-label={a.label}>
            <b>{a.icon}</b><span>{a.label}</span>
          </button>
        ))}
        {m.length > 0 && <button className="ia-pill ia-more" onClick={() => setOpen(true)} aria-label="More actions"><b>⋯</b></button>}
      </div>
      {open && (
        <div className="ia-scrim" onClick={() => setOpen(false)}>
          <div className="ia-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="More actions">
            <div className="pp-grab" />
            {title && <p className="ia-title">{title}</p>}
            <div className="ia-list">
              {m.map((a) => (
                <button key={a.key} className={`ia-item${a.tone === "danger" ? " ia-danger" : ""}`} disabled={a.disabled}
                  onClick={() => { setOpen(false); a.onClick(); }}>
                  <b>{a.icon}</b><span>{a.label}{a.hint && <small>{a.hint}</small>}</span>
                </button>
              ))}
            </div>
            <button className="pp-done" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

export const IA_CSS = `
.ia-row{display:flex;gap:6px;max-width:560px;margin:12px auto 0}
.ia-pill{flex:1 1 0;min-width:0;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 8px;border-radius:999px;border:1px solid #2a2a40;background:#151520;color:var(--txt);font-size:13px;font-weight:700;transition:transform .12s,background .2s;white-space:nowrap}
.ia-pill b{font-size:15px;font-weight:700}
.ia-pill span{overflow:hidden;text-overflow:ellipsis}
.ia-pill:active{transform:scale(.94)}
.ia-more{flex:0 0 44px;padding:0}
.ia-accent{background:linear-gradient(90deg,#9333ea,#ec4899);border-color:transparent;color:#fff;box-shadow:0 4px 16px rgba(236,72,153,.3)}
.ia-on{border-color:rgba(52,211,153,.5);color:#6ee7b7}
.ia-liked{color:#f9a8d4;border-color:rgba(236,72,153,.5)}
.ia-compact{margin-top:10px}
.ia-compact .ia-pill{font-size:12px}
.ia-scrim{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;animation:ppFade .18s}
.ia-sheet{width:100%;max-width:520px;background:#11111a;border:1px solid #2a2a40;border-bottom:none;border-radius:28px 28px 0 0;padding:10px 14px calc(14px + env(safe-area-inset-bottom));animation:ppUp .26s cubic-bezier(.2,.9,.3,1.2);max-height:80vh;overflow:auto}
.ia-title{margin:4px 4px 10px;font-size:12px;color:var(--mut);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ia-list{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ia-item{min-height:52px;display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:18px;border:1px solid #2a2a40;background:#161622;color:var(--txt);font-size:14px;font-weight:600;text-align:left}
.ia-item b{width:22px;text-align:center;color:#d8b4fe}
.ia-item span{display:flex;flex-direction:column}
.ia-item small{font-size:10.5px;color:var(--mut);font-weight:500}
.ia-item:active{transform:scale(.97)}
.ia-danger{color:#fca5a5;border-color:rgba(239,68,68,.45)}
.ia-danger b{color:#fca5a5}
`;
