"use client";
import { useState } from "react";
import { IMAGE_MODELS, VIDEO_MODELS } from "../lib/catalog";

// One compact Model selector: shows the current model; tap to expand the full best-first list (Image / Video).
export default function ModelPicker({ value, onChange, disabled, isAdmin }) {
  const [open, setOpen] = useState(false);
  const all = [...IMAGE_MODELS, ...VIDEO_MODELS];
  const cur = all.find((m) => m.id === value) || IMAGE_MODELS[IMAGE_MODELS.length - 1];
  const isVid = VIDEO_MODELS.some((m) => m.id === cur.id);
  const Row = ({ m, video }) => (
    <button role="option" aria-selected={m.id === value} className={`mp-row${m.id === value ? " on" : ""}`} onClick={() => { onChange(m.id); setOpen(false); }}>
      <i className="mp-ic" aria-hidden="true">{m.icon}</i>
      <span className="mp-main"><b>{m.label}<em className={`mp-badge mp-b-${m.badge.toLowerCase()}`}>{m.badge}</em></b><small>{m.desc}</small><small className="mp-by">{m.by}</small></span>
      <span className="mp-cost">{isAdmin ? "∞" : `${m.cost}⚡`}{video && <small>paid</small>}</span>
    </button>
  );
  return (
    <div className={`mp${disabled ? " mp-off" : ""}`} aria-disabled={disabled}>
      <button className="mp-cur" onClick={() => !disabled && setOpen((o) => !o)} aria-expanded={open} disabled={disabled}>
        <i className="mp-ic" aria-hidden="true">{cur.icon}</i>
        <span className="mp-main"><b>{cur.label}<em className={`mp-badge mp-b-${cur.badge.toLowerCase()}`}>{cur.badge}</em></b><small>{isVid ? "Video · " : ""}{cur.desc}</small></span>
        <span className="mp-cost">{isAdmin ? "∞" : `${cur.cost}⚡`}</span><span className={`mp-chev${open ? " up" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mp-list" role="listbox" aria-label="Models">
          <p className="mp-sec">Image</p>
          {IMAGE_MODELS.map((m) => <Row key={m.id} m={m} />)}
          <p className="mp-sec">Video <small>purchased credits</small></p>
          {VIDEO_MODELS.map((m) => <Row key={m.id} m={m} video />)}
        </div>
      )}
    </div>
  );
}

export const MP_CSS = `
.mp{margin:0 0 4px}.mp-off{opacity:.4;pointer-events:none}
.mp-cur,.mp-row{width:100%;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:18px;border:1px solid var(--line);background:#141420;color:var(--txt);text-align:left;cursor:pointer}
.mp-cur{border-color:rgba(236,72,153,.45);background:linear-gradient(90deg,rgba(147,51,234,.16),rgba(236,72,153,.08))}
.mp-ic{flex:0 0 34px;height:34px;border-radius:12px;display:grid;place-items:center;font-style:normal;font-size:16px;background:#1d1d2c;color:#e9d5ff}
.mp-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.mp-main b{font-size:14px;display:flex;align-items:center;gap:6px;white-space:nowrap}
.mp-main small{font-size:11.5px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mp-by{font-size:10.5px!important;color:#6f6f8c!important}
.mp-badge{font-style:normal;font-size:9.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:#25253a;color:#cfcde0}
.mp-b-best{background:linear-gradient(90deg,var(--v),var(--p));color:#fff}
.mp-b-new{background:rgba(255,255,255,.12);color:#fff}
.mp-b-value,.mp-b-cheapest{background:rgba(52,211,153,.16);color:#6ee7b7}
.mp-b-fast{background:rgba(250,204,21,.15);color:#fde68a}
.mp-b-text{background:rgba(56,189,248,.15);color:#7dd3fc}
.mp-cost{flex:none;display:flex;flex-direction:column;align-items:flex-end;font-weight:800;font-size:13px}
.mp-cost small{font-size:9.5px;color:var(--mut);font-weight:700}
.mp-chev{color:var(--mut);transition:transform .2s}.mp-chev.up{transform:rotate(180deg)}
.mp-list{display:flex;flex-direction:column;gap:6px;margin-top:8px;animation:ppFade .18s}
.mp-row{background:#12121c}
.mp-row.on{border-color:var(--p);box-shadow:0 0 0 2px rgba(236,72,153,.2)}
.mp-sec{margin:8px 4px 2px;font-size:11px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.mp-sec small{text-transform:none;letter-spacing:0;font-weight:600;margin-left:6px}
`;
