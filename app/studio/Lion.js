"use client";
import { useEffect, useRef, useState } from "react";

// The empty Create screen on a phone: the lion in the snow, behind the title and the prompt box.
// A still picture is there at once. After the page is ready the opening video is fetched and played once (the lion
// walks in, roars and lies down, 19 seconds), and then the quiet loop (he lies there, 5 seconds) plays for as
// long as the screen is open. The opening ends on the frame the loop starts from, so nothing jumps.
// Every time the screen is opened, the opening plays again.
// A still picture only: a slow or metered connection, "reduce motion", or a browser that will not autoplay.
// The files are in public/create. Silent: the videos have no sound track.
const OPEN = "/create/lion-open.mp4", LOOP = "/create/lion-loop.mp4", STILL = "/create/lion.webp";

export function calm() {
  if (typeof window === "undefined") return true;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return Boolean((c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || ""))) || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

export default function Lion() {
  const open = useRef(null), loop = useRef(null);
  const [stage, setStage] = useState("still"); // still -> open -> loop
  const [video, setVideo] = useState(false);
  useEffect(() => { if (!calm()) setVideo(true); }, []);
  useEffect(() => {
    if (!video) return undefined;
    const a = open.current, b = loop.current;
    if (!a || !b) return undefined;
    let gone = false, now = a, timer = 0;
    const play = (v) => v.play().catch(() => {}); // refused (low power mode): the still picture stays
    const begin = () => {
      if (gone) return;
      a.src = OPEN; a.load();
      a.addEventListener("playing", () => { if (!gone) { setStage("open"); if (!b.src) { b.src = LOOP; b.load(); } } }, { once: true });
      if (!document.hidden) play(a);
    };
    const onEnd = () => { if (gone) return; now = b; if (!b.src) { b.src = LOOP; b.load(); } if (!document.hidden) play(b); };
    const onLoop = () => { if (!gone) setStage("loop"); };
    const onHide = () => { if (document.hidden) now.pause(); else play(now); };
    a.addEventListener("ended", onEnd);
    b.addEventListener("playing", onLoop, { once: true });
    document.addEventListener("visibilitychange", onHide);
    // Not before the page itself is ready: the videos are an extra, the screen works without them.
    const start = () => { timer = window.setTimeout(begin, 250); };
    if (document.readyState === "complete") start(); else window.addEventListener("load", start, { once: true });
    return () => {
      gone = true; window.clearTimeout(timer); window.removeEventListener("load", start);
      a.removeEventListener("ended", onEnd); b.removeEventListener("playing", onLoop);
      document.removeEventListener("visibilitychange", onHide);
      for (const v of [a, b]) { v.pause(); v.removeAttribute("src"); v.load(); }
    };
  }, [video]);
  const common = { muted: true, playsInline: true, preload: "none", tabIndex: -1, disablePictureInPicture: true, disableRemotePlayback: true };
  return (
    <div className="lion" aria-hidden="true">
      <img src={STILL} alt="" decoding="async" />
      {video ? (
        <>
          <video ref={open} className={stage === "still" ? "" : "on"} {...common} />
          <video ref={loop} className={stage === "loop" ? "on" : ""} loop {...common} />
        </>
      ) : null}
    </div>
  );
}
