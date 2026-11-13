"use client";
import { t, tn, N } from "../i18n/index.js";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FORMATS } from "../../lib/formats";
import { thumbUrl, posterUrl } from "../../lib/thumbs";
import Icon from "./icons";
import { Price, Picture, Full, Poster, Brand, Balance, useNow } from "./bits";
import { imageModel, videoModel, videoPlan, TOOLS, comparePlan, stageOf, stageTime } from "./models";
import { nextActions } from "./next";
import { ideaCards } from "./ideas";
import { autoPick } from "./auto";
import { fitGrid, ratioOf } from "./layout";
import { download } from "./download";

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
const percent = (run, now) => Math.round(Math.min(96, Math.max(4, (elapsed(run, now) / (run.eta || 25)) * 100)));
// An estimate, said as one: how long is left.
function leftText(run, now) {
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
          return (
            <div key={run.key} className="job err" role="alert">
              <Icon name="alert" size={18} />
              <p className="job-t">{run.error}</p>
              {run.again ? <button className="job-b" onClick={() => s.retry(run)}>{t("Try again")}</button> : null}
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
  const text = last ? t("Finishing touches…") : t(list[i % list.length]);
  return (
    <div className="words" aria-hidden="true">
      <p key={text} className={last ? "stay" : undefined}>{text}<span className="num">{pct}%</span></p>
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
function Stage({ run, wait, s, now, video, wide, onIdea }) {
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
  const glow = wait ? null : run ? glowOf(run) : cards[0].src;
  const fav = item?.id && s.favs.has(item.id);
  const cap = (
    <>
      <p className="grow clamp1">{run?.unsaved && !wait ? t("Not saved to your Library. Download it now to keep it.") : show?.prompt || ""}</p>
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
      <section className={`stage2${show ? "" : " scroll"}`} aria-label={t("Latest result")} ref={ref}>{main}</section>
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
  useLayoutEffect(() => { const el = textRef.current; if (!el) return; const [lo, hi] = wide ? [132, 280] : [24, 110]; el.style.height = "auto"; el.style.height = `${Math.min(hi, Math.max(lo, el.scrollHeight))}px`; }, [s.prompt, wide]);

  // The window shows the newest thing: an image or video being made right now, or else the latest result.
  // (A comparison is its own result from the moment it starts.) Everything else in progress, and anything that
  // failed, is a slim line above the prompt box.
  const stage = stageOf(s.runs);
  const making = [...s.runs].reverse().find((r) => r.kind !== "compare" && r.status === "running") || null;
  const wait = making && (!stage || making.t0 >= stageTime(stage)) ? making : null;
  const jobs = s.runs.filter((r) => r !== stage && r !== wait && r.status !== "done");

  const vm = videoModel(s.vidModel);
  const plan = video ? videoPlan(vm.id, s.vDur, s.vRes, s.ratio) : null;
  const cmp = !video && !s.ref ? comparePlan(s.compare) : null; // two or more models chosen: compare them
  // Auto: the model follows the prompt, and the button shows it with its price before anything is charged.
  const auto = !video && !s.ref && !cmp && s.auto ? autoPick(`${s.prompt} ${s.format !== "free" ? FORMATS[s.format]?.label || "" : ""}`, s.wallet, s.off) : null;
  const im = imageModel(auto ? auto.id : s.imgModel);
  const cost = s.ref ? (video ? TOOLS.animate.cost : TOOLS.reference.cost) : video ? plan?.cost : cmp ? cmp.cost : im.cost;
  const action = s.ref ? (video ? t("Animate image") : t("Generate from image")) : video ? t("Generate video") : cmp ? t("Compare {n} models", { n: cmp.models.length }) : t("Generate");
  const placeholder = s.ref ? (video ? t("Describe the motion (optional)") : t("Describe the new image")) : video ? t("Describe the video you want") : t("Describe the image you want");
  const lockedRatio = !video && s.format !== "free" ? FORMATS[s.format]?.ratio : null; // a format fixes the shape
  const canGo = Boolean(s.prompt.trim()) || (video && s.ref);
  const project = s.projectsOn ? s.projects.find((p) => p.id === s.project) : null; // new creations are saved into it
  const modelName = cmp ? t("{n} models", { n: cmp.models.length }) : auto ? t("Auto") : video ? vm.name : im.name;
  const modelLabel = cmp ? t("Comparing {n} models. Change", { n: cmp.models.length }) : t("Model: {name}. Change", { name: auto ? t("Auto") : video ? vm.name : im.name });
  const pickFile = () => { if (!s.needAccount({ tab: "create" })) fileRef.current?.click(); };

  const mode = (
    <div className="seg" role="tablist" aria-label={t("What to make")}>
      <button role="tab" aria-selected={!video} className={video ? "" : "on"} onClick={() => s.setMode("image")}><Icon name="image" size={18} />{t("Image")}</button>
      <button role="tab" aria-selected={video} className={video ? "on" : ""} onClick={() => s.setMode("video")}><Icon name="video" size={18} />{t("Video")}</button>
    </div>
  );
  const text = (
    <textarea ref={textRef} className="prompt" rows={1} maxLength={1500} value={s.prompt} placeholder={placeholder} aria-label={placeholder}
      onChange={(e) => s.setPrompt(e.target.value)}
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
  const autoline = auto && s.prompt.trim() ? <p className="sm t2 autoline" role="status"><span className="b" style={{ color: "var(--text)" }}>{im.name}.</span> {t(auto.why)}.{auto.fitted ? t(" Fits your balance.") : ""}</p> : null;
  const go = (
    <button className="btn btn-p btn-wide btn-split" onClick={s.generate} disabled={!canGo}>
      <span>{action}</span>{cost ? <Price n={cost} /> : null}
    </button>
  );
  const file = <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) s.upload(f); }} />;
  const more = Boolean(stage || wait); // the start screen already shows the ideas; later they are one tap away
  const short = s.ref ? (video ? t("Animate") : t("Generate")) : cmp ? t("Compare {n}", { n: cmp.models.length }) : t("Generate");
  const stageEl = <Stage run={wait ? null : stage} wait={wait} s={s} now={now} video={video} wide={wide} onIdea={(t) => { s.setPrompt(t); textRef.current?.focus(); }} />;

  if (wide) {
    // Desktop: settings in a column on the left, the result large in the rest of the window.
    return (
      <div className="create wide">
        <aside className="panel" aria-label={t("What to make")}>
          <div className="panel-top"><Brand wordmark /><Balance s={s} /></div>
          <div className="panel-body">
            {mode}
            <div className="field2">{text}</div>
            {s.ref ? <div className="set">{refcard}</div> : (
              <button className="set-add" disabled={s.uploading} onClick={pickFile}>{s.uploading ? <i className="spin" style={{ width: 16, height: 16 }} /> : <Icon name="plus" size={18} />}{s.uploading ? t("Uploading") : video ? t("Add a start frame") : t("Add a reference image")}</button>
            )}
            {more ? <button className="set-add" onClick={() => s.setSheet({ type: "ideas" })}><Icon name="bulb" size={18} />{t("Ideas to start from")}</button> : null}
            <div className="set">
              {s.ref ? <div className="set-row"><span className="t2">{t("Model")}</span><span className="b clamp1">{video ? TOOLS.animate.detail : TOOLS.reference.detail}</span></div> : (
                <>
                  <Row name={t("Model")} value={modelName} label={modelLabel} onClick={() => s.setSheet({ type: "models" })} />
                  {video ? <Row name={t("Length, quality, shape")} value={`${plan?.d} s, ${plan?.r}, ${plan?.ratio}`} label={t("Length, quality and shape. Change")} onClick={() => s.setSheet({ type: "video" })} />
                    : lockedRatio ? <div className="set-row"><span className="t2">{t("Shape")}</span><span className="b">{lockedRatio}</span></div>
                    : <Row name={t("Shape")} value={s.ratio} label={t("Shape: {ratio}. Change", { ratio: s.ratio })} onClick={() => s.setSheet({ type: "ratio" })} />}
                </>
              )}
            </div>
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
      <header className="top">
        <Brand />
        {mode}
        <Balance s={s} />
      </header>
      {stageEl}
      <div className="dock2">
        <Jobs runs={jobs} s={s} now={now} />
        <div className="composer mini2">
          {tags}
          {refcard}
          <div className="r" style={{ gap: 4, alignItems: "flex-start" }}>
            {text}
            {more && !s.prompt.trim() ? <button className="plus" aria-label={t("Ideas to start from")} onClick={() => s.setSheet({ type: "ideas" })}><Icon name="bulb" size={22} /></button> : null}
            <button className="plus" aria-label={s.uploading ? t("Uploading") : video ? t("Add a start frame") : t("Add a reference image")} disabled={s.uploading} onClick={pickFile}>{s.uploading ? <i className="spin" /> : <Icon name="plus" size={22} />}</button>
          </div>
          {autoline}
          <div className="gorow">
            <div className="chips">
              {s.ref ? (
                <span className="sm t2 b" style={{ whiteSpace: "nowrap", padding: "0 4px" }}>{video ? TOOLS.animate.detail : TOOLS.reference.detail}</span>
              ) : (
                <>
                  <button className="chip-tap" onClick={() => s.setSheet({ type: "models" })} aria-label={modelLabel}>
                    <span className="chip">{modelName}<Icon name="down" size={16} /></span>
                  </button>
                  {video ? (
                    <button className="chip-tap" onClick={() => s.setSheet({ type: "video" })} aria-label={t("Length, quality and shape. Change")}>
                      <span className="chip">{plan?.d} s, {plan?.r}, {plan?.ratio}</span>
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
            <button className="go2" onClick={s.generate} disabled={!canGo} aria-label={cost ? tn(N("{name}, 1 credit"), N("{name}, {n} credits"), { name: action, n: cost }) : action}><span>{short}</span>{cost ? <Price n={cost} /> : null}</button>
          </div>
        </div>
      </div>
      {file}
    </div>
  );
}
