"use client";
import { useMemo, useState } from "react";
import Icon from "./icons";
import { Tile, Brand, Balance, Picture, useNow, dayLabel } from "./bits";

const FILTERS = [["all", "All"], ["images", "Images"], ["videos", "Videos"], ["favorites", "Favorites"]];

// Everything you made, newest first, grouped by day.
export default function Library({ s }) {
  const [filter, setFilter] = useState("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const rendering = s.runs.filter((r) => r.kind === "video" && (r.status === "running" || r.status === "late"));
  const now = useNow(rendering.length > 0);

  const groups = useMemo(() => {
    const list = s.items.filter((x) => (filter === "images" ? !x.video : filter === "videos" ? x.video : filter === "favorites" ? s.favs.has(x.id) : true));
    const out = [];
    for (const item of list) {
      const label = dayLabel(item.at);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(item);
    }
    return out;
  }, [s.items, s.favs, filter]);
  const more = async () => { setLoadingMore(true); await s.loadMore(); setLoadingMore(false); };
  const emptyText = { all: "Nothing here yet. What you make is saved here automatically.", images: "No images yet.", videos: "No videos yet.", favorites: "No favorites yet. Tap the heart on a result to keep it here." }[filter];

  return (
    <div className="screen">
      <header className="top"><Brand /><Balance s={s} /></header>
      <h1 className="d h1 pad" style={{ margin: "4px 0 8px" }}>Library</h1>
      <div className="filters" role="tablist" aria-label="Show">
        {FILTERS.map(([id, label]) => <button key={id} role="tab" aria-selected={filter === id} className={`chip${filter === id ? " on" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}
      </div>

      {rendering.length ? (
        <button className="card r" style={{ gap: 12, padding: 12, margin: "12px 16px 0", width: "calc(100% - 32px)" }} onClick={() => s.setTab("create")}>
          <span className="tile" style={{ width: 44, height: 44, borderRadius: 8, flex: "none" }}>{rendering[0].poster ? <Picture src={rendering[0].poster} eager /> : null}</span>
          <span className="grow c" style={{ gap: 6 }}>
            <span className="b">{rendering.length === 1 ? "1 video rendering" : `${rendering.length} videos rendering`}</span>
            <span className="bar"><i style={{ width: `${Math.min(96, Math.max(4, ((now - rendering[0].t0) / 1000 / rendering[0].eta) * 100))}%` }} /></span>
            <span className="sm t2 clamp1">{rendering[0].label}. It's saved here when it's ready.</span>
          </span>
        </button>
      ) : null}

      {s.library === "loading" ? (
        <div className="grid3" style={{ marginTop: 16 }} aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} className="tile" />)}</div>
      ) : s.library === "off" ? (
        <div className="blank"><Icon name="alert" size={28} /><p className="t2">Saving isn't available right now, so there's nothing to show. Download results from the Create screen to keep them.</p></div>
      ) : groups.length === 0 ? (
        <div className="blank">
          <p className="t2">{emptyText}</p>
          {filter === "all" ? <button className="btn btn-p" onClick={() => s.setTab("create")}>Make something</button> : null}
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="d day">{g.label}</h2>
              <div className="grid3">{g.items.map((x) => <Tile key={x.id || x.url} item={x} onClick={() => s.setViewer({ item: x })} />)}</div>
            </section>
          ))}
          {s.cursor ? <div className="pad" style={{ marginTop: 20 }}><button className="btn btn-s btn-wide" onClick={more} disabled={loadingMore}>{loadingMore ? <i className="spin" /> : "Show older"}</button></div> : null}
        </>
      )}
    </div>
  );
}
