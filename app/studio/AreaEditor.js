"use client";
import { t, N } from "../i18n/index.js";
import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { Price, lockScroll } from "./bits";
import { TOOLS } from "./models";

// Brush width as a share of the image's shorter side.
const BRUSHES = [[N("Small brush"), 0.04, 8], [N("Medium brush"), 0.09, 14], [N("Large brush"), 0.18, 22]];
const MAX_PIXELS = 4096 * 4096; // the largest drawing surface every phone browser allows
const MAX_MASK = 4 * 1024 * 1024; // the server's limit on the mask it accepts

// Strokes are kept as shares of the image (0 to 1). The same list draws the marking on screen and the
// full-size mask that is sent to the server: white where the image should change, black where it stays.
function drawStrokes(ctx, w, h, strokes, paint) {
  const short = Math.min(w, h);
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = paint; ctx.fillStyle = paint;
  for (const st of strokes) {
    const lw = Math.max(1, st.r * short);
    ctx.lineWidth = lw;
    const [x0, y0] = st.pts[0];
    if (st.pts.length === 1) { ctx.beginPath(); ctx.arc(x0 * w, y0 * h, lw / 2, 0, Math.PI * 2); ctx.fill(); continue; }
    ctx.beginPath(); ctx.moveTo(x0 * w, y0 * h);
    for (let i = 1; i < st.pts.length; i++) ctx.lineTo(st.pts[i][0] * w, st.pts[i][1] * h);
    ctx.stroke();
  }
}

// White with dark diagonal lines: a marking that shows on bright and on dark pictures alike.
function hatch(ctx, dpr) {
  const n = Math.round(10 * dpr);
  const tile = document.createElement("canvas"); tile.width = n; tile.height = n;
  const t = tile.getContext("2d");
  t.fillStyle = "#FFFFFF"; t.fillRect(0, 0, n, n);
  t.strokeStyle = "#000000"; t.lineWidth = Math.max(1, 1.6 * dpr); t.lineCap = "square";
  t.beginPath(); t.moveTo(0, n); t.lineTo(n, 0); t.moveTo(-n / 2, n / 2); t.lineTo(n / 2, -n / 2); t.moveTo(n / 2, n * 1.5); t.lineTo(n * 1.5, n / 2); t.stroke();
  return ctx.createPattern(tile, "repeat");
}

// Mark part of an image with a finger, say what should be there, and only that part is made again.
export default function AreaEditor({ s, item, onClose }) {
  const stageRef = useRef(null);
  const cvRef = useRef(null);
  const strokes = useRef([]);
  const cur = useRef(null);
  const paintRef = useRef(null);
  const alive = useRef(true);
  const [dims, setDims] = useState(null); // the image's real size
  const [box, setBox] = useState(null); // its size on screen
  const [count, setCount] = useState(0); // strokes so far (the list itself lives in a ref, so drawing never waits for React)
  const [brush, setBrush] = useState(1);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  const [frame, setFrame] = useState(null); // the visible part of the screen, which shrinks when the keyboard opens
  const busy = s.busyTool === "repaint";
  const tool = TOOLS.repaint;

  useEffect(() => lockScroll(), []);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    const im = new Image();
    im.onload = () => {
      if (im.naturalWidth * im.naturalHeight > MAX_PIXELS) setProblem(t("This image is too large to edit an area of. Use the version from before it was upscaled."));
      else setDims({ w: im.naturalWidth, h: im.naturalHeight });
    };
    im.onerror = () => setProblem(t("The image didn't load. Close this and try again."));
    im.src = item.url;
  }, [item.url]);
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const fit = () => setFrame({ top: vv.offsetTop, height: vv.height });
    fit(); vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit);
    return () => { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); };
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !s.sheet) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.sheet, onClose]);

  // Fit the image inside the space the stage has.
  useEffect(() => {
    const el = stageRef.current; if (!el || !dims) return;
    const fit = () => {
      const k = Math.min(el.clientWidth / dims.w, el.clientHeight / dims.h);
      if (k > 0) setBox({ w: Math.max(1, Math.floor(dims.w * k)), h: Math.max(1, Math.floor(dims.h * k)) });
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [dims]);

  const redraw = useCallback(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    drawStrokes(ctx, cv.width, cv.height, cur.current ? [...strokes.current, cur.current] : strokes.current, paintRef.current);
  }, []);
  useEffect(() => {
    const cv = cvRef.current; if (!cv || !box) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(box.w * dpr); cv.height = Math.round(box.h * dpr);
    paintRef.current = hatch(cv.getContext("2d"), dpr);
    redraw();
  }, [box, redraw]);

  const at = (e) => {
    const r = cvRef.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const segment = (st) => { const cv = cvRef.current; drawStrokes(cv.getContext("2d"), cv.width, cv.height, [st], paintRef.current); };
  const down = (e) => {
    if (busy || cur.current || !box) return;
    e.preventDefault(); cvRef.current.setPointerCapture?.(e.pointerId);
    cur.current = { id: e.pointerId, r: BRUSHES[brush][1], pts: [at(e)] };
    segment(cur.current);
  };
  const move = (e) => {
    const c = cur.current; if (!c || c.id !== e.pointerId) return;
    e.preventDefault();
    const p = at(e), last = c.pts[c.pts.length - 1];
    if (Math.abs(p[0] - last[0]) * box.w + Math.abs(p[1] - last[1]) * box.h < 2) return;
    c.pts.push(p);
    segment({ r: c.r, pts: [last, p] });
  };
  const up = (e) => {
    const c = cur.current; if (!c || c.id !== e.pointerId) return;
    cur.current = null;
    strokes.current = [...strokes.current, { r: c.r, pts: c.pts }];
    setCount(strokes.current.length);
  };
  const undo = () => { strokes.current = strokes.current.slice(0, -1); setCount(strokes.current.length); redraw(); };
  const clear = () => { strokes.current = []; setCount(0); redraw(); };

  const go = async () => {
    const v = text.trim();
    if (busy || !dims || !count || !v) return;
    const c = document.createElement("canvas"); c.width = dims.w; c.height = dims.h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, dims.w, dims.h);
    drawStrokes(ctx, dims.w, dims.h, strokes.current, "#FFFFFF");
    const mask = c.toDataURL("image/png");
    if (mask.length > MAX_MASK) { s.say(t("The marked area is too detailed to send. Clear it and mark it with fewer, wider strokes.")); return; }
    const ok = await s.runTool("repaint", item, { mask, prompt: v });
    if (ok && alive.current) onClose(); // the result opens next to the original; on a failure the marking stays so it can be tried again
  };

  const help = problem ? problem
    : !count ? t("Paint over the part you want to change.")
    : !text.trim() ? t("Now describe what should be there instead.")
    : t("Only the marked part changes. The original stays in your Library.");

  return (
    <div className="area" role="dialog" aria-modal="true" aria-label={t(tool.label)} style={frame ? { top: frame.top, height: frame.height } : undefined}>
      <div className="area-in">
        <header className="top">
          <button className="ib" aria-label={t("Close")} onClick={onClose}><Icon name="x" /></button>
          <h2 className="d h2">{t(tool.label)}</h2>
          <span style={{ width: 44 }} />
        </header>

        <div className="area-stage" ref={stageRef}>
          {box ? (
            <div className="area-box" style={{ width: box.w, height: box.h }}>
              <img src={item.url} alt={item.prompt || ""} draggable={false} />
              <canvas ref={cvRef} aria-label={t("Marked area")} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
              {busy ? <div className="area-busy" role="status"><i className="spin" style={{ width: 28, height: 28 }} /><p className="b">{t("Changing the marked part")}</p></div> : null}
            </div>
          ) : problem ? null : <i className="spin" style={{ width: 28, height: 28 }} />}
        </div>

        <div className="area-foot">
          <p className="sm t2" role={problem ? "alert" : undefined}>{help}</p>
          <div className="r" style={{ gap: 8 }}>
            <div className="seg" role="radiogroup" aria-label={t("Brush size")}>
              {BRUSHES.map(([label, , dot], i) => (
                <button key={label} role="radio" aria-checked={brush === i} aria-label={t(label)} className={brush === i ? "on" : ""} disabled={busy} onClick={() => setBrush(i)}>
                  <i className="area-dot" style={{ width: dot, height: dot }} />
                </button>
              ))}
            </div>
            <span style={{ flex: 1 }} />
            <button className="btn btn-s area-sm" disabled={!count || busy} onClick={undo}><Icon name="undo" size={18} />{t("Undo")}</button>
            <button className="btn btn-s area-sm" disabled={!count || busy} onClick={clear}>{t("Clear")}</button>
          </div>
          <textarea className="field" maxLength={1500} value={text} disabled={busy || Boolean(problem)} placeholder={t("A red scarf, a cup of coffee, clear blue sky")} aria-label={t("What should be in the marked part")} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-p btn-wide btn-split" disabled={busy || !count || !text.trim() || !dims} onClick={go}><span>{busy ? t("Working") : t(tool.label)}</span><Price n={tool.cost} /></button>
        </div>
      </div>
    </div>
  );
}
