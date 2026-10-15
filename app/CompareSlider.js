"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Before / After slider: drag the pulse line (touch, mouse or pen) or use the arrow keys.
export default function CompareSlider({ before, after, label = "Result", onKeep, onRevert }) {
  const [pos, setPos] = useState(50);
  const [hint, setHint] = useState(true);
  const box = useRef(null);
  const drag = useRef(false);

  useEffect(() => { setPos(50); setHint(true); }, [before, after]);
  const moveTo = useCallback((clientX) => {
    const r = box.current?.getBoundingClientRect(); if (!r || !r.width) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);
  const down = (e) => { drag.current = true; setHint(false); e.currentTarget.setPointerCapture?.(e.pointerId); moveTo(e.clientX); };
  const move = (e) => { if (drag.current) moveTo(e.clientX); };
  const up = () => { drag.current = false; };
  const key = (e) => {
    const step = e.shiftKey ? 10 : 2;
    const next = { ArrowLeft: pos - step, ArrowRight: pos + step, Home: 0, End: 100 }[e.key];
    if (next === undefined) return;
    e.preventDefault(); setHint(false); setPos(Math.min(100, Math.max(0, next)));
  };

  return (
    <div className="pp-cmp">
      <div className="pp-cmpbox" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img className="pp-cmpafter" src={after} alt={`${label} (after)`} draggable={false} />
        <img className="pp-cmpbefore" src={before} alt="Original (before)" draggable={false} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <span className="pp-cmptag pp-cmptag-l" style={{ opacity: pos > 14 ? 1 : 0 }}>Before</span>
        <span className="pp-cmptag pp-cmptag-r" style={{ opacity: pos < 86 ? 1 : 0 }}>{label}</span>
        <div className={`pp-cmpline${hint ? " pp-cmphint" : ""}`} style={{ left: `${pos}%` }}
          role="slider" tabIndex={0} aria-label="Compare original and result" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% original`} onKeyDown={key}>
          <i aria-hidden="true">‹ ›</i>
        </div>
      </div>
      <div className="pp-cmpbar">
        <button className="pp-chip pp-ghost" onClick={onRevert}>↺ Back to original</button>
        <button className="pp-chip on" onClick={onKeep}>✓ Keep {label === "HD" ? "HD" : label.toLowerCase()}</button>
      </div>
    </div>
  );
}

export const COMPARE_CSS = `
.pp-cmp{width:100%;display:flex;flex-direction:column;align-items:center}
.pp-cmpbox{position:relative;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:ew-resize;line-height:0;max-width:100%}
.pp-stage .pp-cmpbox img{animation:none}
.pp-cmpafter{max-width:100%;max-height:58vh;width:auto;height:auto;display:block;background:repeating-conic-gradient(#191926 0 25%,#12121c 0 50%) 0 0/22px 22px}
.pp-stage .pp-cmpbefore{position:absolute;inset:0;width:100%;height:100%;max-height:none;object-fit:contain;background:#0b0b12;will-change:clip-path}
.pp-cmpline{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:linear-gradient(180deg,var(--v),var(--p));box-shadow:0 0 14px rgba(236,72,153,.8);outline:none}
.pp-cmpline i{position:absolute;top:50%;left:50%;width:40px;height:40px;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:800;font-size:15px;line-height:1;letter-spacing:2px;color:#fff;background:linear-gradient(135deg,var(--v),var(--p));box-shadow:0 0 0 3px rgba(7,7,10,.55),0 0 22px rgba(236,72,153,.6)}
.pp-cmpline:focus-visible i{box-shadow:0 0 0 3px #fff,0 0 22px rgba(236,72,153,.8)}
.pp-cmphint i{animation:ppCmpPulse 1.6s ease-in-out infinite}
@keyframes ppCmpPulse{0%,100%{box-shadow:0 0 0 3px rgba(7,7,10,.55),0 0 0 0 rgba(236,72,153,.55)}50%{box-shadow:0 0 0 3px rgba(7,7,10,.55),0 0 0 12px rgba(236,72,153,0)}}
.pp-cmptag{position:absolute;top:10px;padding:4px 10px;border-radius:999px;background:rgba(7,7,10,.7);backdrop-filter:blur(6px);font-size:11px;font-weight:700;line-height:1.2;letter-spacing:.3px;color:#e9e7f5;pointer-events:none;transition:opacity .2s}
.pp-cmptag-l{left:10px}.pp-cmptag-r{right:10px}
.pp-cmpbar{display:flex;gap:8px;justify-content:center;padding:10px 0 12px;line-height:normal}
@media (prefers-reduced-motion:reduce){.pp-cmphint i{animation:none}}
`;
