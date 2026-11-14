"use client";
import { t, tn, N } from "../i18n/index.js";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FORMATS } from "../../lib/formats";
import { thumbUrl, posterUrl } from "../../lib/thumbs";
import Icon from "./icons";
import { Price, Picture, Full, Poster, Brand, Balance, useNow } from "./bits";
import { imageModel, videoModel, videoPlan, videoTakesImage, TOOLS, comparePlan, stageOf, stageTime, resLabel } from "./models";
import { nextActions } from "./next";
import { ideaCards } from "./ideas";
import { autoPick, recommend, VIDEO_AUTO_CAP } from "./auto";
import { fitGrid, ratioOf } from "./layout";
import { download } from "./download";
import { GrowButton, growMax } from "./GrowField";
import Lion from "./Lion";
import { uploadAgreed } from "./Sheets";

// A real desktop layout from this width up; below it, the phone layout.
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches);
  useEffect(() => {
    const q = window.matchMedia("(min-width: 900px)");
    const on = () => setWide(q.matches);
    on(); q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return wide;
}
// The size of an element, kept up to date.
function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const read = () => setSize((p) => (p.w === el.clientWidth && p.h === el.clientHeight ? p : { w: el.clientWidth, h: el.clientHeight }));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
// On a phone the keyboard covers the bottom of the page. This gives the part that is still visible, so the
// prompt box and the button sit right above the keyboard instead of behind it.
// Is the screen dark right now? ("auto" follows the device.) The lion is made for the dark screen.
function useDark(theme) {
  const [dark, setDark] = useState(theme !== "light");
  useEffect(() => {
    if (theme !== "auto") { setDark(theme !== "light"); return undefined; }
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(q.matches);
    on(); q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [theme]);
  return dark;
}
function useKeyboard() {
  const [frame, setFrame] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    const fit = () => setFrame(window.innerHeight - vv.height > 120 ? { top: vv.offsetTop, height: vv.height } : null);
    fit(); vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit);
    return () => { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); };
  }, []);
  return frame;
}

const busyRun = (r) => r.status === "running" || r.status === "late";
const elapsed = (run, now) => (now - run.t0) / 1000;
const percent = (run, now) => run.phase === "improving" ? 4 : Math.round(Math.min(96, Math.max(4, (elapsed(run, now) / (run.eta || 25)) * 100)));
// An estimate, said as one: how long is left.
function leftText(run, now) {
  if (run.phase === "improving") return t("Improving your prompt…");
  if (run.status === "late") return t("Still rendering");
  const left = (run.eta || 25) - elapsed(run, now);
  if (left > 90) return t("About {n} minutes left", { n: Math.round(left / 60) });
  if (left > 1) return t("About {n} seconds left", { n: Math.ceil(left) });
  return elapsed(run, now) > (run.eta || 25) * 1.5 ? t("Taking longer than usual") : t("Almost there");
}

// Other things still being made, and anything that failed: one slim line each, above the prompt box.
function Jobs({ runs, s, now }) {
  if (!runs.length) return null;
  const shown = runs.slice(-3), more = runs.length - shown.length;
  return (
    <div className="jobs">
      {more > 0 ? <p className="sm t3" style={{ padding: "0 4px" }}>{t("And {n} more in progress", { n: more })}</p> : null}
      {shown.map((run) => {
        if (run.status === "failed") {
          // `alt`: the model refused the picture (a realistic face), so the same video is offered on one that takes it.
          const alt = run.alt ? videoModel(run.alt.model) : null;
          const altCost = alt ? videoPlan(alt.id, undefined, undefined, run.alt.source?.ratio, true)?.cost : null;
          return (
            <div key={run.key} className={`job err${alt ? " alt" : ""}`} role="alert">
              <Icon name="alert" size={18} />
              <p className="job-t">{run.error}</p>
              {alt ? <button className="job-alt" onClick={() => s.retry({ ...run, again: run.alt })}><span>{t("Try {name}", { name: alt.name })}</span>{altCost ? <Price n={altCost} /> : null}</button>
                : run.again ? <button className="job-b" onClick={() => s.retry(run)}>{t("Try again")}</button> : null}
              <button className="job-x" aria-label={t("Dismiss")} onClick={() => s.dropRun(run.key)}><Icon name="x" size={18} /></button>
            </div>
          );
        }
        const parts = run.parts || [];
        const sub = run.status === "late" ? t("It will be in your Library when it's ready") : run.kind === "video" ? t("You can close the site meanwhile") : run.kind === "compare" ? t("{done} of {all} ready", { done: parts.filter((p) => p.status !== "running").length, all: parts.length }) : run.prompt;
        return (
          <div key={run.key} className="job" role="status" aria-live="polite">
            {run.status === "late" ? <Icon name="timer" size={18} /> : <i className="spin" style={{ width: 16, height: 16 }} />}
            <p className="job-t"><span className="b clamp1">{run.label}</span>{sub ? <span className="t3 clamp1">{sub}</span> : null}</p>
            <span className="job-r">{run.kind === "compare" || run.status === "late" ? "" : leftText(run, now).replace(/ left$/, "")}</span>
            {run.status === "late" ? <button className="job-x" aria-label={t("Dismiss")} onClick={() => s.dropRun(run.key)}><Icon name="x" size={18} /></button> : <i className="job-bar" style={{ width: `${percent(run, now)}%` }} />}
          </div>
        );
      })}
    </div>
  );
}

// One setting in the desktop column: its name, its value, and a tap to change it.
function Row({ name, value, onClick, label }) {
  return <button className="set-row" onClick={onClick} aria-label={label}><span className="t2">{name}</span><span className="b clamp1">{value}</span><Icon name="right" size={18} style={{ color: "var(--text-3)" }} /></button>;
}

// The glow behind the window: the picture itself, blurred until only its colors are left. Two layers take turns,
// so the colors of one picture fade into those of the next. With no picture (while something is being made) both
// layers fade out and the background is plain. A picture is only shown once it has loaded, so nothing pops in.
function Glow({ src }) {
  const [st, setSt] = useState({ a: null, b: null, top: "a", on: false });
  useEffect(() => {
    if (!src) { setSt((p) => (p.on ? { ...p, on: false } : p)); return; }
    let live = true;
    const im = new Image();
    im.onload = () => { if (live) setSt((p) => { if (p[p.top] === src) return { ...p, on: true }; const next = p.top === "a" ? "b" : "a"; return { ...p, [next]: src, top: next, on: true }; }); };
    im.onerror = () => { if (live) setSt((p) => ({ ...p, on: false })); };
    im.src = src;
    return () => { live = false; };
  }, [src]);
  const layer = (k) => <div className={`amb${st.on && st.top === k ? " on" : ""}`} style={st[k] ? { backgroundImage: `url("${st[k]}")` } : undefined} aria-hidden="true" />;
  return <>{layer("a")}{layer("b")}</>;
}

// What is happening while a picture is being made, in a few words that take turns.
const WORDS = {
  image: [N("Mixing colors…"), N("Adding light…"), N("Sharpening details…")],
  video: [N("Setting the scene…"), N("Adding motion…"), N("Rendering frames…")],
};
function Words({ it, now }) {
  const video = it.kind === "video";
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => x + 1), 3600); return () => clearInterval(t); }, []);
  const pct = percent(it, now);
  const last = pct >= 88;
  const list = WORDS[video ? "video" : "image"];
  const fixing = it.phase === "improving";
  const text = fixing ? t("Improving your prompt…") : last ? t("Finishing touches…") : t(list[i % list.length]);
  return (
    <div className="words" aria-hidden="true">
      <p key={text} className={last || fixing ? "stay" : undefined}>{text}{fixing ? null : <span className="num">{pct}%</span>}</p>
      {video ? <p className="words-n">{t("You can close the site. The video is saved to your Library.")}</p> : null}
    </div>
  );
}

// One frame for the whole life of a creation. While it is being made, a soft light moves slowly across the
// frame; the finished picture then develops in the very same place. `it` is a run, or one model of a comparison.
//  - The big frame of a single creation fills all the room there is, whatever the shape of the picture. The
//    picture sits whole in the middle of it, and the room around it is a dark, blurred copy of the same picture
//    (`back`). `foot` is the height at the bottom kept for the prompt line and the actions (`children`).
//  - The small frames of a comparison have the shape of the picture itself.
function Shot({ it, box, now, s, small, back, foot = 0, children }) {
  const item = it.status === "done" ? it.item : null;
  const [seen, setSeen] = useState(false); // the picture has loaded
  const [calm, setCalm] = useState(false); // the picture has developed, so the moving light underneath can stop
  useEffect(() => { if (item?.video) setSeen(true); }, [item]);
  useEffect(() => { if (!seen) return; const t = setTimeout(() => setCalm(true), 700); return () => clearTimeout(t); }, [seen]);
  return (
    <div className={`frame2${small ? "" : " full"}`} style={{ width: box.w, height: box.h }} role={item ? undefined : "status"} aria-label={item ? undefined : it.kind === "video" ? t("Rendering") : t("Generating")}>
      {seen && calm ? null : <div className="breath" aria-hidden="true"><i /></div>}
      {item && back ? <div className={`back${seen ? " in" : ""}`} style={{ backgroundImage: `url("${back}")` }} aria-hidden="true" /> : null}
      {item ? null : small ? <p className="mist-t num" aria-hidden="true">{percent(it, now)}%</p> : <Words it={it} now={now} />}
      {item ? (
        <button className={`shot3${seen ? " in" : ""}`} style={small ? undefined : { bottom: foot }} onClick={() => s.setViewer({ item })} aria-label={item.video ? t("Open video") : t("Open image")}>
          {item.video
            ? <><Poster item={item} version={s.posters[item.id]} /><span className="play"><Icon name="play" size={22} /></span></>
            : <Full src={item.url} alt={item.prompt || ""} onLoad={() => setSeen(true)} />}
        </button>
      ) : null}
      {item && seen && children ? <div className="over">{children}</div> : null}
    </div>
  );
}

// A row that scrolls sideways and says so: the side that has more fades out, and stops fading at the end.
function Row2({ children }) {
  const ref = useRef(null);
  const [more, setMore] = useState({ l: false, r: false });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const see = () => setMore({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    see();
    el.addEventListener("scroll", see, { passive: true });
    const ro = new ResizeObserver(see); ro.observe(el);
    return () => { el.removeEventListener("scroll", see); ro.disconnect(); };
  }, []);
  return <div className={`acts2${more.l ? " ml" : ""}${more.r ? " mr" : ""}`} ref={ref}>{children}</div>;
}

// Everything between the top bar and the prompt box. One thing at a time: what is being made right now, or else
// the latest result, or, before anything was made, pictures to start from. While something is being made nothing
// of an earlier result is on screen, not even its colors in the background.
function Stage({ run, wait, s, now, video, wide, onIdea, lion, onDown }) {
  const ref = useRef(null);
  const size = useSize(ref);
  const [saving, setSaving] = useState(false);
  const show = wait || run;
  const item = !wait && run && run.kind !== "compare" ? run.item : null;
  const canAct = Boolean(item && !item.video && item.id);

  // A single creation gets one frame that fills all the room between the top and the prompt box. The picture
  // sits whole in the upper part of it; the prompt line and the actions lie over the blurred lower part. So the
  // frame is the same size while waiting and after, nothing is black, and nothing moves when the picture arrives.
  // On a phone the actions of an image are two rows of tiles, all in view. A short screen gets one row that
  // scrolls sideways, with the edge fading out to show there is more.
  const side = wide ? 24 : 10;
  const single = show && show.kind !== "compare";
  const w = size.w - side * 2;
  const h = size.h - (wide ? 32 : 8);
  const acts = single && show.kind === "image";
  const tiles = !wide && acts && h >= 480;
  const under = !acts ? 0 : wide ? (h >= 420 ? 100 : 0) : tiles ? 114 : h >= 320 ? 52 : 0;
  const foot = 46 + (under && canAct ? under + 8 : 0);
  const tiny = h < 120;

  const save = async () => { if (saving || !item) return; setSaving(true); await download(item); setSaving(false); };
  const glowOf = (r) => { const x = r?.kind === "compare" ? r.parts.find((p) => p.item)?.item : r?.item; return x ? (x.video ? posterUrl(x.url) : thumbUrl(x.url)) : null; };
  const cards = ideaCards(s.explore.items, video);
  const glow = wait ? null : run ? glowOf(run) : lion ? null : cards[0].src; // the lion screen has its own picture behind it
  const fav = item?.id && s.favs.has(item.id);
  const cap = (
    <>
      <p className="grow clamp1">{run?.unsaved && !wait ? t("Not saved to your Library. Download it now to keep it.") : show?.prompt || ""}</p>
      {show?.used && !wait ? <button className="ib used" aria-label={t("Prompt improved. See what was used")} onClick={() => s.setSheet({ type: "used", text: show.used, idea: show.prompt })}><Icon name="wand" /></button> : null}
      {show?.kind === "compare" && show.cost ? <Price n={show.cost} /> : null}
      {item?.id ? <button className={`ib${fav ? " on" : ""}`} aria-label={fav ? t("Remove from favorites") : t("Add to favorites")} aria-pressed={Boolean(fav)} onClick={() => s.toggleFav(item)}><Icon name="heart" style={fav ? { fill: "currentColor" } : undefined} /></button> : null}
      {item ? <button className="ib" aria-label={t("Download")} onClick={save}>{saving ? <i className="spin" /> : <Icon name="download" />}</button> : null}
    </>
  );

  let main = null;
  if (show && !tiny && show.kind === "compare") {
    const ar = ratioOf(show.ratio);
    const g = fitGrid(show.parts.length, ar, w, h - 44);
    if (g) {
      const width = g.cols * g.cw + (g.cols - 1) * 8;
      main = (
        <div className="hold">
          <div className="cmp2" style={{ gridTemplateColumns: `repeat(${g.cols}, ${g.cw}px)` }}>
            {show.parts.map((p) => {
              const box = { w: g.cw, h: Math.floor(g.cw / ar) };
              return (
                <div key={p.id}>
                  {p.status === "failed" ? (
                    <div className="frame2 cmp-f" style={{ width: box.w, height: box.h }}>
                      <p className="sm clamp3">{p.error}</p>
                      {show.again ? <button className="btn btn-s" style={{ height: 40 }} onClick={() => s.retryPart(show, p.id)}><Icon name="refresh" size={16} />{t("Try again")}</button> : null}
                    </div>
                  ) : <Shot it={p} box={box} now={now} s={s} small />}
                  <div className="cmp-l"><span className="clamp1">{p.name}</span>{p.unsaved ? <span className="sm t3">{t("Not saved")}</span> : <Price n={p.cost} />}</div>
                </div>
              );
            })}
          </div>
          <div className="cap2 t2" style={{ width: Math.min(w, Math.max(width, 260)) }}>{cap}</div>
        </div>
      );
    }
  } else if (show && !tiny) {
    main = (
      <div className="hold">
        <Shot key={show.key} it={show} box={{ w, h }} now={now} s={s} back={glowOf(show)} foot={foot}>
          <div className="cap2">{cap}</div>
          {under && canAct ? (
            <div className="under2" style={{ height: under }}>
              {tiles ? (
                <div className="next4">
                  {nextActions(s, item).map((a) => (
                    <button key={a.key} className="nx" onClick={a.run} disabled={Boolean(s.busyTool)} aria-label={tn(N("{name}, 1 credit"), N("{name}, {n} credits"), { name: a.label, n: a.cost })}>
                      <span className="nx-t">{s.busyTool === a.key ? <i className="spin" style={{ width: 16, height: 16 }} /> : <Icon name={a.icon} size={18} />}<Price n={a.cost} /></span>
                      <span className="nx-l clamp1">{a.short}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <Row2>
                  {nextActions(s, item).map((a) => (
                    <button key={a.key} className="act3" onClick={a.run} disabled={Boolean(s.busyTool)}>
                      {s.busyTool === a.key ? <i className="spin" style={{ width: 16, height: 16 }} /> : <Icon name={a.icon} size={18} />}<span>{a.label}</span><Price n={a.cost} />
                    </button>
                  ))}
                </Row2>
              )}
            </div>
          ) : null}
        </Shot>
      </div>
    );
  } else if (!show && lion) {
    // The phone's start screen: the lion is behind (Create puts it there); here only the title. The ideas are one
    // tap away, on the lamp in the prompt box.
    main = size.h >= 150 ? <div className="start"><div className="start-h"><h1 className="d">{video ? t("What should the video show?") : t("What do you want to make?")}</h1></div></div> : null;
  } else if (!show && size.h >= 150) {
    main = (
      <div className="start">
        <div className="start-h">
          <h1 className="d">{video ? t("What should the video show?") : t("What do you want to make?")}</h1>
          <p className="t2">{wide ? t("Write it on the left, or start from one of these.") : t("Write it below, or start from one of these.")}</p>
        </div>
        <div className="ideas">
          {cards.map((x) => (
            <button key={x.key} className="idea2" onClick={() => onIdea(x.prompt)} aria-label={t("Use this idea: {title}", { title: x.title.slice(0, 80) })}>
              <img src={x.src} alt="" loading="lazy" decoding="async" />
              <span><b className="clamp2">{x.title}</b></span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <>
      <Glow src={glow} />
      <section className={`stage2${show ? "" : " scroll"}`} aria-label={t("Latest result")} ref={ref} onPointerDown={onDown}>{main}</section>
    </>
  );
}

export default function Create({ s }) {
  const video = s.mode === "video";
  const wide = useWide();
  const keyboard = useKeyboard();
  const fileRef = useRef(null), textRef = useRef(null);
  const now = useNow(s.runs.some(busyRun));

  // The prompt box grows with the text: up to six lines on a phone, more room on a wide screen.
  // The corner button opens the box to show the whole prompt without scrolling, up to 70% of the screen
  // (the line of buttons above the text counts in that).
  const [big, setBig] = useState(false);
  // On a phone the box closes to a short form the moment a creation starts: two lines of the prompt, and none of
  // the notes under it (the "improved" line, the model suggestion). After an improvement the open box is so tall
  // that no room was left above it, so the waiting screen, and then the result, could not be shown at all and it
  // looked as if nothing had happened. Tapping the text, or changing it, opens the box again.
  const [slim, setSlim] = useState(false);
  const newest = s.runs.length ? s.runs[s.runs.length - 1] : null;
  const startedKey = newest && newest.status === "running" ? newest.key : null;
  useEffect(() => { setSlim(false); }, [s.prompt]);
  useEffect(() => { if (startedKey) { setSlim(true); setBig(false); } }, [startedKey]);
  const short2 = slim && !wide;
  // Leaving the box closes it again when there is something above it to see: a tap outside it, or the keyboard
  // put away. A tap inside the box (the improve button, the model, Generate) never closes it, so nothing moves
  // under a finger.
  const dockTap = useRef(0);
  const something = s.runs.some((r) => r.status === "running" || r.status === "done");
  const closeBox = () => { if (something && Date.now() - dockTap.current > 600 && document.activeElement !== textRef.current) setSlim(true); };
  // A moment later, not at once: the tap that took the focus away must land first, where the finger is.
  const closeSoon = () => { window.setTimeout(closeBox, 300); };
  useLayoutEffect(() => { const el = textRef.current; if (!el) return; const [lo, hi] = wide ? [132, 280] : [24, short2 ? 48 : 110]; el.style.height = "auto"; el.style.height = `${Math.min(big ? Math.max(hi, growMax() - 40) : hi, Math.max(lo, el.scrollHeight))}px`; }, [s.prompt, wide, big, short2]);
  const grow = <GrowButton on={big} onClick={() => setBig((b) => !b)} />;

  // The window shows the newest thing: an image or video being made right now, or else the latest result.
  // (A comparison is its own result from the moment it starts.) Everything else in progress, and anything that
  // failed, is a slim line above the prompt box.
  const stage = stageOf(s.runs);
  const making = [...s.runs].reverse().find((r) => r.kind !== "compare" && r.status === "running") || null;
  const wait = making && (!stage || making.t0 >= stageTime(stage)) ? making : null;
  const jobs = s.runs.filter((r) => r !== stage && r !== wait && r.status !== "done");

  // Auto for video: the model follows the prompt, at the chosen length and quality.
  const vauto = video && !s.ref && s.vAuto ? recommend(s.prompt, "video", s.wallet, s.off, (id) => videoPlan(id, s.vDur, s.vRes, s.ratio)?.cost, VIDEO_AUTO_CAP) : null;
  const vm = videoModel(vauto?.pick || s.vidModel);
  // A video that starts from a picture: on the chosen model when it can do that, otherwise Wan's fixed "Animate".
  const fromImg = Boolean(video && s.ref && videoTakesImage(vm.id));
  const plan = video ? videoPlan(vm.id, s.vDur, s.vRes, fromImg ? s.ref.ratio : s.ratio, fromImg) : null;
  const cmp = !video && !s.ref ? comparePlan(s.compare) : null; // two or more models chosen: compare them
  // Auto: the model follows the prompt, and the button shows it with its price before anything is charged.
  const auto = !video && !s.ref && !cmp && s.auto ? autoPick(`${s.prompt} ${s.format !== "free" ? FORMATS[s.format]?.label || "" : ""}`, s.wallet, s.off) : null;
  const im = imageModel(auto ? auto.id : s.imgModel);
  const cost = s.ref ? (video ? (fromImg ? plan?.cost : TOOLS.animate.cost) : TOOLS.reference.cost) : video ? plan?.cost : cmp ? cmp.cost : im.cost;
  const action = s.ref ? (video ? t("Animate image") : t("Generate from image")) : video ? t("Generate video") : cmp ? t("Compare {n} models", { n: cmp.models.length }) : t("Generate");
  const placeholder = s.ref ? (video ? t("Describe the motion (optional)") : t("Describe the new image")) : video ? t("Describe the video you want") : t("Describe the image you want");
  const lockedRatio = !video && s.format !== "free" ? FORMATS[s.format]?.ratio : null; // a format fixes the shape
  const canGo = Boolean(s.prompt.trim()) || (video && s.ref);
  const project = s.projectsOn ? s.projects.find((p) => p.id === s.project) : null; // new creations are saved into it
  const modelName = cmp ? t("{n} models", { n: cmp.models.length }) : auto || vauto ? t("Auto") : video ? vm.name : im.name;
  const modelLabel = cmp ? t("Comparing {n} models. Change", { n: cmp.models.length }) : t("Model: {name}. Change", { name: auto || vauto ? t("Auto") : video ? vm.name : im.name });
  // Adding a picture. The first time on this device a short sheet says what may be uploaded; its button opens the
  // file picker. After that the picker opens at once.
  const pickFile = () => {
    if (s.needAccount({ tab: "create" })) return;
    const open = () => fileRef.current?.click();
    if (uploadAgreed()) open(); else s.setSheet({ type: "upload", pick: open });
  };

  const mode = (
    <div className="seg" role="tablist" aria-label={t("What to make")}>
      <button role="tab" aria-selected={!video} className={video ? "" : "on"} onClick={() => s.setMode("image")}><Icon name="image" size={18} />{t("Image")}</button>
      <button role="tab" aria-selected={video} className={video ? "on" : ""} onClick={() => s.setMode("video")}><Icon name="video" size={18} />{t("Video")}</button>
    </div>
  );
  const text = (
    <textarea ref={textRef} className={big ? "prompt big" : "prompt"} rows={1} maxLength={1500} value={s.prompt} placeholder={placeholder} aria-label={placeholder}
      onChange={(e) => s.setPrompt(e.target.value)} onFocus={() => setSlim(false)} onBlur={closeSoon}
      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); s.generate(); } }} />
  );
  const refcard = s.ref ? (
    <div className="refcard">
      <span className="tile"><Picture src={s.ref.url} eager /></span>
      <div className="grow">
        <p className="b sm">{video ? t("Start frame") : t("Reference image")}</p>
        <p className="sm t3 clamp1">{video ? t("The video begins from this image") : t("The new image follows its look")}</p>
      </div>
      <button className="ib" aria-label={t("Remove the image")} onClick={() => s.setRef(null)}><Icon name="x" /></button>
    </div>
  ) : null;
  const tags = (
    <>
      {s.format !== "free" && FORMATS[s.format] && !video ? (
        <div className="r" style={{ gap: 4 }}>
          <span className="chip grow clamp1" style={{ flex: "0 1 auto" }}>{t("Format: {name}", { name: FORMATS[s.format].label })}</span>
          <button className="ib" aria-label={t("Remove the format")} onClick={() => s.setFormat("free")}><Icon name="x" size={18} /></button>
        </div>
      ) : null}
      {project ? (
        <div className="r" style={{ gap: 4 }}>
          <span className="chip grow clamp1" style={{ flex: "0 1 auto" }}><Icon name="folder" size={16} />{t("Saving to: {name}", { name: project.name })}</span>
          <button className="ib" aria-label={t("Stop saving into this project")} onClick={() => s.setProject(null)}><Icon name="x" size={18} /></button>
        </div>
      ) : null}
    </>
  );
  // After the improve button: which model makes the most of this prompt, said openly with its price and why, and
  // a cheap one beside it. Nothing changes until the person taps "Use". When the balance does not cover the best
  // one, the best that it does cover is offered, with a way to add credits for the first.
  const priceOf = (id) => (video ? videoPlan(id, s.vDur, s.vRes, s.ratio)?.cost : imageModel(id).cost);
  const rec = s.polish && !s.ref && !cmp && s.prompt.trim() ? recommend(s.prompt, video ? "video" : "image", s.wallet, s.off, priceOf) : null;
  const nameOf = (id) => (video ? videoModel(id) : imageModel(id)).name;
  const recRow = (label, id, note) => (
    <div className="rec-r">
      <span className="grow"><span className="sm t2">{label}</span><span className="b clamp1">{nameOf(id)}</span>{note ? <span className="sm t2">{note}</span> : null}</span>
      <Price n={rec.cost(id)} />
      {id === (video ? vm.id : im.id) ? <span className="rec-on"><Icon name="check" size={14} />{t("Selected")}</span> : <button onClick={() => (video ? s.setVidModel : s.setImgModel)(id)}>{t("Use")}</button>}
    </div>
  );
  const recline = rec ? (
    <div className="recbox" role="status">
      {recRow(rec.fitted ? t("Best for your balance") : t("Best for this prompt"), rec.pick, `${t(rec.why)}.`)}
      {rec.fitted ? (
        <div className="rec-r">
          <span className="grow sm t2">{tn(N("{name} is the best for this prompt. It needs 1 more credit."), N("{name} is the best for this prompt. It needs {n} more credits."), { name: nameOf(rec.best), n: rec.short })}</span>
          <button onClick={() => s.askCredits(rec.cost(rec.best), nameOf(rec.best), video)}>{t("Add credits")}</button>
        </div>
      ) : null}
      {rec.saver !== rec.pick ? recRow(t("Economical"), rec.saver) : null}
    </div>
  ) : null;
  const picked = auto ? { name: im.name, why: auto.why, fitted: auto.fitted } : vauto?.pick ? { name: vm.name, why: vauto.why, fitted: vauto.fitted } : null;
  const autoline = rec ? recline : picked && s.prompt.trim() ? <p className="sm t2 autoline" role="status"><span className="b" style={{ color: "var(--text)" }}>{picked.name}.</span> {t(picked.why)}.{picked.fitted ? t(" Fits your balance.") : ""}</p> : null;
  const go = (
    <button className="btn btn-p btn-wide btn-split" onClick={s.generate} disabled={!canGo || s.generating} aria-busy={s.generating || undefined}>
      <span>{action}</span>{s.generating ? <i className="spin" style={{ width: 16, height: 16 }} /> : cost ? <Price n={cost} /> : null}
    </button>
  );
  const file = <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) s.upload(f); }} />;
  // The phone's start screen on a dark screen: the lion, with only the title and the prompt box over it.
  const dark = useDark(s.theme);
  const lion = !wide && dark && !stage && !wait;
  const more = Boolean(stage || wait || lion); // the start screen with the cards already shows the ideas; otherwise they are one tap away
  const short = s.ref ? (video ? t("Animate") : t("Generate")) : cmp ? t("Compare {n}", { n: cmp.models.length }) : t("Generate");
  const stageEl = <Stage run={wait ? null : stage} wait={wait} s={s} now={now} video={video} wide={wide} lion={lion} onDown={wide ? undefined : closeSoon} onIdea={(t) => { s.setPrompt(t); textRef.current?.focus(); }} />;

  // "Improve my prompt": a short idea is filled in before it is made. Not with a reference image or a start frame
  // (the words there describe a change), and not when comparing models (each model must get the same words).
  const canImprove = !cmp; // with a picture attached too: the model then looks at it
  const improveRow = canImprove ? (
    <button className="set set-row" style={{ padding: "10px 12px 10px 14px" }} role="switch" aria-checked={s.improve} onClick={() => s.setImprove(!s.improve)}>
      <span className="grow"><span className="b" style={{ display: "block" }}>{t("Improve my prompt")}</span><span className="sm t2" style={{ display: "block" }}>{t("Short ideas are filled in before they are made. Text in quotes stays as you wrote it.")}</span></span>
      <span className={`tg${s.improve ? " on" : ""}`} aria-hidden="true"><i /></span>
    </button>
  ) : null;
  // The improve button fills the idea in inside the box, before anything is made. After it, a line under the box
  // says so and offers Undo.
  const hasText = Boolean(s.prompt.trim());
  const canPolish = canImprove && (hasText || Boolean(s.ref)); // also after an improvement: another press gives another version
  const proBtn = (
    <button className="propill" disabled={Boolean(s.improving)} onClick={() => s.improveNow("pro")} aria-label={t("Improve with Pro, 1 credit")}>
      {s.improving === "pro" ? <i className="spin" style={{ width: 14, height: 14 }} /> : <Icon name="wand" size={14} />}{t("Pro")}<Price n={1} />
    </button>
  );
  const polishLine = s.polish ? (
    <div className="polish" role="status">
      <Icon name="wand" size={16} /><span className="grow">{s.polish.pro ? t("Improved with Pro. You can edit it.") : t("Improved. You can edit it.")}</span>
      {canImprove ? proBtn : null}
      <button onClick={s.undoImprove}><Icon name="undo" size={16} />{t("Undo")}</button>
    </div>
  ) : s.improving ? (
    <div className="polish" role="status"><i className="spin" style={{ width: 16, height: 16, flex: "none" }} /><span className="grow">{t("Improving your prompt…")}</span></div>
  ) : null;

  if (wide) {
    // Desktop: settings in a column on the left, the result large in the rest of the window.
    return (
      <div className="create wide">
        <aside className="panel" aria-label={t("What to make")}>
          <div className="panel-top"><Brand wordmark /><Balance s={s} /></div>
          <div className="panel-body">
            {mode}
            <div className="field2"><div className="pbar">{grow}</div>{text}</div>
            {polishLine}
            {canPolish ? (
              <div className="r" style={{ gap: 8 }}>
                <button className="set-add grow" disabled={Boolean(s.improving)} onClick={() => s.improveNow()}>{s.improving === "std" ? <i className="spin" style={{ width: 16, height: 16 }} /> : <Icon name="wand" size={18} />}{t("Improve this prompt now")}</button>
                {s.polish ? null : proBtn}
              </div>
            ) : null}
            {s.ref ? <div className="set">{refcard}</div> : (
              <button className="set-add" disabled={s.uploading} onClick={pickFile}>{s.uploading ? <i className="spin" style={{ width: 16, height: 16 }} /> : <Icon name="plus" size={18} />}{s.uploading ? t("Uploading") : video ? t("Add a start frame") : t("Add a reference image")}</button>
            )}
            {more ? <button className="set-add" onClick={() => s.setSheet({ type: "ideas" })}><Icon name="bulb" size={18} />{t("Ideas to start from")}</button> : null}
            <div className="set">
              {s.ref && !video ? <div className="set-row"><span className="t2">{t("Model")}</span><span className="b clamp1">{TOOLS.reference.detail}</span></div> : s.ref ? (
                <>
                  <Row name={t("Model")} value={fromImg ? modelName : TOOLS.animate.detail} label={modelLabel} onClick={() => s.setSheet({ type: "models" })} />
                  {fromImg ? <Row name={t("Length and quality")} value={`${plan?.d} s, ${resLabel(plan?.r)}`} label={t("Length and quality. Change")} onClick={() => s.setSheet({ type: "video" })} /> : null}
                </>
              ) : (
                <>
                  <Row name={t("Model")} value={modelName} label={modelLabel} onClick={() => s.setSheet({ type: "models" })} />
                  {video ? <Row name={t("Length, quality, shape")} value={`${plan?.d} s, ${resLabel(plan?.r)}, ${plan?.ratio}`} label={t("Length, quality and shape. Change")} onClick={() => s.setSheet({ type: "video" })} />
                    : lockedRatio ? <div className="set-row"><span className="t2">{t("Shape")}</span><span className="b">{lockedRatio}</span></div>
                    : <Row name={t("Shape")} value={s.ratio} label={t("Shape: {ratio}. Change", { ratio: s.ratio })} onClick={() => s.setSheet({ type: "ratio" })} />}
                </>
              )}
            </div>
            {improveRow}
            {tags}
            {autoline}
          </div>
          <div className="panel-foot">
            <Jobs runs={jobs} s={s} now={now} />
            {go}
            <p className="sm t3" style={{ textAlign: "center" }}>{t("Ctrl + Enter to generate")}</p>
          </div>
        </aside>
        <main className="canvas">{stageEl}</main>
        {file}
      </div>
    );
  }

  // Phone: the result across the full width, the prompt box and the button fixed at the bottom, by the thumb.
  return (
    <div className="create" style={keyboard ? { top: keyboard.top, height: keyboard.height, bottom: "auto" } : undefined}>
      {lion ? <Lion /> : null}
      <header className="top">
        <Brand />
        {mode}
        <Balance s={s} />
      </header>
      {stageEl}
      <div className="dock2" onPointerDown={() => { dockTap.current = Date.now(); }}>
        <Jobs runs={jobs} s={s} now={now} />
        <div className="composer mini2">
          {tags}
          {refcard}
          {/* the buttons keep to a line of their own at the top of the box, always in view; the text has the whole width under them */}
          <div className="pbar">
            {grow}
            {more && !s.prompt.trim() ? <button className="plus" aria-label={t("Ideas to start from")} onClick={() => s.setSheet({ type: "ideas" })}><Icon name="bulb" size={22} /></button> : null}
            {canPolish ? <button className="plus wandb on" aria-label={t("Improve this prompt now")} disabled={Boolean(s.improving)} onClick={() => s.improveNow()}>{s.improving === "std" ? <i className="spin" /> : <Icon name="wand" size={22} />}</button> : null}
            <button className="plus" aria-label={s.uploading ? t("Uploading") : video ? t("Add a start frame") : t("Add a reference image")} disabled={s.uploading} onClick={pickFile}>{s.uploading ? <i className="spin" /> : <Icon name="plus" size={22} />}</button>
          </div>
          {text}
          {short2 ? null : polishLine}
          {short2 ? null : autoline}
          <div className="gorow">
            <div className="chips">
              {s.ref && !video ? (
                <span className="sm t2 b" style={{ whiteSpace: "nowrap", padding: "0 4px" }}>{TOOLS.reference.detail}</span>
              ) : s.ref ? (
                <>
                  <button className="chip-tap" onClick={() => s.setSheet({ type: "models" })} aria-label={modelLabel}>
                    <span className="chip">{fromImg ? modelName : TOOLS.animate.detail}<Icon name="down" size={16} /></span>
                  </button>
                  {fromImg ? (
                    <button className="chip-tap" onClick={() => s.setSheet({ type: "video" })} aria-label={t("Length and quality. Change")}>
                      <span className="chip">{plan?.d} s, {resLabel(plan?.r)}</span>
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <button className="chip-tap" onClick={() => s.setSheet({ type: "models" })} aria-label={modelLabel}>
                    <span className="chip">{modelName}<Icon name="down" size={16} /></span>
                  </button>
                  {video ? (
                    <button className="chip-tap" onClick={() => s.setSheet({ type: "video" })} aria-label={t("Length, quality and shape. Change")}>
                      <span className="chip">{plan?.d} s, {resLabel(plan?.r)}, {plan?.ratio}</span>
                    </button>
                  ) : (
                    lockedRatio ? <span className="chip" style={{ background: "none", padding: "0 4px" }}><Icon name="ratio" size={16} />{lockedRatio}</span> : (
                      <button className="chip-tap" onClick={() => s.setSheet({ type: "ratio" })} aria-label={t("Shape: {ratio}. Change", { ratio: s.ratio })}>
                        <span className="chip"><Icon name="ratio" size={16} />{s.ratio}</span>
                      </button>
                    )
                  )}
                </>
              )}
            </div>
            <button className="go2" onClick={s.generate} disabled={!canGo || s.generating} aria-busy={s.generating || undefined} aria-label={cost ? tn(N("{name}, 1 credit"), N("{name}, {n} credits"), { name: action, n: cost }) : action}><span>{short}</span>{s.generating ? <i className="spin" style={{ width: 16, height: 16 }} /> : cost ? <Price n={cost} /> : null}</button>
          </div>
        </div>
      </div>
      {file}
    </div>
  );
}
