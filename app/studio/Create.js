"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FORMATS } from "../../lib/formats";
import Icon from "./icons";
import { Price, Picture, Poster, Brand, Balance, useNow } from "./bits";
import { imageModel, videoModel, videoPlan, TOOLS, comparePlan, stageOf } from "./models";
import { autoPick } from "./auto";
import { fitBox, fitGrid, ratioOf } from "./layout";
import { download } from "./download";

const IDEAS = {
  image: [
    "Paper-cut ocean waves at sunset, layered paper, soft shadows",
    "A cozy cabin in falling snow, warm light in the windows",
    "Product photo of a white sneaker on wet concrete, studio light",
  ],
  video: [
    "Aurora over a frozen lake, the lights ripple and reflect on the ice",
    "Hot air balloons drifting over a canyon at sunrise, slow camera move",
    "Waves rolling onto a black sand beach, low angle, mist in the air",
  ],
};

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

const CAPTION = 60; // height kept for the words under the result
const running = (r) => r.status === "running" || r.status === "late";
function timeText(run, now) {
  if (run.status === "late") return "Still rendering";
  const elapsed = (now - run.t0) / 1000;
  if (run.kind !== "video") return elapsed > run.eta * 1.5 ? "Longer than usual" : "A few seconds";
  const left = run.eta - elapsed;
  return left > 75 ? `About ${Math.round(left / 60)} min` : left > 20 ? "Under a minute" : "Almost there";
}

// Everything still being made, and anything that failed: one slim line each, above the prompt box.
function Jobs({ runs, s, now }) {
  if (!runs.length) return null;
  const shown = runs.slice(-3), more = runs.length - shown.length;
  return (
    <div className="jobs">
      {more > 0 ? <p className="sm t3" style={{ padding: "0 4px" }}>And {more} more in progress</p> : null}
      {shown.map((run) => {
        if (run.status === "failed") {
          return (
            <div key={run.key} className="job err" role="alert">
              <Icon name="alert" size={18} />
              <p className="job-t">{run.error}</p>
              {run.again ? <button className="job-b" onClick={() => s.retry(run)}>Try again</button> : null}
              <button className="job-x" aria-label="Dismiss" onClick={() => s.dropRun(run.key)}><Icon name="x" size={18} /></button>
            </div>
          );
        }
        const parts = run.parts || [];
        const pct = run.status === "late" ? 100 : Math.min(96, Math.max(4, ((now - run.t0) / 1000 / (run.eta || 25)) * 100));
        const sub = run.status === "late" ? "It will be in your Library when it's ready" : run.kind === "video" ? "You can close the site meanwhile" : run.kind === "compare" ? `${parts.filter((p) => p.status !== "running").length} of ${parts.length} ready` : run.prompt;
        return (
          <div key={run.key} className="job" role="status" aria-live="polite">
            {run.status === "late" ? <Icon name="timer" size={18} /> : <i className="spin" style={{ width: 16, height: 16 }} />}
            <p className="job-t"><span className="b clamp1">{run.label}</span>{sub ? <span className="t3 clamp1">{sub}</span> : null}</p>
            <span className="job-r">{run.kind === "compare" ? "" : timeText(run, now)}</span>
            {run.status === "late" ? <button className="job-x" aria-label="Dismiss" onClick={() => s.dropRun(run.key)}><Icon name="x" size={18} /></button> : <i className="job-bar" style={{ width: `${pct}%` }} />}
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

// The words under the result: what was asked, which model made it, and saving it.
function Caption({ run, item, right, width }) {
  const [saving, setSaving] = useState(false);
  const save = async () => { if (saving || !item) return; setSaving(true); await download(item); setSaving(false); };
  return (
    <div className="cap" style={width ? { maxWidth: Math.max(360, width) } : undefined}>
      <div className="grow" style={{ minWidth: 0 }}>
        {run.prompt ? <p className="cap-p">{run.prompt}</p> : null}
        <p className="sm t2 b clamp1">{run.label}{run.kind !== "video" && run.ratio ? `, ${run.ratio}` : ""}</p>
      </div>
      {right}
      {item ? <button className="ib f" aria-label="Download" onClick={save}>{saving ? <i className="spin" /> : <Icon name="download" />}</button> : null}
    </div>
  );
}

// The one large thing on the screen: the latest result, or the comparison that is being made now.
function Stage({ run, wait, s, now, video, onIdea, pad }) {
  const ref = useRef(null);
  const size = useSize(ref);
  const [real, setReal] = useState({}); // the true shape of a picture, once it has loaded
  const w = size.w, h = size.h - (run ? CAPTION : 0); // the room for the picture itself: the words under it need theirs
  const tiny = h < 90;

  let body = null, caption = null;
  if (run && run.kind === "compare") {
    const ar = ratioOf(run.ratio);
    const g = fitGrid(run.parts.length, ar, w - (pad ? 24 : 0), h);
    body = g && !tiny ? (
      <div className="cmp2" style={{ gridTemplateColumns: `repeat(${g.cols}, ${g.cw}px)` }}>
        {run.parts.map((p) => {
          const pct = Math.min(96, Math.max(4, ((now - p.t0) / 1000 / p.eta) * 100));
          const box = { width: g.cw, height: Math.floor(g.cw / ar) };
          return (
            <div key={p.id}>
              {p.status === "done" ? (
                <button className="tile" style={box} onClick={() => s.setViewer({ item: p.item })} aria-label={`Open the ${p.name} image`}>
                  <img className="fadein" src={p.item.url} alt={`${p.name}: ${run.prompt || ""}`} decoding="async" />
                </button>
              ) : p.status === "failed" ? (
                <div className="tile cmp-f" style={box}>
                  <p className="sm clamp3">{p.error}</p>
                  {run.again ? <button className="btn btn-s" style={{ height: 40 }} onClick={() => s.retryPart(run, p.id)}><Icon name="refresh" size={16} />Try again</button> : null}
                </div>
              ) : (
                <div className="tile" style={box} role="status" aria-live="polite" aria-label={`${p.name}: generating`}>
                  <div className="wait"><p className="b sm">Generating</p><div className="bar"><i style={{ width: `${pct}%` }} /></div></div>
                </div>
              )}
              <div className="cmp-l"><span className="clamp1">{p.name}</span>{p.unsaved ? <span className="sm t3">Not saved</span> : <Price n={p.cost} />}</div>
            </div>
          );
        })}
      </div>
    ) : null;
    caption = <Caption run={run} right={run.cost ? <Price n={run.cost} /> : null} width={!pad && g ? g.cols * g.cw + (g.cols - 1) * 8 : 0} />;
  } else if (run) {
    const item = run.item;
    const box = fitBox(real[item.url] || ratioOf(item.ratio || run.ratio), w, h);
    body = box && !tiny ? (
      <button className="shot2" style={{ width: box.w, height: box.h }} onClick={() => s.setViewer({ item })} aria-label={item.video ? "Open video" : "Open image"}>
        {item.video
          ? <><Poster item={item} version={s.posters[item.id]} /><span className="play"><Icon name="play" size={22} /></span></>
          : <img key={item.url} className="fadein" src={item.url} alt={run.prompt || ""} decoding="async"
              onLoad={(e) => { const t = e.currentTarget; if (t.naturalWidth && t.naturalHeight) setReal((p) => ({ ...p, [item.url]: t.naturalWidth / t.naturalHeight })); }}
              onError={() => { if (run.past) s.dropRun(run.key); }} />}
      </button>
    ) : null;
    caption = <Caption run={run} item={item} width={!pad && box ? box.w : 0} />;
  } else if (wait) {
    // Nothing made yet and the first one is on its way: hold its place.
    const box = fitBox(ratioOf(wait.ratio), Math.min(w, 560), h);
    body = box && !tiny ? <div className="shot2" style={{ width: box.w, height: box.h }}><div className="wait"><p className="b">{wait.kind === "video" ? "Your video will appear here" : "Your image will appear here"}</p></div></div> : null;
  } else {
    body = tiny ? null : (
      <div className="empty">
        <h1 className="d h1">{video ? "What should the video show?" : "What do you want to make?"}</h1>
        <p className="t2" style={{ marginBottom: 6 }}>Write it in your own words, or start from one of these.</p>
        {IDEAS[video ? "video" : "image"].map((t) => (
          <button key={t} className="idea" onClick={() => onIdea(t)}><span className="grow">{t}</span><Icon name="right" style={{ color: "var(--text-3)" }} /></button>
        ))}
      </div>
    );
  }
  return (
    <section className="stage2" aria-label="Latest result" ref={ref}>
      <div className={`stage2-fit${!run && !wait ? " scroll" : ""}`}>{body}</div>
      {caption && !tiny ? caption : null}
      {run?.unsaved && !tiny ? <p className="note pad"><Icon name="alert" size={16} />This image couldn't be saved to your Library. Download it now to keep it.</p> : null}
    </section>
  );
}

export default function Create({ s }) {
  const video = s.mode === "video";
  const wide = useWide();
  const keyboard = useKeyboard();
  const fileRef = useRef(null), textRef = useRef(null);
  const now = useNow(s.runs.some(running));

  // The prompt box grows with the text: up to six lines on a phone, more room on a wide screen.
  useLayoutEffect(() => { const el = textRef.current; if (!el) return; const [lo, hi] = wide ? [132, 280] : [44, 132]; el.style.height = "auto"; el.style.height = `${Math.min(hi, Math.max(lo, el.scrollHeight))}px`; }, [s.prompt, wide]);

  const stage = stageOf(s.runs);
  const jobs = s.runs.filter((r) => r !== stage && r.status !== "done");
  const wait = stage ? null : [...s.runs].reverse().find(running) || null;

  const vm = videoModel(s.vidModel);
  const plan = video ? videoPlan(vm.id, s.vDur, s.vRes, s.ratio) : null;
  const cmp = !video && !s.ref ? comparePlan(s.compare) : null; // two or more models chosen: compare them
  // Auto: the model follows the prompt, and the button shows it with its price before anything is charged.
  const auto = !video && !s.ref && !cmp && s.auto ? autoPick(`${s.prompt} ${s.format !== "free" ? FORMATS[s.format]?.label || "" : ""}`, s.wallet, s.off) : null;
  const im = imageModel(auto ? auto.id : s.imgModel);
  const cost = s.ref ? (video ? TOOLS.animate.cost : TOOLS.reference.cost) : video ? plan?.cost : cmp ? cmp.cost : im.cost;
  const action = s.ref ? (video ? "Animate image" : "Generate from image") : video ? "Generate video" : cmp ? `Compare ${cmp.models.length} models` : "Generate";
  const placeholder = s.ref ? (video ? "Describe the motion (optional)" : "Describe the new image") : video ? "Describe the video you want" : "Describe the image you want";
  const lockedRatio = !video && s.format !== "free" ? FORMATS[s.format]?.ratio : null; // a format fixes the shape
  const canGo = Boolean(s.prompt.trim()) || (video && s.ref);
  const project = s.projectsOn ? s.projects.find((p) => p.id === s.project) : null; // new creations are saved into it
  const modelName = cmp ? `${cmp.models.length} models` : auto ? "Auto" : video ? vm.name : im.name;
  const modelLabel = cmp ? `Comparing ${cmp.models.length} models. Change` : auto ? "Model: Auto. Change" : `Model: ${video ? vm.name : im.name}. Change`;
  const pickFile = () => { if (!s.needAccount({ tab: "create" })) fileRef.current?.click(); };

  const mode = (
    <div className="seg" role="tablist" aria-label="What to make">
      <button role="tab" aria-selected={!video} className={video ? "" : "on"} onClick={() => s.setMode("image")}><Icon name="image" size={18} />Image</button>
      <button role="tab" aria-selected={video} className={video ? "on" : ""} onClick={() => s.setMode("video")}><Icon name="video" size={18} />Video</button>
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
        <p className="b sm">{video ? "Start frame" : "Reference image"}</p>
        <p className="sm t3 clamp1">{video ? "The video begins from this image" : "The new image follows its look"}</p>
      </div>
      <button className="ib" aria-label="Remove the image" onClick={() => s.setRef(null)}><Icon name="x" /></button>
    </div>
  ) : null;
  const tags = (
    <>
      {s.format !== "free" && FORMATS[s.format] && !video ? (
        <div className="r" style={{ gap: 4 }}>
          <span className="chip grow clamp1" style={{ flex: "0 1 auto" }}>Format: {FORMATS[s.format].label}</span>
          <button className="ib" aria-label="Remove the format" onClick={() => s.setFormat("free")}><Icon name="x" size={18} /></button>
        </div>
      ) : null}
      {project ? (
        <div className="r" style={{ gap: 4 }}>
          <span className="chip grow clamp1" style={{ flex: "0 1 auto" }}><Icon name="folder" size={16} />Saving to: {project.name}</span>
          <button className="ib" aria-label="Stop saving into this project" onClick={() => s.setProject(null)}><Icon name="x" size={18} /></button>
        </div>
      ) : null}
    </>
  );
  const autoline = auto && s.prompt.trim() ? <p className="sm t2 autoline" role="status"><span className="b" style={{ color: "var(--text)" }}>{im.name}.</span> {auto.why}.{auto.fitted ? " Fits your balance." : ""}</p> : null;
  const go = (
    <button className="btn btn-p btn-wide btn-split" onClick={s.generate} disabled={!canGo}>
      <span>{action}</span>{cost ? <Price n={cost} /> : null}
    </button>
  );
  const file = <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) s.upload(f); }} />;
  const stageEl = <Stage run={stage} wait={wait} s={s} now={now} video={video} pad={!wide} onIdea={(t) => { s.setPrompt(t); textRef.current?.focus(); }} />;

  if (wide) {
    // Desktop: settings in a column on the left, the result large in the rest of the window.
    return (
      <div className="create wide">
        <aside className="panel" aria-label="What to make">
          <div className="panel-top"><Brand wordmark /></div>
          <div className="panel-body">
            {mode}
            <div className="field2">{text}</div>
            {s.ref ? <div className="set">{refcard}</div> : (
              <button className="set-add" disabled={s.uploading} onClick={pickFile}>{s.uploading ? <i className="spin" style={{ width: 16, height: 16 }} /> : <Icon name="plus" size={18} />}{s.uploading ? "Uploading" : video ? "Add a start frame" : "Add a reference image"}</button>
            )}
            <div className="set">
              {s.ref ? <div className="set-row"><span className="t2">Model</span><span className="b clamp1">{video ? TOOLS.animate.detail : TOOLS.reference.detail}</span></div> : (
                <>
                  <Row name="Model" value={modelName} label={modelLabel} onClick={() => s.setSheet({ type: "models" })} />
                  {video ? <Row name="Length, quality, shape" value={`${plan?.d} s, ${plan?.r}, ${plan?.ratio}`} label="Length, quality and shape. Change" onClick={() => s.setSheet({ type: "video" })} />
                    : lockedRatio ? <div className="set-row"><span className="t2">Shape</span><span className="b">{lockedRatio}</span></div>
                    : <Row name="Shape" value={s.ratio} label={`Shape: ${s.ratio}. Change`} onClick={() => s.setSheet({ type: "ratio" })} />}
                </>
              )}
            </div>
            {tags}
            {autoline}
          </div>
          <div className="panel-foot">
            <Jobs runs={jobs} s={s} now={now} />
            {go}
            <p className="sm t3" style={{ textAlign: "center" }}>Ctrl + Enter to generate</p>
          </div>
        </aside>
        <main className="canvas">
          <header className="canvas-top"><Balance s={s} /></header>
          {stageEl}
        </main>
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
        <div className="composer">
          {tags}
          {refcard}
          {text}
          <div className="chips">
            <button className="chip-tap" aria-label={s.uploading ? "Uploading" : video ? "Add a start frame" : "Add a reference image"} disabled={s.uploading} onClick={pickFile}>
              <span className="chip">{s.uploading ? <i className="spin" style={{ width: 16, height: 16 }} /> : <Icon name="plus" size={18} />}</span>
            </button>
            {s.ref ? (
              <span className="sm t2 b" style={{ whiteSpace: "nowrap", padding: "0 4px" }}>{video ? TOOLS.animate.detail : TOOLS.reference.detail}</span>
            ) : (
              <>
                <button className="chip-tap" onClick={() => s.setSheet({ type: "models" })} aria-label={modelLabel}>
                  <span className="chip">{modelName}<Icon name="down" size={16} /></span>
                </button>
                {video ? (
                  <button className="chip-tap" onClick={() => s.setSheet({ type: "video" })} aria-label="Length, quality and shape. Change">
                    <span className="chip"><Icon name="timer" size={16} />{plan?.d} s</span>
                    <span className="chip" style={{ marginLeft: 6 }}><Icon name="monitor" size={16} />{plan?.r}</span>
                    <span className="chip" style={{ marginLeft: 6 }}><Icon name="ratio" size={16} />{plan?.ratio}</span>
                  </button>
                ) : (
                  lockedRatio ? <span className="chip" style={{ background: "none", padding: "0 4px" }}><Icon name="ratio" size={16} />{lockedRatio}</span> : (
                    <button className="chip-tap" onClick={() => s.setSheet({ type: "ratio" })} aria-label={`Shape: ${s.ratio}. Change`}>
                      <span className="chip"><Icon name="ratio" size={16} />{s.ratio}</span>
                    </button>
                  )
                )}
              </>
            )}
          </div>
          {autoline}
          {go}
        </div>
      </div>
      {file}
    </div>
  );
}
