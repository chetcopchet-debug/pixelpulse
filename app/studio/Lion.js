"use client";
import { useEffect, useRef, useState } from "react";
import { startSnow } from "./Snow";

// The empty Create screen on a phone: the lion in the snow, behind the title and the prompt box.
// A still picture (the empty landscape) is there at once. After the page is ready the story is fetched and played
// once: the lion walks in from the right, stops, shakes off the snow, roars, lies down, looks around, gets up and
// walks out on the left (25 seconds). The story's last frame is the landscape he left, with his footprints; a sharp
// still picture of that same landscape then fades in over it, and snow drawn by the page (Snow.js) falls over the
// picture for as long as the screen is open. The page's snow starts a little before the story ends, while the
// video's own snow fades, so the two overlap.
// The story starts again only when the Create screen is entered (from another tab, or when the app opens). It does
// not start again for anything that happens inside Create: where it is in the story is remembered here, outside
// the component, so even if the component were taken off the page and put back, it would go on from the same
// moment (switching between Image and Video must never restart it).
// The sharp picture only, with no snow and no video: a slow or metered connection, "reduce motion".
// The files are in public/create. Silent: the video has no sound track.
// A changed file gets a new name (the files are cached for 30 days).
const STORY = "/create/lion-story-3.mp4", FIRST = "/create/lion-first-2.webp", REST = "/create/lion-rest-3.webp";
const SNOW_EARLY = 3; // seconds before the story's end at which the page's snow starts to appear

// Where the story is, for this visit to Create: "still" (not started), "open" (playing, at `t` seconds) or "rest".
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
  const id = window.setTimeout(() => { const im = new Image(); im.decoding = "async"; im.src = calm() ? REST : FIRST; }, 1200);
  return () => window.clearTimeout(id);
}

export default function Lion() {
  const story = useRef(null), snow = useRef(null);
  const [stage, setStage] = useState(visit.stage); // what is on the screen: still -> open -> rest
  const [video, setVideo] = useState(null);         // null: not known yet; false: the sharp picture only
  const [snowing, setSnowing] = useState(visit.stage === "rest");
  useEffect(() => { setVideo(!calm()); }, []);
  useEffect(() => {
    if (!video) return undefined;
    const a = story.current;
    if (!a) return undefined;
    let gone = false, timer = 0;
    const play = () => a.play().catch(() => {}); // refused (low power mode): the first picture stays
    const rest = () => { if (gone) return; visit.stage = "rest"; setStage("rest"); setSnowing(true); };
    const begin = () => {
      if (gone || visit.stage === "rest") return;                      // put back on the page after the story: nothing to play
      a.src = STORY; a.load();
      if (visit.t > 0.2) a.addEventListener("loadedmetadata", () => { try { a.currentTime = visit.t; } catch {} }, { once: true }); // or during it
      a.addEventListener("playing", () => { if (gone) return; visit.stage = "open"; setStage("open"); const im = new Image(); im.decoding = "async"; im.src = REST; }, { once: true });
      if (!document.hidden) play();
    };
    const onTime = () => {
      if (gone || a.ended || !(a.currentTime > 0)) return;
      visit.t = a.currentTime;
      if (a.duration && a.currentTime >= a.duration - SNOW_EARLY) setSnowing(true);
    };
    const onHide = () => { if (visit.stage !== "open") return; if (document.hidden) a.pause(); else play(); };
    a.addEventListener("ended", rest);
    a.addEventListener("timeupdate", onTime);
    document.addEventListener("visibilitychange", onHide);
    // Not before the page itself is ready: the video is an extra, the screen works without it.
    const start = () => { timer = window.setTimeout(begin, visit.stage === "still" ? 250 : 0); };
    if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
    return () => {
      gone = true; window.clearTimeout(timer); window.removeEventListener("load", start);
      a.removeEventListener("ended", rest); a.removeEventListener("timeupdate", onTime);
      document.removeEventListener("visibilitychange", onHide);
      a.pause(); a.removeAttribute("src"); a.load();
    };
  }, [video]);
  // The page's snow runs only while it is shown.
  useEffect(() => (video && snowing && snow.current ? startSnow(snow.current) : undefined), [video, snowing]);
  const resting = stage === "rest";
  return (
    <div className="lion" aria-hidden="true">
      {/* One dimmed layer holds everything, each part fully opaque inside it: whatever is on top covers what is
          under it completely. (Dimming each part by itself let the one underneath show through.) */}
      <div className="lion-in">
        {video && stage === "still" ? <img src={FIRST} alt="" decoding="async" /> : null}
        {video ? <video ref={story} className={stage === "open" || resting ? "on" : ""} muted playsInline preload="none" tabIndex={-1} disablePictureInPicture disableRemotePlayback /> : null}
        {video === false || (video && stage !== "still") ? <img className={`rest${video === false || resting ? " on" : ""}`} src={REST} alt="" decoding="async" /> : null}
        {video ? <canvas ref={snow} className={snowing ? "snow on" : "snow"} /> : null}
      </div>
    </div>
  );
}
