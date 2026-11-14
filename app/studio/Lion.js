"use client";
import { useEffect, useRef, useState } from "react";
import { startSnow } from "./Snow";

// The empty Create screen on a phone: the lion in the snow, behind the title and the prompt box.
// A still picture (the empty landscape) is there at once. After the page is ready the story is fetched and played
// once: the lion walks in from the right, stops, shakes off the snow, roars, lies down, looks around, gets up and
// walks out on the left (25 seconds). Then the quiet loop plays for as long as the screen is open: the landscape he
// left, with his footprints, mist, and snow falling (the video's own fine snow, and flakes drawn by the page over it). The story's last frame stays where it is and the loop
// fades in over it (the same landscape), so there is no cut.
// The story plays once in a visit to the site (until the tab is closed); every other time Create is opened, the
// loop is there at once. Nothing that happens inside Create starts the story again: where it is in the story is
// remembered here, outside the component, so even if the component were taken off the page and put back, it would
// go on from the same moment (switching between Image and Video must never restart it).
// A sharp still picture of the landscape only, with no video: a slow or metered connection, "reduce motion".
// The files are in public/create. Silent: the videos have no sound track.
// A changed file gets a new name (the files are cached for 30 days).
// The page's snow starts to fall this many seconds before the story ends, and the loop is set rolling (unseen) a
// second before it ends, so when the story stops nothing on the screen stops with it.
const SNOW_EARLY = 2.8, LOOP_EARLY = 1;
// The videos play at 60 frames a second: between Veo's 24 frames a second, frames were computed along the motion.
const OPEN = "/create/lion-story-2-60.mp4", LOOP = "/create/lion-snow-5-60.mp4", STILL = "/create/lion-first-2.webp", SNOW = "/create/lion-snow-5.webp", CALM = "/create/lion-rest-3.webp";

// The story plays once in a visit to the site: once it has started, it is not played again until the tab is closed
// (also not after the page is loaded again in the same tab). After that, entering Create goes straight to the loop.
const SEEN = "pp_lion_seen";
const seen = () => { try { return typeof window !== "undefined" && window.sessionStorage.getItem(SEEN) === "1"; } catch { return false; } };
const markSeen = () => { try { window.sessionStorage.setItem(SEEN, "1"); } catch {} };
// Where the story is: "still" (not started), "open" (playing, at `t` seconds) or "loop".
const visit = { stage: seen() ? "loop" : "still", t: 0 };
// Called when the Create screen is entered from another screen. The first time, the story plays from its start.
// If it has already started in this visit to the site (even if the person left in the middle), the loop is shown.
export function lionEnter() { if (visit.stage !== "still" || seen()) { visit.stage = "loop"; visit.t = 0; } }

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
  const id = window.setTimeout(() => { const im = new Image(); im.decoding = "async"; im.src = calm() ? CALM : seen() ? SNOW : STILL; }, 1200);
  return () => window.clearTimeout(id);
}

export default function Lion() {
  const open = useRef(null), loop = useRef(null), snow = useRef(null);
  const [stage, setStage] = useState(visit.stage); // what is on the screen: still -> open -> loop
  const [video, setVideo] = useState(null);         // null: not known yet; false: a still picture only
  const [snowing, setSnowing] = useState(visit.stage === "loop");
  useEffect(() => { setVideo(!calm()); }, []);
  useEffect(() => {
    if (!video) return undefined;
    const a = open.current, b = loop.current;
    if (!a || !b) return undefined;
    let gone = false, now = a, timer = 0;
    const play = (v) => v.play().catch(() => {}); // refused (low power mode): the still picture stays
    const roll = () => { if (!b.getAttribute("src")) { b.preload = "auto"; b.src = LOOP; b.load(); } if (b.paused && !document.hidden) play(b); };
    // The story has ended: the loop (already rolling) is shown at once, without waiting for anything.
    const toLoop = () => { if (gone) return; now = b; visit.stage = "loop"; roll(); setSnowing(true); setStage("loop"); };
    const begin = () => {
      if (gone) return;
      if (visit.stage === "loop") { toLoop(); return; }               // put back on the page during the loop
      a.src = OPEN; a.load();
      if (visit.t > 0.2) a.addEventListener("loadedmetadata", () => { try { a.currentTime = visit.t; } catch {} }, { once: true }); // or during the story
      a.addEventListener("playing", () => { if (gone) return; visit.stage = "open"; markSeen(); setStage("open"); if (!b.getAttribute("src")) { b.preload = "auto"; b.src = LOOP; b.load(); } }, { once: true });
      if (!document.hidden) play(a);
    };
    const onTime = () => {
      if (gone || a.ended || !(a.currentTime > 0)) return;
      visit.t = a.currentTime;
      const left = a.duration ? a.duration - a.currentTime : Infinity;
      if (left <= SNOW_EARLY) setSnowing(true);
      if (left <= LOOP_EARLY) roll();
    };
    const onHide = () => { if (document.hidden) { a.pause(); b.pause(); } else play(now); };
    a.addEventListener("ended", toLoop);
    a.addEventListener("timeupdate", onTime);
    document.addEventListener("visibilitychange", onHide);
    // Not before the page itself is ready: the videos are an extra, the screen works without them.
    const start = () => { timer = window.setTimeout(begin, visit.stage === "still" ? 250 : 0); };
    if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
    return () => {
      gone = true; window.clearTimeout(timer); window.removeEventListener("load", start);
      a.removeEventListener("ended", toLoop); a.removeEventListener("timeupdate", onTime);
      document.removeEventListener("visibilitychange", onHide);
      for (const v of [a, b]) { v.pause(); v.removeAttribute("src"); v.load(); }
    };
  }, [video]);
  // Snow drawn by the page falls over the loop (Snow.js). It runs only while the loop is on the screen.
  useEffect(() => (video && snowing && snow.current ? startSnow(snow.current) : undefined), [video, snowing]);
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
            <video ref={open} className={stage === "open" || stage === "loop" ? "on" : ""} {...common} />
            <video ref={loop} className={stage === "loop" ? "loop on" : "loop"} loop {...common} />
            <canvas ref={snow} className={snowing ? "snow on" : "snow"} />
          </>
        ) : null}
      </div>
    </div>
  );
}
