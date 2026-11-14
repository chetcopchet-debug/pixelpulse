"use client";
import { t, LANGS } from "../i18n/index.js";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./icons";
import { Brand, Balance, Picture, Poster } from "./bits";
import { IDEAS } from "./ideas";
import { FREE_DAILY } from "./store";
import { madeFor } from "./models";
import { shortTitle } from "../../lib/title.js";
import { previewUrl } from "../../lib/thumbs";

// How many columns fit: two on a phone, more as the window grows.
function useColumns() {
  const pick = () => (typeof window === "undefined" ? 2 : window.innerWidth >= 1500 ? 5 : window.innerWidth >= 1100 ? 4 : window.innerWidth >= 700 ? 3 : 2);
  const [n, setN] = useState(2);
  useEffect(() => { const on = () => setN(pick()); on(); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  return n;
}
// One gallery tile. A picture is a picture. A video shows its still, and while it is the one in the middle of the
// screen its light copy plays over the still, without sound, in a loop. Only one video on the page plays at a time.
function Tile({ it, playing, onOpen }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { if (!playing) setShown(false); }, [playing]);
  const title = it.title || shortTitle(it.prompt);
  const made = madeFor(it);
  return (
    <button className="gt" data-vid={it.video && it.preview ? it.id : undefined} style={{ aspectRatio: `1 / ${tall(it.ratio)}` }} onClick={onOpen}
      aria-label={title ? t("Open: {title}", { title }) : it.video ? t("Open video") : t("Open image")}>
      {it.video ? <Poster item={it} /> : <Picture src={it.url} />}
      {it.video && playing ? <video className={shown ? "on" : ""} src={previewUrl(it.url)} muted loop playsInline autoPlay preload="auto" aria-hidden="true" onPlaying={() => setShown(true)} /> : null}
      {it.video ? <span className="badge top"><Icon name="play" size={10} />{t("Video")}</span> : null}
      {title || made ? (
        <span className="gcap">
          {title ? <span className="b clamp1">{title}</span> : null}
          {made ? <span className="gmade clamp1">{made.name}<i className="coin" />{made.cost}</span> : null}
        </span>
      ) : null}
    </button>
  );
}

// Which video is playing: the one nearest the middle of the screen, when most of it is in view. None while a
// window or an item is open, when the page is hidden, on a slow or data-saving connection, or when the person
// asked their device for less motion: then the stills stay.
function usePlaying(paused, deps) {
  const [id, setId] = useState(null);
  useEffect(() => {
    if (paused || typeof window === "undefined") { setId(null); return; }
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const calm = (c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || ""))) || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (calm) { setId(null); return; }
    let frame = 0;
    const pick = () => {
      frame = 0;
      if (document.hidden) { setId(null); return; }
      const mid = window.innerHeight / 2; let best = null, dist = Infinity;
      for (const el of document.querySelectorAll(".gal [data-vid]")) {
        const r = el.getBoundingClientRect();
        const seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
        if (r.height <= 0 || seen / r.height < 0.6) continue;
        const d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < dist) { dist = d; best = el.getAttribute("data-vid"); }
      }
      setId(best);
    };
    const on = () => { if (!frame) frame = requestAnimationFrame(pick); };
    pick();
    window.addEventListener("scroll", on, { passive: true, capture: true }); window.addEventListener("resize", on); document.addEventListener("visibilitychange", on);
    return () => { if (frame) cancelAnimationFrame(frame); window.removeEventListener("scroll", on, { capture: true }); window.removeEventListener("resize", on); document.removeEventListener("visibilitychange", on); };
  }, [paused, ...deps]);
  return id;
}

const tall = (ratio) => { const [a, b] = String(ratio || "1:1").split(":").map(Number); return a > 0 && b > 0 ? b / a : 1; };

// The gallery: pictures and videos made on this site, chosen by its owner. Nothing is created here and nothing
// is sold here. A tap opens a picture with its prompt and model, and "Use this prompt" takes them to Create.
// A visitor without an account also gets one line saying what the site is and one way in.
// `signedHint`: the server saw an account cookie. Until the wallet answers, that decides whether the headline is
// shown, so a new visitor sees it at once and nothing jumps when the wallet arrives.
export default function Explore({ s, signedHint = false }) {
  const [kind, setKind] = useState("all");
  const cols = useColumns();
  const w = s.wallet;
  const guest = w.loaded ? !w.account && !w.admin : !signedHint;
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
  const playing = usePlaying(Boolean(s.viewer || s.sheet || s.page), [kind, cols, s.explore.status, list.length]);

  return (
    <div className="screen explore">
      <header className="top">
        <Brand wordmark />
        <Balance s={s} />
      </header>

      {guest ? (
        <section className="strip pad">
          <h1 className="d">{t("The best image and video models. One wallet.")}</h1>
          <div className="r" style={{ gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn btn-p" onClick={start}>{t("Start free")}</button>
            <span className="sm t2">{t("{n} free credits every day", { n: FREE_DAILY })}</span>
          </div>
        </section>
      ) : null}

      {hasVideo ? (
        <div className="fl pad" role="tablist" aria-label={t("Show")}>
          {[["all", t("All")], ["image", t("Images")], ["video", t("Video")]].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={kind === id} className={`chip2${kind === id ? " on" : ""}`} onClick={() => setKind(id)}>{label}</button>
          ))}
        </div>
      ) : null}

      {w.admin && !chosen.length && s.explore.status === "ready" ? <p className="sm t2 pad" style={{ marginBottom: 12 }}>{t("Nothing is chosen for the gallery yet, so the starting ideas are shown. Open one of your creations in the Library and tap \"Show in Explore\".")}</p> : null}

      {s.explore.status === "loading" ? (
        <div className="gal pad" aria-hidden="true">{Array.from({ length: cols }, (_, c) => <div key={c}>{[1.3, 1, 0.75].map((h, i) => <div key={i} className="gt ghost" style={{ aspectRatio: `1 / ${c % 2 ? h : 2 - h + 0.3}` }} />)}</div>)}</div>
      ) : (
        <div className="gal pad">
          {columns.map((c, i) => (
            <div key={i}>
              {c.items.map((it) => <Tile key={it.id || it.idea} it={it} playing={Boolean(it.id) && playing === it.id} onOpen={() => s.setViewer({ item: it, readonly: true, explore: true })} />)}
            </div>
          ))}
        </div>
      )}

      <footer className="pad exfoot">
        <button className="chip2" onClick={() => s.setSheet({ type: "lang" })} aria-label={t("Language")}><Icon name="globe" size={18} style={{ marginRight: 8 }} />{(LANGS.find((l) => l.id === s.lang) || LANGS[0]).name}</button>
        <nav aria-label={t("About")}>
          <a href="/terms">{t("Terms")}</a><a href="/privacy">{t("Privacy")}</a><a href="/refund-policy">{t("Refunds")}</a><a href="/content-policy">{t("Content policy")}</a><a href="/contact">{t("Contact us")}</a>
        </nav>
      </footer>
    </div>
  );
}
