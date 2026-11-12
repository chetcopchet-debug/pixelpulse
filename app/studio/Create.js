"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FORMATS } from "../../lib/formats";
import { thumbUrl, posterUrl } from "../../lib/thumbs";
import Icon from "./icons";
import { Price, Picture, Poster, Brand, Balance, useNow } from "./bits";
import { imageModel, videoModel, videoPlan, TOOLS, comparePlan, stageOf, stageTime } from "./models";
import { nextActions } from "./next";
import { autoPick } from "./auto";
import { fitBox, fitGrid, ratioOf } from "./layout";
import { download } from "./download";

// Starting points for someone who has not made anything yet. The card shows a short title; a tap fills the
// prompt box with the full text. The pictures are in public/ideas.
const IDEAS = {
  image: [
    { img: "aurora", title: "Aurora over a frozen lake", prompt: "Aurora over a frozen lake at night, mountains reflected in the ice, flat vector illustration in teal and navy" },
    { img: "cabin", title: "A cozy cabin in falling snow", prompt: "A cozy cabin in falling snow, warm light in the windows, pine trees, full moon, flat illustration" },
    { img: "sneaker", title: "Product photo of a sneaker", prompt: "Product photo of a white sneaker with iridescent panels on a wooden table, shallow depth of field, soft daylight" },
    { img: "lighthouse", title: "A lighthouse in a storm", prompt: "A lighthouse in a storm at night, its beam cutting across dark waves, flat illustration, muted teal" },
    { img: "neon", title: "Neon beach at night", prompt: "A lone figure on a beach at night, glowing pink sun on the horizon, neon reflections in the wet sand, synthwave" },
    { img: "balloons", title: "Hot air balloons over a canyon", prompt: "Hot air balloons drifting over a red rock canyon at sunrise, layered paper-cut illustration, warm colors" },
  ],
  video: [
    { img: "aurora", title: "Aurora over a frozen lake", prompt: "Aurora over a frozen lake at night, the lights ripple slowly and reflect on the ice" },
    { img: "balloons", title: "Balloons drifting over a canyon", prompt: "Hot air balloons drifting over a canyon at sunrise, slow camera move to the right" },
    { img: "lighthouse", title: "A lighthouse in a storm", prompt: "Waves crashing around a lighthouse in a storm, the beam of light sweeps across the sea" },
    { img: "cabin", title: "Snow falling on a cabin", prompt: "Snow falling on a cabin at night, smoke rising from the chimney, warm light in the windows" },
    { img: "neon", title: "Neon beach at night", prompt: "A lone figure walks along a neon-lit beach at night, gentle waves, slow push in" },
    { img: "sneaker", title: "A sneaker turning on a table", prompt: "A white sneaker slowly rotating on a wooden table, shallow depth of field, soft daylight" },
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

const busyRun = (r) => r.status === "running" || r.status === "late";
const elapsed = (run, now) => (now - run.t0) / 1000;
const percent = (run, now) => Math.round(Math.min(96, Math.max(4, (elapsed(run, now) / (run.eta || 25)) * 100)));
// An estimate, said as one: how long is left.
function leftText(run, now) {
  if (run.status === "late") return "Still rendering";
  const left = (run.eta || 25) - elapsed(run, now);
  if (left > 90) return `About ${Math.round(left / 60)} minutes left`;
  if (left > 1) return `About ${Math.ceil(left)} seconds left`;
  return elapsed(run, now) > (run.eta || 25) * 1.5 ? "Taking longer than usual" : "Almost there";
}

// Other things still being made, and anything that failed: one slim line each, above the prompt box.
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
        const sub = run.status === "late" ? "It will be in your Library when it's ready" : run.kind === "video" ? "You can close the site meanwhile" : run.kind === "compare" ? `${parts.filter((p) => p.status !== "running").length} of ${parts.length} ready` : run.prompt;
        return (
          <div key={run.key} className="job" role="status" aria-live="polite">
            {run.status === "late" ? <Icon name="timer" size={18} /> : <i className="spin" style={{ width: 16, height: 16 }} />}
            <p className="job-t"><span className="b clamp1">{run.label}</span>{sub ? <span className="t3 clamp1">{sub}</span> : null}</p>
            <span className="job-r">{run.kind === "compare" || run.status === "late" ? "" : leftText(run, now).replace(/ left$/, "")}</span>
            {run.status === "late" ? <button className="job-x" aria-label="Dismiss" onClick={() => s.dropRun(run.key)}><Icon name="x" size={18} /></button> : <i className="job-bar" style={{ width: `${percent(run, now)}%` }} />}
          </div>
        );
      })}
    </div>
  );
}

// A circle that fills as the estimated time passes.
function Ring({ pct }) {
  const r = 50, c = 2 * Math.PI * r;
  return (
    <div className="ring" aria-hidden="true">
      <svg viewBox="0 0 112 112"><circle cx="56" cy="56" r={r} /><circle cx="56" cy="56" r={r} className="on" strokeDasharray={`${(c * pct) / 100} ${c}`} /></svg>
      <b className="d">{pct}%</b>
    </div>
  );
}
// What happens to a request, in order. The middle step is the one in progress for as long as the page waits.
function Steps({ video, list }) {
  const items = [["Sent", "done"], [video ? "Rendering" : "Generating", "now"], ["Saving", ""]];
  if (list) {
    return items.map(([t, st], i) => (
      <div key={t} className={`act2 st ${st}`}><span className="sq"><Icon name={i === 0 ? "check" : i === 1 ? (video ? "video" : "image") : "library"} /></span><span className="grow b">{i === 2 ? "Saving to your Library" : t}</span></div>
    ));
  }
  return <div className="steps2">{items.map(([t, st]) => <span key={t} className={`step ${st}`}>{st === "done" ? <Icon name="check" size={14} /> : null}{t}</span>)}</div>;
}

// One setting in the desktop column: its name, its value, and a tap to change it.
function Row({ name, value, onClick, label }) {
  return <button className="set-row" onClick={onClick} aria-label={label}><span className="t2">{name}</span><span className="b clamp1">{value}</span><Icon name="right" size={18} style={{ color: "var(--text-3)" }} /></button>;
}

// The viewing window: which model and shape on top, the picture in the middle, the words that made it below.
function Window({ run, right, body, foot, fill }) {
  return (
    <div className={`vw${fill ? " fill" : ""}`}>
      <div className="vw-h">
        <span className="vtag clamp1">{run.label}</span>
        {run.kind !== "video" && run.ratio ? <span className="vtag">{run.ratio}</span> : null}
        <span className="grow" />
        {right}
      </div>
      <div className="vw-b">{body}</div>
      <div className="vw-f">{foot}</div>
    </div>
  );
}

// Everything between the top bar and the prompt box: the window with the latest result (or with what is being
// made right now), the "What next" actions, or, before anything was made, pictures to start from.
function Stage({ run, wait, back, s, now, video, wide, onIdea }) {
  const ref = useRef(null);
  const size = useSize(ref);
  const [real, setReal] = useState({}); // the true shape of a picture, once it has loaded
  const [saving, setSaving] = useState(false);
  const item = !wait && run && run.kind !== "compare" ? run.item : null;
  const canAct = Boolean(item && !item.video && item.id);
  const acts = canAct ? nextActions(s, item) : [];

  // Room for the picture itself, after the window's own top and bottom rows and what sits under the window.
  const FRAME = wide ? 40 + 28 + 44 + 10 + 10 + 48 : 2 + 20 + 44 + 10 + 10 + 44;
  let under = wide ? 0 : wait ? 88 : canAct ? 128 : 0;
  const w = size.w - (wide ? 40 + 28 : 24 + 20);
  let h = size.h - FRAME - under;
  if (!wide && canAct && h < 200) { h += under; under = 0; } // a short screen: the picture comes first
  const tiny = h < 80;

  const save = async () => { if (saving || !item) return; setSaving(true); await download(item); setSaving(false); };
  const copy = async (text) => { try { await navigator.clipboard.writeText(text || ""); s.say("Prompt copied"); } catch { s.say("Couldn't copy. Select the text instead."); } };

  // The glow behind the window: the picture itself, blurred until only its colors are left.
  const glowOf = (r) => { const it = r?.kind === "compare" ? r.parts.find((p) => p.item)?.item : r?.item; return it ? (it.video ? posterUrl(it.url) : thumbUrl(it.url)) : null; };
  const glow = wait ? glowOf(back) : run ? glowOf(run) : `/ideas/${IDEAS[video ? "video" : "image"][0].img}.webp`;

  let main = null, side = null;
  if (wait) {
    const box = fitBox(ratioOf(wait.ratio), w, h);
    const vid = wait.kind === "video";
    main = box && !tiny ? (
      <>
        <Window run={wait} fill={wide} right={<span className="sm b t2" style={{ padding: "0 8px" }}>{vid ? "Rendering" : "Generating"}</span>}
          body={<div className="skel2" style={{ width: box.w, height: box.h }} role="status" aria-live="polite" aria-label={`${wait.label}: ${leftText(wait, now)}`}>
            {wait.poster ? <Picture src={wait.poster} eager /> : null}
            <div className="skel2-in">{box.h >= 170 ? <Ring pct={percent(wait, now)} /> : <b className="d" style={{ fontSize: 26 }}>{percent(wait, now)}%</b>}<p className="b">{leftText(wait, now)}</p></div>
          </div>}
          foot={<p className="grow clamp1 t2">{wait.prompt || (vid ? "Animating your image" : "")}</p>} />
        {!wide && under ? <div className="next2"><h3>{vid ? "You can close the site. It saves to your Library." : "You can keep writing. It saves to your Library."}</h3><Steps video={vid} /></div> : null}
      </>
    ) : null;
    side = (
      <aside className="rightcol">
        <h3>In progress</h3>
        <Steps video={vid} list />
        <p className="sm t3" style={{ margin: "8px 4px" }}>{vid && wait.cost && !s.wallet.admin ? `${wait.cost} credits are held and come back if the video fails. ` : ""}You can close the site. It is saved to your Library when it is ready.</p>
      </aside>
    );
  } else if (run && run.kind === "compare") {
    const ar = ratioOf(run.ratio);
    const g = fitGrid(run.parts.length, ar, w, h);
    main = g && !tiny ? (
      <Window run={run} fill={wide} right={run.cost ? <span style={{ padding: "0 8px" }}><Price n={run.cost} /></span> : null}
        body={<div className="cmp2" style={{ gridTemplateColumns: `repeat(${g.cols}, ${g.cw}px)` }}>
          {run.parts.map((p) => {
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
                    <div className="wait"><p className="b sm">{percent(p, now)}%</p><div className="bar"><i style={{ width: `${percent(p, now)}%` }} /></div></div>
                  </div>
                )}
                <div className="cmp-l"><span className="clamp1">{p.name}</span>{p.unsaved ? <span className="sm t3">Not saved</span> : <Price n={p.cost} />}</div>
              </div>
            );
          })}
        </div>}
        foot={<><p className="grow clamp1">{run.prompt}</p><button className="ib" aria-label="Copy the prompt" onClick={() => copy(run.prompt)}><Icon name="copy" size={18} /></button></>} />
    ) : null;
  } else if (run) {
    const box = fitBox(real[item.url] || ratioOf(item.ratio || run.ratio), w, h);
    const fav = item.id && s.favs.has(item.id);
    main = box && !tiny ? (
      <>
        <Window run={run} fill={wide}
          right={<>
            {item.id ? <button className={`ib${fav ? " on" : ""}`} aria-label={fav ? "Remove from favorites" : "Add to favorites"} aria-pressed={Boolean(fav)} onClick={() => s.toggleFav(item)}><Icon name="heart" style={fav ? { fill: "currentColor" } : undefined} /></button> : null}
            <button className="ib" aria-label="Download" onClick={save}>{saving ? <i className="spin" /> : <Icon name="download" />}</button>
          </>}
          body={<button className="shot2" style={{ width: box.w, height: box.h }} onClick={() => s.setViewer({ item })} aria-label={item.video ? "Open video" : "Open image"}>
            {item.video
              ? <><Poster item={item} version={s.posters[item.id]} /><span className="play"><Icon name="play" size={22} /></span></>
              : <img key={item.url} className="fadein" src={item.url} alt={run.prompt || ""} decoding="async"
                  onLoad={(e) => { const t = e.currentTarget; if (t.naturalWidth && t.naturalHeight) setReal((p) => ({ ...p, [item.url]: t.naturalWidth / t.naturalHeight })); }}
                  onError={() => { if (run.past) s.dropRun(run.key); }} />}
          </button>}
          foot={run.unsaved
            ? <p className="grow sm"><Icon name="alert" size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Not saved to your Library. Download it now to keep it.</p>
            : <><p className="grow clamp1">{run.prompt || (item.video ? "Video" : "Image")}</p>{run.prompt ? <button className="ib" aria-label="Copy the prompt" onClick={() => copy(run.prompt)}><Icon name="copy" size={18} /></button> : null}</>} />
        {!wide && under ? (
          <div className="next2">
            <h3>What next</h3>
            <div className="ncards">
              {acts.map((a) => (
                <button key={a.key} className="ncard" onClick={a.run} disabled={Boolean(s.busyTool)}>
                  <span className="r" style={{ justifyContent: "space-between" }}>{s.busyTool === a.key ? <i className="spin" /> : <Icon name={a.icon} />}<Price n={a.cost} /></span>
                  <span>{s.busyTool === a.key ? "Working" : a.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </>
    ) : null;
    side = canAct ? (
      <aside className="rightcol">
        <h3>What next</h3>
        {acts.map((a) => (
          <button key={a.key} className="act2" onClick={a.run} disabled={Boolean(s.busyTool)}>
            <span className="sq">{s.busyTool === a.key ? <i className="spin" /> : <Icon name={a.icon} />}</span>
            <span className="grow"><span className="b">{s.busyTool === a.key ? "Working" : a.label}</span><span className="sm t3">{a.hint}</span></span>
            <Price n={a.cost} />
          </button>
        ))}
      </aside>
    ) : null;
  } else {
    const list = IDEAS[video ? "video" : "image"];
    main = size.h < 150 ? null : (
      <div className="start">
        <div className="start-h">
          <h1 className="d">{video ? "What should the video show?" : "What do you want to make?"}</h1>
          <p className="t2">Write it {wide ? "on the left" : "below"}, or start from one of these.</p>
        </div>
        <div className="ideas">
          {list.map((x) => (
            <button key={x.img} className="idea2" onClick={() => onIdea(x.prompt)} aria-label={`Use this idea: ${x.title}`}>
              <img src={`/ideas/${x.img}.webp`} alt="" loading="lazy" decoding="async" />
              <span>{x.title}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <>
      {glow ? <div className={`amb${wait ? " dim" : ""}`} style={{ backgroundImage: `url("${glow}")` }} aria-hidden="true" /> : null}
      <section className={`stage2${!run && !wait ? " scroll" : ""}`} aria-label="Latest result" ref={ref}>{main}</section>
      {wide ? side : null}
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
  const short = s.ref ? (video ? "Animate" : "Generate") : cmp ? `Compare ${cmp.models.length}` : "Generate";
  const stageEl = <Stage run={wait ? null : stage} wait={wait} back={stage} s={s} now={now} video={video} wide={wide} onIdea={(t) => { s.setPrompt(t); textRef.current?.focus(); }} />;

  if (wide) {
    // Desktop: settings in a column on the left, the result large in the rest of the window.
    return (
      <div className="create wide">
        <aside className="panel" aria-label="What to make">
          <div className="panel-top"><Brand wordmark /><Balance s={s} /></div>
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
            <button className="plus" aria-label={s.uploading ? "Uploading" : video ? "Add a start frame" : "Add a reference image"} disabled={s.uploading} onClick={pickFile}>{s.uploading ? <i className="spin" /> : <Icon name="plus" size={22} />}</button>
          </div>
          {autoline}
          <div className="r" style={{ gap: 6 }}>
            <div className="chips grow">
              {s.ref ? (
                <span className="sm t2 b" style={{ whiteSpace: "nowrap", padding: "0 4px" }}>{video ? TOOLS.animate.detail : TOOLS.reference.detail}</span>
              ) : (
                <>
                  <button className="chip-tap" onClick={() => s.setSheet({ type: "models" })} aria-label={modelLabel}>
                    <span className="chip">{modelName}<Icon name="down" size={16} /></span>
                  </button>
                  {video ? (
                    <button className="chip-tap" onClick={() => s.setSheet({ type: "video" })} aria-label="Length, quality and shape. Change">
                      <span className="chip">{plan?.d} s, {plan?.r}, {plan?.ratio}</span>
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
            <button className="go2" onClick={s.generate} disabled={!canGo} aria-label={`${action}${cost ? `, ${cost} credits` : ""}`}><span>{short}</span>{cost ? <Price n={cost} /> : null}</button>
          </div>
        </div>
      </div>
      {file}
    </div>
  );
}
