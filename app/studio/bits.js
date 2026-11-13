"use client";
import { useEffect, useState } from "react";
import { thumbUrl, posterUrl } from "../../lib/thumbs";
import Icon from "./icons";

// Stops the page behind a sheet or the viewer from scrolling. Safe to nest.
let locks = 0;
export function lockScroll() {
  if (locks++ === 0) document.body.style.overflow = "hidden";
  return () => { if (--locks === 0) document.body.style.overflow = ""; };
}

export const Price = ({ n }) => <span className="price"><i className="coin" />{n}</span>;

// Re-renders twice a second while something is in progress, so waiting states can show time passing.
export function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

// A picture that tries the small thumbnail first, then the full file, and never shows a broken icon.
export function Picture({ src, alt = "", eager }) {
  const small = thumbUrl(src);
  const [stage, setStage] = useState(0); // 0 thumbnail, 1 full file, 2 unavailable
  useEffect(() => { setStage(0); }, [src]);
  if (!src || stage === 2) return null;
  const cur = stage === 0 ? small : src;
  return <img key={cur} src={cur} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setStage(stage === 0 && small !== src ? 1 : 2)} />;
}

// A video in a list is shown as one still picture, never as a <video>: a phone can only decode a few videos
// at once, and every <video> in a list also downloads megabytes. The picture is saved the first time the owner
// plays the video; until then the tile shows a play mark. `version` forces a reload after a new picture is saved.
export function Poster({ item, version }) {
  const base = posterUrl(item.url);
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [base, version]);
  if (!base || bad) return <span className="vph" aria-hidden="true"><Icon name="play" size={22} /></span>;
  return <img src={version ? `${base}?v=${version}` : base} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />;
}

// Square tile for grids.
export function Tile({ item, onClick, label, poster }) {
  return (
    <button className="tile" onClick={onClick} aria-label={label || item.prompt || (item.video ? "Video" : "Image")}>
      {item.video
        ? <><Poster item={item} version={poster} /><span className="badge"><Icon name="play" size={10} />Video</span></>
        : <Picture src={item.url} />}
    </button>
  );
}

export function Brand({ wordmark }) {
  return <span className="r" style={{ gap: 10 }}><i className="logo" aria-hidden="true" />{wordmark ? <span className="d" style={{ fontSize: 20, lineHeight: "24px" }}>PixelPulse</span> : <span className="sr">PixelPulse</span>}</span>;
}

// Top-bar corner, on every screen: the credit balance with the profile circle. One button; it opens the profile
// menu (credits, Models & pricing, Settings, Help, Sign out). A visitor without an account gets "Sign in" and the
// same menu, with the way in at its top. `small` leaves out the words where the bar is crowded.
export function Balance({ s, small }) {
  const w = s.wallet;
  const open = () => s.setSheet({ type: "me" });
  if (w.loaded && !w.account && !w.admin) {
    return <button className="me" onClick={open} aria-label="Sign in, prices and settings">{small ? null : <span>Sign in</span>}<span className="av"><Icon name="person" size={16} /></span></button>;
  }
  const letter = (w.account?.email || "").trim().charAt(0).toUpperCase();
  return (
    <button className="me" onClick={open} aria-label={w.admin ? "Admin mode. Open the menu" : `${w.free + w.paid} credits. Open the menu`}>
      <i className="coin" /><span className="num">{w.admin ? "Admin" : w.loaded ? (w.free + w.paid).toLocaleString("en-US") : "…"}</span>
      <span className="av">{letter || <Icon name="person" size={16} />}</span>
    </button>
  );
}

export function dayLabel(iso) {
  const d = new Date(iso), t = new Date();
  const key = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (key(d) === key(t)) return "Today";
  if (key(d) === key(y)) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(d.getFullYear() !== t.getFullYear() ? { year: "numeric" } : {}) });
}
