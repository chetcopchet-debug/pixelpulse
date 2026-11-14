"use client";
import { useEffect, useRef, useState } from "react";

// The empty Create screen on a phone: the lion in the snow, behind the title and the prompt box.
// A still picture (the empty landscape) is there at once. After the page is ready the story is fetched and played
// once: the lion walks in from the right, stops, shakes off the snow, roars, lies down, looks around, gets up and
// walks out on the left (25 seconds). Then the quiet loop (the empty landscape with his footprints, snow falling)
// plays for as long as the screen is open. The story ends on the frame the loop starts from, so nothing jumps.
// The story starts again only when the Create screen is entered (from another tab, or when the app opens). It does
// not start again for anything that happens inside Create: where it is in the story is remembered here, outside
// the component, so even if the component were taken off the page and put back, it would go on from the same
// moment (switching between Image and Video must never restart it).
// A still picture only: a slow or metered connection, "reduce motion", or a browser that will not autoplay.
// The files are in public/create. Silent: the videos have no sound track.
// A changed file gets a new name (the files are cached for 30 days).
const OPEN = "/create/lion-story-2.mp4", LOOP = "/create/lion-snow-2.mp4", STILL = "/create/lion-first-2.webp", SNOW = "/create/lion-snow-2.webp", CALM = "/create/lion-still-2.webp";

// Where the story is, for this visit to Create: "still" (not started), "open" (playing, at `t` seconds) or "loop".
const visit = { stage: "still", t: 0 };
// Called when the Create screen is entered: the story will play from its start.
export function lionEnter() { visit.stage = "still"; visit.t = 0; }

export function calm() {
  if (typeof window === "undefined") return true;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return Boolean((c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || ""))) || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

// Fetches the still picture ahead of time (a phone on a dark screen, a moment after the app has opened), so it is
// already there when Create is opened.
export function warmLion(theme) {
  if (typeof window === "undefined" || theme === "light" || window.matchMedia("(min-width: 900px)").matches) return undefined;
  if (theme === "auto" && !window.matchMedia("(prefers-color-scheme: dark)").matches) return undefined;
  const id = window.setTimeout(() => { const im = new Image(); im.decoding = "async"; im.src = calm() ? CALM : STILL; }, 1200);
  return () => window.clearTimeout(id);
}

export default function Lion() {
  const open = useRef(null), loop = useRef(null);
  const [stage, setStage] = useState(visit.stage); // what is on the screen: still -> open -> loop
  const [video, setVideo] = useState(null);         // null: not known yet; false: a still picture only
  useEffect(() => { setVideo(!calm()); }, []);
  useEffect(() => {
    if (!video) return undefined;
    const a = open.current, b = loop.current;
    if (!a || !b) return undefined;
    let gone = false, now = a, timer = 0;
    const play = (v) => v.play().catch(() => {}); // refused (low power mode): the still picture stays
    const toLoop = () => { if (gone) return; now = b; visit.stage = "loop"; if (!b.getAttribute("src")) { b.src = LOOP; b.load(); } if (!document.hidden) play(b); };
    const begin = () => {
      if (gone) return;
      if (visit.stage === "loop") { toLoop(); return; }               // put back on the page during the loop
      a.src = OPEN; a.load();
      if (visit.t > 0.2) a.addEventListener("loadedmetadata", () => { try { a.currentTime = visit.t; } catch {} }, { once: true }); // or during the story
      a.addEventListener("playing", () => { if (gone) return; visit.stage = "open"; setStage("open"); if (!b.getAttribute("src")) { b.src = LOOP; b.load(); } }, { once: true });
      if (!document.hidden) play(a);
    };
    const onTime = () => { if (!gone && !a.ended && a.currentTime > 0) visit.t = a.currentTime; };
    const onLoop = () => { if (!gone) setStage("loop"); };
    const onHide = () => { if (document.hidden) now.pause(); else play(now); };
    a.addEventListener("ended", toLoop);
    a.addEventListener("timeupdate", onTime);
    b.addEventListener("playing", onLoop, { once: true });
    document.addEventListener("visibilitychange", onHide);
    // Not before the page itself is ready: the videos are an extra, the screen works without them.
    const start = () => { timer = window.setTimeout(begin, visit.stage === "still" ? 250 : 0); };
    if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
    return () => {
      gone = true; window.clearTimeout(timer); window.removeEventListener("load", start);
      a.removeEventListener("ended", toLoop); a.removeEventListener("timeupdate", onTime); b.removeEventListener("playing", onLoop);
      document.removeEventListener("visibilitychange", onHide);
      for (const v of [a, b]) { v.pause(); v.removeAttribute("src"); v.load(); }
    };
  }, [video]);
  const common = { muted: true, playsInline: true, preload: "none", tabIndex: -1, disablePictureInPicture: true, disableRemotePlayback: true };
  return (
    <div className="lion" aria-hidden="true">
      {/* One dimmed layer holds the picture and the two videos, each fully opaque inside it: whatever is on top
          covers what is under it completely. (Dimming each one by itself let the one underneath show through.) */}
      <div className="lion-in">
        {video === null ? null : !video ? <img src={CALM} alt="" decoding="async" />
          : visit.stage === "still" ? <img src={STILL} alt="" decoding="async" /> : visit.stage === "loop" ? <img src={SNOW} alt="" decoding="async" /> : null}
        {video ? (
          <>
            <video ref={open} className={stage === "open" ? "on" : ""} {...common} />
            <video ref={loop} className={stage === "loop" ? "on" : ""} loop {...common} />
          </>
        ) : null}
      </div>
    </div>
  );
}
