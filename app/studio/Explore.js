"use client";
import { useEffect, useMemo, useState } from "react";
import Icon from "./icons";
import { Brand, Balance, Picture, Poster } from "./bits";
import { IDEAS } from "./ideas";
import { FREE_DAILY } from "./store";

// How many columns fit: two on a phone, more as the window grows.
function useColumns() {
  const pick = () => (typeof window === "undefined" ? 2 : window.innerWidth >= 1500 ? 5 : window.innerWidth >= 1100 ? 4 : window.innerWidth >= 700 ? 3 : 2);
  const [n, setN] = useState(2);
  useEffect(() => { const on = () => setN(pick()); on(); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  return n;
}
const tall = (ratio) => { const [a, b] = String(ratio || "1:1").split(":").map(Number); return a > 0 && b > 0 ? b / a : 1; };

// The gallery: pictures and videos made on this site, chosen by its owner. Nothing is created here and nothing
// is sold here. A tap opens a picture with its prompt and model, and "Use this prompt" takes them to Create.
// A visitor without an account also gets one line saying what the site is and one way in.
export default function Explore({ s }) {
  const [kind, setKind] = useState("all");
  const cols = useColumns();
  const w = s.wallet;
  const guest = w.loaded && !w.account && !w.admin;
  // Until pictures have been chosen, the gallery shows the six starting ideas, so it is never an empty page.
  const chosen = s.explore.items;
  const all = useMemo(() => (chosen.length ? chosen : IDEAS.image.map((x) => ({ id: null, url: `/ideas/${x.img}.webp`, prompt: x.prompt, ratio: "1:1", model: null, video: false, idea: x.img }))), [chosen]);
  const hasVideo = all.some((x) => x.video);
  const list = all.filter((x) => kind === "all" || (kind === "video") === x.video);
  // Each picture goes to the column that is shortest so far, so the columns end at about the same height.
  const columns = useMemo(() => {
    const out = Array.from({ length: cols }, () => ({ h: 0, items: [] }));
    for (const it of list) { const c = out.reduce((a, b) => (b.h < a.h ? b : a)); c.items.push(it); c.h += tall(it.ratio) + 0.03; }
    return out;
  }, [list, cols]);
  const start = () => { if (s.needAccount({ tab: "create" })) return; s.setTab("create"); };

  return (
    <div className="screen explore">
      <header className="top">
        <Brand wordmark />
        <Balance s={s} />
      </header>

      {guest ? (
        <section className="strip pad">
          <h1 className="d">The best image and video models. One wallet.</h1>
          <div className="r" style={{ gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn btn-p" onClick={start}>Start free</button>
            <span className="sm t2">{FREE_DAILY} free credits every day</span>
          </div>
        </section>
      ) : null}

      {hasVideo ? (
        <div className="fl pad" role="tablist" aria-label="Show">
          {[["all", "All"], ["image", "Images"], ["video", "Video"]].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={kind === id} className={`chip2${kind === id ? " on" : ""}`} onClick={() => setKind(id)}>{label}</button>
          ))}
        </div>
      ) : null}

      {w.admin && !chosen.length && s.explore.status === "ready" ? <p className="sm t2 pad" style={{ marginBottom: 12 }}>Nothing is chosen for the gallery yet, so the starting ideas are shown. Open one of your creations in the Library and tap "Show in Explore".</p> : null}

      {s.explore.status === "loading" ? (
        <div className="gal pad" aria-hidden="true">{Array.from({ length: cols }, (_, c) => <div key={c}>{[1.3, 1, 0.75].map((h, i) => <div key={i} className="gt ghost" style={{ aspectRatio: `1 / ${c % 2 ? h : 2 - h + 0.3}` }} />)}</div>)}</div>
      ) : (
        <div className="gal pad">
          {columns.map((c, i) => (
            <div key={i}>
              {c.items.map((it) => (
                <button key={it.id || it.idea} className="gt" style={{ aspectRatio: `1 / ${tall(it.ratio)}` }} onClick={() => s.setViewer({ item: it, readonly: true, explore: true })} aria-label={it.prompt ? `Open: ${it.prompt.slice(0, 80)}` : it.video ? "Open video" : "Open image"}>
                  {it.video ? <><Poster item={it} /><span className="badge"><Icon name="play" size={10} />Video</span></> : <Picture src={it.url} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
