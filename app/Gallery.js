"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const FILTERS = [
  { id: "all", label: "All" }, { id: "created", label: "Created" }, { id: "uploads", label: "Uploads" },
  { id: "edits", label: "Edits" }, { id: "published", label: "Published" }, { id: "favorites", label: "★ Favorites" },
];
const FAV_KEY = "pp_favs";
const readFavs = () => { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch { return new Set(); } };

export async function downloadImage(url, name = "pixelpulse") {
  try {
    const r = await fetch(url, { cache: "no-store" });
    const b = await r.blob();
    const ext = (b.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = `${name}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  } catch { window.open(url, "_blank"); }
}

function dayLabel(iso) {
  const d = new Date(iso); const t = new Date();
  const key = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (key(d) === key(t)) return "Today";
  if (key(d) === key(y)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...(d.getFullYear() !== t.getFullYear() ? { year: "numeric" } : {}) });
}

const KIND_ICON = { upload: "⇪", edit: "◐", created: "✦" };

export default function Gallery({ toItem, refreshKey, actions, inspiration = [], onStealVibe, tierLabel, notify, renderActions }) {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [favs, setFavs] = useState(() => new Set());
  const [viewer, setViewer] = useState(-1);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState("");
  const sentinel = useRef(null);
  const reqId = useRef(0);

  useEffect(() => { setFavs(readFavs()); }, []);

  const load = useCallback(async (reset) => {
    const my = ++reqId.current;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "24", filter });
      if (!reset && cursor) qs.set("cursor", cursor);
      if (filter === "favorites") qs.set("ids", [...readFavs()].join(","));
      const d = await fetch(`/api/history?${qs}`, { cache: "no-store" }).then((r) => r.json());
      if (my !== reqId.current) return;
      const got = (d.items || []).map((r) => ({ ...toItem(r), createdAt: r.created_at, kind: r.kind || "created" }));
      setItems((prev) => { const base = reset ? [] : prev; const seen = new Set(base.map((x) => x.id)); return [...base, ...got.filter((x) => !seen.has(x.id))]; });
      setCursor(d.nextCursor || null); setDone(!d.nextCursor);
    } catch { if (my === reqId.current) setDone(true); }
    finally { if (my === reqId.current) setLoading(false); }
  }, [filter, cursor, toItem]);

  useEffect(() => { setItems([]); setCursor(null); setDone(false); load(true); /* eslint-disable-next-line */ }, [filter, refreshKey]);

  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && !loading && !done) load(false); }, { rootMargin: "600px" });
    io.observe(el); return () => io.disconnect();
  }, [load, loading, done]);

  const toggleFav = (id) => {
    const n = new Set(favs); n.has(id) ? n.delete(id) : n.add(id);
    setFavs(n); try { localStorage.setItem(FAV_KEY, JSON.stringify([...n])); } catch {}
    if (filter === "favorites" && !n.has(id)) setItems((p) => p.filter((x) => x.id !== id));
  };

  const removeLocal = (ids) => {
    const s = new Set(ids);
    setItems((p) => p.filter((x) => !s.has(x.id)));
    const f = readFavs(); ids.forEach((i) => f.delete(i)); try { localStorage.setItem(FAV_KEY, JSON.stringify([...f])); } catch {}
    setFavs(f);
  };
  const doDelete = async (ids) => {
    if (!ids.length) return;
    if (!window.confirm(ids.length === 1 ? "Delete this image forever?" : `Delete ${ids.length} images forever?`)) return;
    setBusy("delete");
    try {
      const r = await fetch("/api/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not delete.");
      removeLocal(d.deleted || ids); actions.onDeleted?.(d.deleted || ids);
      notify?.(`🗑 Deleted ${(d.deleted || ids).length}`);
      setSel(new Set()); setSelecting(false); setViewer(-1);
    } catch (e) { notify?.(e.message); } finally { setBusy(""); }
  };
  const bulkDownload = async () => {
    setBusy("download");
    const list = items.filter((x) => sel.has(x.id));
    for (let i = 0; i < list.length; i++) { await downloadImage(list[i].url, `pixelpulse-${i + 1}`); await new Promise((r) => setTimeout(r, 400)); }
    setBusy(""); notify?.(`⤓ ${list.length} downloaded`);
  };

  // long-press to select
  const press = useRef(null);
  const startPress = (id) => { press.current = setTimeout(() => { press.current = "fired"; setSelecting(true); setSel((s) => new Set(s).add(id)); navigator.vibrate?.(15); }, 450); };
  const endPress = () => { if (press.current && press.current !== "fired") clearTimeout(press.current); };
  const tap = (idx, id) => {
    if (press.current === "fired") { press.current = null; return; }
    if (selecting) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); if (!n.size) setSelecting(false); return n; }); return; }
    setViewer(idx); setMenu(false);
  };

  // group by day
  const groups = [];
  items.forEach((it, idx) => {
    const lbl = it.createdAt ? dayLabel(it.createdAt) : "Earlier";
    if (!groups.length || groups[groups.length - 1].label !== lbl) groups.push({ label: lbl, list: [] });
    groups[groups.length - 1].list.push({ it, idx });
  });

  const cur = viewer >= 0 ? items[viewer] : null;
  const touch = useRef(null);
  const go = (d) => setViewer((v) => { const n = v + d; if (n >= items.length - 3 && !done && !loading) load(false); return n < 0 || n >= items.length ? v : n; });
  useEffect(() => {
    if (!cur) return;
    const k = (e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); if (e.key === "Escape") setViewer(-1); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  const act = (fn) => { setMenu(false); const it = cur; setViewer(-1); fn(it); };

  return (
    <main className="pp-main pg-root">
      <div className="pp-sechead"><h2>My Pulses</h2>
        {items.length > 0 && <button className="pp-link" onClick={() => { setSelecting((v) => !v); setSel(new Set()); }}>{selecting ? "Cancel" : "Select"}</button>}
      </div>
      <div className="pg-filters">
        {FILTERS.map((f) => <button key={f.id} className={`pp-chip${filter === f.id ? " on" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>)}
      </div>

      {!loading && items.length === 0 && (
        <div className="pg-empty">
          <div className="pp-ripple pp-idle"><i /><i /></div>
          <p>{filter === "all" ? "Your pulses will live here. Start from a vibe:" : "Nothing here yet."}</p>
          {filter === "all" && inspiration.length > 0 && (
            <div className="pg-insp">
              {inspiration.slice(0, 6).map((x) => (
                <button key={x.id} onClick={() => onStealVibe(x)}><img src={x.url} alt="" loading="lazy" /><span>✦ Pulse this</span></button>
              ))}
            </div>
          )}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.label} className="pg-day">
          <h3>{g.label}</h3>
          <div className="pg-grid">
            {g.list.map(({ it, idx }) => (
              <button key={it.id} className={`pg-tile${sel.has(it.id) ? " pg-sel" : ""}`}
                onPointerDown={() => startPress(it.id)} onPointerUp={endPress} onPointerLeave={endPress} onPointerCancel={endPress}
                onContextMenu={(e) => e.preventDefault()} onClick={() => tap(idx, it.id)}>
                <img src={it.url} alt={it.prompt} loading="lazy" draggable={false} />
                <span className="pg-badges">
                  <i>{KIND_ICON[it.kind] || "✦"}</i>
                  {it.isPublic && <i className="pg-live">◉</i>}
                  {favs.has(it.id) && <i className="pg-star">★</i>}
                </span>
                {selecting && <span className="pg-check">{sel.has(it.id) ? "✓" : ""}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
      <div ref={sentinel} className="pg-more">{loading ? <span className="pp-ampwait"><i /><i /><i /></span> : done && items.length > 0 ? "· that's every pulse ·" : ""}</div>

      {selecting && (
        <div className="pg-bulk">
          <b>{sel.size} selected</b>
          <button className="pp-cap" disabled={!sel.size || !!busy} onClick={bulkDownload}>⤓<span>{busy === "download" ? "…" : "Download"}</span></button>
          <button className="pp-cap pg-danger" disabled={!sel.size || !!busy} onClick={() => doDelete([...sel])}>🗑<span>Delete</span></button>
          <button className="pp-cap" onClick={() => { setSelecting(false); setSel(new Set()); }}>✕</button>
        </div>
      )}

      {cur && (
        <div className="pg-viewer" onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}>
          <div className="pg-vtop">
            <button className="pp-chip pp-ghost" onClick={() => setViewer(-1)}>✕</button>
            <span>{viewer + 1} / {items.length}{!done ? "+" : ""}</span>
            <button className={`pp-chip pp-ghost${favs.has(cur.id) ? " pg-staron" : ""}`} onClick={() => toggleFav(cur.id)} aria-label="Favorite">{favs.has(cur.id) ? "★" : "☆"}</button>
          </div>
          <div className="pg-vimg">
            {viewer > 0 && <button className="pg-nav pg-prev" onClick={() => go(-1)}>‹</button>}
            <img key={cur.id} src={cur.url} alt={cur.prompt} />
            {viewer < items.length - 1 && <button className="pg-nav pg-next" onClick={() => go(1)}>›</button>}
          </div>
          <div className="pg-vinfo">
            <p>{cur.prompt}</p>
            <span className="pp-meta">{[tierLabel(cur.tier), cur.style, cur.aspectRatio, cur.isPublic ? "◉ Live" : "Private", cur.createdAt && new Date(cur.createdAt).toLocaleString()].filter(Boolean).join(" · ")}</span>
            {renderActions(cur, [{ key: "open", icon: "▣", label: "Open in Studio", onClick: () => act(actions.open) },
              { key: "del", icon: "🗑", label: "Delete", tone: "danger", onClick: () => doDelete([cur.id]) }])}
          </div>
        </div>
      )}
    </main>
  );
}

export const GALLERY_CSS = `
.pg-filters{display:flex;gap:6px;overflow-x:auto;padding:2px 0 12px;scrollbar-width:none}
.pg-filters::-webkit-scrollbar{display:none}
.pg-day h3{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin:14px 2px 8px;display:flex;align-items:center;gap:8px}
.pg-day h3::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(168,85,247,.4),transparent)}
.pg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.pg-tile{position:relative;padding:0;border:none;background:#101018;aspect-ratio:1;border-radius:14px;overflow:hidden;-webkit-touch-callout:none;user-select:none}
.pg-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .2s}
.pg-tile:active img{transform:scale(.96)}
.pg-sel{box-shadow:inset 0 0 0 3px #ec4899}
.pg-sel img{transform:scale(.9);border-radius:10px}
.pg-badges{position:absolute;left:5px;bottom:5px;display:flex;gap:3px}
.pg-badges i{font-style:normal;font-size:10px;padding:2px 6px;border-radius:999px;background:rgba(7,7,10,.7);color:#e9d5ff;backdrop-filter:blur(4px)}
.pg-live{color:#6ee7b7!important}.pg-star{color:#fde68a!important}
.pg-check{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:2px solid #fff;background:rgba(0,0,0,.35);color:#fff;font-size:12px;display:grid;place-items:center}
.pg-sel .pg-check{background:linear-gradient(135deg,#9333ea,#ec4899);border-color:transparent}
.pg-more{text-align:center;color:var(--mut);font-size:11px;padding:18px 0 10px;min-height:30px}
.pg-empty{text-align:center;color:var(--mut);font-size:14px;padding:20px 0}
.pg-empty .pp-ripple{margin:0 auto}
.pg-insp{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}
.pg-insp button{position:relative;padding:0;border:none;border-radius:16px;overflow:hidden;aspect-ratio:1;background:#101018}
.pg-insp img{width:100%;height:100%;object-fit:cover;opacity:.85}
.pg-insp span{position:absolute;left:6px;right:6px;bottom:6px;font-size:10px;font-weight:700;color:#fff;background:rgba(147,51,234,.75);border-radius:999px;padding:3px 0}
.pg-bulk{position:fixed;left:10px;right:10px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:45;max-width:560px;margin:0 auto;display:flex;align-items:center;gap:6px;padding:8px 8px 8px 16px;border-radius:999px;background:rgba(24,20,40,.96);border:1px solid rgba(236,72,153,.5);box-shadow:0 0 30px rgba(168,85,247,.4);animation:ppUp .25s}
.pg-bulk b{flex:1;font-size:13px}
.pg-danger{color:#fca5a5!important;border-color:rgba(239,68,68,.5)!important}
.pg-viewer{position:fixed;inset:0;z-index:70;background:rgba(5,5,9,.97);display:flex;flex-direction:column;animation:ppFade .2s}
.pg-vtop{display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top)) 12px 6px;color:var(--mut);font-size:12px}
.pg-staron{color:#fde68a!important}
.pg-vimg{flex:1;min-height:0;display:grid;place-items:center;position:relative;padding:0 8px}
.pg-vimg img{max-width:100%;max-height:100%;object-fit:contain;border-radius:20px;animation:ppReveal .35s ease;box-shadow:0 0 50px rgba(147,51,234,.25)}
.pg-nav{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:1px solid #2a2a40;background:rgba(18,18,28,.8);color:#fff;font-size:22px;z-index:2}
.pg-prev{left:10px}.pg-next{right:10px}
.pg-vinfo{padding:12px 14px calc(16px + env(safe-area-inset-bottom));max-width:640px;width:100%;margin:0 auto}
.pg-vinfo p{margin:0 0 4px;font-size:13px;line-height:1.45;max-height:4.4em;overflow:auto}
.pg-primary{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;margin-top:10px}
.pg-primary .pp-cap{justify-content:center}
.pg-menu{margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;animation:ppFade .15s}
.pg-menu button{padding:10px 12px;border-radius:16px;border:1px solid #2a2a40;background:#151520;color:var(--txt);font-size:13px;font-weight:600;text-align:left}
.pp-recent{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 6px;scrollbar-width:none}
.pp-recent::-webkit-scrollbar{display:none}
.pp-recent button{flex:none;width:76px;height:76px;padding:0;border-radius:18px;overflow:hidden;border:1px solid var(--line);background:#101018}
.pp-recent button.on{box-shadow:0 0 0 2px #ec4899,0 0 16px rgba(236,72,153,.5)}
.pp-recent img{width:100%;height:100%;object-fit:cover}
.pp-recent .pp-seeall{display:grid;place-items:center;color:#d8b4fe;font-size:12px;font-weight:700;background:linear-gradient(135deg,rgba(147,51,234,.25),rgba(236,72,153,.2))}
@media (min-width:640px){.pg-grid{grid-template-columns:repeat(4,1fr);gap:6px}}
@media (min-width:1000px){.pg-grid{grid-template-columns:repeat(5,1fr)}}
`;
