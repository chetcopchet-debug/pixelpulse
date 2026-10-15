"use client";
import { useEffect, useRef, useState } from "react";

// Mobile-first mask painter. Strokes live in image pixel space; white = repaint.
export default function RepaintEditor({ item, isAdmin, credits, onClose, onDone, onNeedCredits }) {
  const imgRef = useRef(null);
  const cvRef = useRef(null);
  const [dims, setDims] = useState(null);
  const [strokes, setStrokes] = useState([]);
  const [invert, setInvert] = useState(false);
  const [size, setSize] = useState(6); // % of short side
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const drawing = useRef(null);

  const brushPx = () => (dims ? (Math.min(dims.w, dims.h) * size) / 100 : 20);

  const paint = (ctx, list, color) => {
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = color; ctx.fillStyle = color;
    for (const s of list) {
      ctx.lineWidth = s.r;
      if (s.pts.length === 1) { ctx.beginPath(); ctx.arc(s.pts[0][0], s.pts[0][1], s.r / 2, 0, Math.PI * 2); ctx.fill(); continue; }
      ctx.beginPath(); ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      for (const [x, y] of s.pts.slice(1)) ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const redraw = (list = strokes) => {
    const cv = cvRef.current; if (!cv || !dims) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (invert) {
      ctx.fillStyle = "rgba(236,72,153,.5)"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "destination-out"; paint(ctx, list, "#000"); ctx.globalCompositeOperation = "source-over";
    } else paint(ctx, list, "rgba(236,72,153,.55)");
  };
  useEffect(() => { redraw(); }, [strokes, invert, dims]);

  const pos = (e) => {
    const r = cvRef.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * dims.w, ((e.clientY - r.top) / r.height) * dims.h];
  };
  const down = (e) => {
    if (!dims || busy) return;
    e.preventDefault(); cvRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = { r: brushPx(), pts: [pos(e)] };
    redraw([...strokes, drawing.current]);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault(); drawing.current.pts.push(pos(e));
    redraw([...strokes, drawing.current]);
  };
  const up = () => {
    if (!drawing.current) return;
    const s = drawing.current; drawing.current = null;
    setStrokes((p) => [...p, s]);
  };

  const exportMask = () => {
    const c = document.createElement("canvas"); c.width = dims.w; c.height = dims.h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = invert ? "#fff" : "#000"; ctx.fillRect(0, 0, dims.w, dims.h);
    paint(ctx, strokes, invert ? "#000" : "#fff");
    return c.toDataURL("image/png");
  };

  const submit = async () => {
    if (!strokes.length) { setErr("Paint over the area you want to change."); return; }
    if (!text.trim()) { setErr("Describe what should appear there."); return; }
    if (!isAdmin && credits < 5) { if (onNeedCredits) onNeedCredits(); else setErr("Repaint costs 5 credits — not enough left today."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/repaint", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, mask: exportMask(), prompt: text.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (res.status === 402 && onNeedCredits) { onDone(d, false); onNeedCredits(); return; }
      onDone(d, res.ok && d.item);
      if (!res.ok || !d.item) throw new Error(d.error || "Repaint failed.");
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="rp-scrim">
      <div className="rp-sheet">
        <div className="rp-top">
          <b>◐ Repaint</b><span>paint where it should change</span>
          <button className="pp-chip pp-ghost" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
        </div>
        <div className={`rp-stage${busy ? " pp-generating" : ""}`}>
          <div className="rp-wrap" style={dims ? { aspectRatio: `${dims.w} / ${dims.h}` } : undefined}>
            <img ref={imgRef} src={item.url} alt="" draggable={false}
              onLoad={(e) => setDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })} />
            {dims && <canvas ref={cvRef} width={dims.w} height={dims.h}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />}
            {busy && <div className="rp-busy"><div className="pp-ripple"><i /><i /><i /><b>Repainting…</b></div></div>}
          </div>
        </div>
        <div className="rp-tools">
          <span className="rp-dot" style={{ width: 8 + size * 2.2, height: 8 + size * 2.2 }} />
          <input type="range" min="2" max="20" value={size} onChange={(e) => setSize(+e.target.value)} aria-label="Brush size" />
          <button className="pp-cap" onClick={() => setStrokes((p) => p.slice(0, -1))} disabled={!strokes.length || busy}>↶<span>Undo</span></button>
          <button className="pp-cap" onClick={() => setStrokes([])} disabled={!strokes.length || busy}>⌫<span>Clear</span></button>
          <button className={`pp-cap${invert ? " pp-on" : ""}`} onClick={() => setInvert((v) => !v)} disabled={busy}>◑<span>Invert</span></button>
        </div>
        <div className="rp-input">
          <input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="What should appear here? — any language"
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} disabled={busy} />
          <button className="pp-go" onClick={submit} disabled={busy}><span>{busy ? "…" : "Repaint"}</span><span className="pp-cost">{isAdmin ? "∞" : "5⚡"}</span></button>
        </div>
        {err && <div className="pp-error">{err}</div>}
      </div>
    </div>
  );
}

export const REPAINT_CSS = `
.rp-scrim{position:fixed;inset:0;z-index:90;background:rgba(5,5,9,.86);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:ppFade .2s}
.rp-sheet{width:100%;max-width:640px;max-height:100vh;overflow:auto;background:#11111a;border:1px solid #2a2a40;border-bottom:none;border-radius:28px 28px 0 0;padding:12px 12px calc(14px + env(safe-area-inset-bottom));animation:ppUp .28s cubic-bezier(.2,.9,.3,1.2)}
.rp-top{display:flex;align-items:center;gap:8px;padding:0 4px 10px}
.rp-top b{background:linear-gradient(90deg,#c084fc,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:16px}
.rp-top span{flex:1;color:var(--mut);font-size:12px}
.rp-stage{border-radius:22px;overflow:hidden;background:#07070a;display:grid;place-items:center}
.rp-wrap{position:relative;max-width:100%;max-height:58vh;margin:0 auto}
.rp-wrap img{display:block;max-width:100%;max-height:58vh;user-select:none;-webkit-user-select:none;pointer-events:none}
.rp-wrap canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair}
.rp-busy{position:absolute;inset:0;display:grid;place-items:center;background:rgba(7,7,10,.45)}
.rp-tools{display:flex;align-items:center;gap:6px;margin:10px 2px;flex-wrap:wrap}
.rp-tools input[type=range]{flex:1;min-width:90px;accent-color:#ec4899}
.rp-dot{flex:none;border-radius:50%;background:radial-gradient(circle,#ec4899,#9333ea);box-shadow:0 0 12px rgba(236,72,153,.6)}
.rp-input{display:flex;gap:8px;align-items:center;background:#161622;border:1px solid #2c2c44;border-radius:999px;padding:5px 5px 5px 14px}
.rp-input input{flex:1;min-width:0;background:transparent;border:none;outline:none;color:#fff;font-size:16px;font-family:inherit}
`;
