"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FORMATS } from "../../lib/formats";
import Icon from "./icons";
import { Price, Picture, Poster, Brand, Balance, useNow } from "./bits";
import { imageModel, videoModel, videoPlan, TOOLS, comparePlan } from "./models";

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

function waitText(run, now) {
  const elapsed = (now - run.t0) / 1000;
  if (run.kind === "image") return { head: "Generating", sub: elapsed > run.eta * 1.5 ? "Taking a little longer than usual" : "A few seconds" };
  const left = run.eta - elapsed;
  if (left > 75) return { head: "Rendering", sub: `About ${Math.round(left / 60)} min left` };
  if (left > 20) return { head: "Rendering", sub: "Less than a minute left" };
  return { head: "Rendering", sub: "Almost there" };
}

function Run({ run, s, now }) {
  const ar = /^\d+:\d+$/.test(run.ratio || "") ? run.ratio.replace(":", " / ") : "1 / 1";
  const tall = run.ratio === "9:16";
  const running = run.status === "running" || run.status === "late";
  const pct = running ? Math.min(96, Math.max(4, ((now - run.t0) / 1000 / run.eta) * 100)) : 100;
  const w = running ? waitText(run, now) : null;
  return (
    <article className="fadein">
      {run.prompt ? <p className="run-p clamp3">{run.prompt}</p> : null}
      <div className="run-m">
        <span className="clamp1">{run.label}{run.kind === "image" && run.ratio ? `, ${run.ratio}` : ""}</span>
        {run.cost ? <Price n={run.cost} /> : null}
      </div>
      {run.status === "failed" ? (
        <div className="failed">
          <div className="r" style={{ gap: 10, alignItems: "flex-start" }}><Icon name="alert" style={{ marginTop: 1 }} /><p className="grow">{run.error}</p></div>
          <div className="r" style={{ gap: 8 }}>
            {run.again ? <button className="btn btn-s" onClick={() => s.retry(run)}><Icon name="refresh" size={18} />Try again</button> : null}
            <button className="btn" onClick={() => s.dropRun(run.key)}>Dismiss</button>
          </div>
        </div>
      ) : running ? (
        <div className={`tile run-media${tall ? " tall" : ""}`} style={{ aspectRatio: ar }} role="status" aria-live="polite">
          {run.poster ? <Picture src={run.poster} eager /> : null}
          <div className={`wait${run.poster ? " over" : ""}`}>
            <p className="b">{run.status === "late" ? "Still rendering" : w.head}</p>
            <p className="sm" style={{ opacity: 0.8 }}>{run.status === "late" ? "It will appear in your Library when it's ready" : w.sub}</p>
            {run.status === "late" ? null : <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
          </div>
        </div>
      ) : (
        <button className={`tile run-media${tall ? " tall" : ""}`} style={{ aspectRatio: ar }} onClick={() => s.setViewer({ item: run.item })} aria-label={run.item.video ? "Open video" : "Open image"}>
          {run.item.video
            ? <><Poster item={run.item} version={s.posters[run.item.id]} /><span className="play"><Icon name="play" size={22} /></span></>
            : <img className="fadein" src={run.item.url} alt={run.prompt || ""} loading="lazy" decoding="async" />}
        </button>
      )}
      {running && run.kind === "video" && run.cost && !s.wallet.admin ? <p className="note"><i className="coin" />{run.cost} credits held. They come back if the video fails. You can close this page; the video is saved to your Library.</p> : null}
      {run.unsaved ? <p className="note"><Icon name="alert" size={16} />This image couldn't be saved to your Library. Download it now to keep it.</p> : null}
    </article>
  );
}

// One prompt run on several models: the results sit next to each other, each under its model's name and price.
function CompareRun({ run, s, now }) {
  const ar = /^\d+:\d+$/.test(run.ratio || "") ? run.ratio.replace(":", " / ") : "1 / 1";
  return (
    <article className="fadein">
      {run.prompt ? <p className="run-p clamp3">{run.prompt}</p> : null}
      <div className="run-m"><span className="clamp1">{run.label}{run.ratio ? `, ${run.ratio}` : ""}</span><Price n={run.cost} /></div>
      <div className={`cmp${run.ratio === "16:9" ? " wide" : ""}`}>
        {run.parts.map((p) => {
          const pct = Math.min(96, Math.max(4, ((now - p.t0) / 1000 / p.eta) * 100));
          return (
            <div key={p.id}>
              {p.status === "done" ? (
                <button className="tile" style={{ aspectRatio: ar }} onClick={() => s.setViewer({ item: p.item })} aria-label={`Open the ${p.name} image`}>
                  <img className="fadein" src={p.item.url} alt={`${p.name}: ${run.prompt || ""}`} loading="lazy" decoding="async" />
                </button>
              ) : p.status === "failed" ? (
                <div className="tile cmp-f" style={{ aspectRatio: ar }}>
                  <p className="sm">{p.error}</p>
                  <button className="btn btn-s" style={{ height: 40 }} onClick={() => s.retryPart(run, p.id)}><Icon name="refresh" size={16} />Try again</button>
                </div>
              ) : (
                <div className="tile" style={{ aspectRatio: ar }} role="status" aria-live="polite" aria-label={`${p.name}: generating`}>
                  <div className="wait"><p className="b sm">Generating</p><div className="bar"><i style={{ width: `${pct}%` }} /></div></div>
                </div>
              )}
              <div className="cmp-l"><span className="clamp1">{p.name}</span><Price n={p.cost} /></div>
              {p.unsaved ? <p className="note"><Icon name="alert" size={16} />Not saved to your Library. Download it to keep it.</p> : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function Create({ s }) {
  const video = s.mode === "video";
  const dockRef = useRef(null), fileRef = useRef(null), textRef = useRef(null);
  const [dockH, setDockH] = useState(220);
  const anyRunning = s.runs.some((r) => r.status === "running");
  const now = useNow(anyRunning);

  // Keep the newest result in view, like a conversation.
  const count = s.runs.length;
  useEffect(() => { const t = requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight)); return () => cancelAnimationFrame(t); }, [count]);
  useLayoutEffect(() => {
    const el = dockRef.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setDockH(el.offsetHeight));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  // The prompt box grows with the text, up to six lines.
  useLayoutEffect(() => { const el = textRef.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(132, Math.max(44, el.scrollHeight))}px`; }, [s.prompt]);

  const im = imageModel(s.imgModel), vm = videoModel(s.vidModel);
  const plan = video ? videoPlan(vm.id, s.vDur, s.vRes, s.ratio) : null;
  const cmp = !video && !s.ref ? comparePlan(s.compare) : null; // two or more models chosen: compare them
  const cost = s.ref ? (video ? TOOLS.animate.cost : TOOLS.reference.cost) : video ? plan?.cost : cmp ? cmp.cost : im.cost;
  const action = s.ref ? (video ? "Animate image" : "Generate from image") : video ? "Generate video" : cmp ? `Compare ${cmp.models.length} models` : "Generate";
  const placeholder = s.ref ? (video ? "Describe the motion (optional)" : "Describe the new image") : video ? "Describe the video you want" : "Describe the image you want";
  const lockedRatio = !video && s.format !== "free" ? FORMATS[s.format]?.ratio : null; // a format fixes the shape
  const canGo = Boolean(s.prompt.trim()) || (video && s.ref);

  return (
    <div className="screen">
      <header className="top">
        <Brand />
        <div className="seg" role="tablist" aria-label="What to make">
          <button role="tab" aria-selected={!video} className={video ? "" : "on"} onClick={() => s.setMode("image")}><Icon name="image" size={18} />Image</button>
          <button role="tab" aria-selected={video} className={video ? "on" : ""} onClick={() => s.setMode("video")}><Icon name="video" size={18} />Video</button>
        </div>
        <Balance s={s} />
      </header>

      <div className="stream">
        {s.runs.length === 0 ? (
          <div className="empty">
            <h1 className="d h1">{video ? "What should the video show?" : "What do you want to make?"}</h1>
            <p className="t2" style={{ marginBottom: 6 }}>Write it in your own words below, or start from one of these.</p>
            {IDEAS[s.mode].map((t) => (
              <button key={t} className="idea" onClick={() => { s.setPrompt(t); textRef.current?.focus(); }}><span className="grow">{t}</span><Icon name="right" style={{ color: "var(--text-3)" }} /></button>
            ))}
          </div>
        ) : s.runs.map((run) => (run.kind === "compare" ? <CompareRun key={run.key} run={run} s={s} now={now} /> : <Run key={run.key} run={run} s={s} now={now} />))}
        <div style={{ height: dockH }} aria-hidden="true" />
      </div>

      <div className="dock" ref={dockRef}>
        <div className="composer">
          {s.format !== "free" && FORMATS[s.format] && !video ? (
            <div className="r" style={{ gap: 4 }}>
              <span className="chip grow clamp1" style={{ flex: "0 1 auto" }}>Format: {FORMATS[s.format].label}</span>
              <button className="ib" aria-label="Remove the format" onClick={() => s.setFormat("free")}><Icon name="x" size={18} /></button>
            </div>
          ) : null}
          {s.ref ? (
            <div className="refcard">
              <span className="tile"><Picture src={s.ref.url} eager /></span>
              <div className="grow">
                <p className="b sm">{video ? "Start frame" : "Reference image"}</p>
                <p className="sm t3 clamp1">{video ? "The video begins from this image" : "The new image follows its look"}</p>
              </div>
              <button className="ib" aria-label="Remove the image" onClick={() => s.setRef(null)}><Icon name="x" /></button>
            </div>
          ) : null}
          <textarea ref={textRef} className="prompt" rows={1} maxLength={1500} value={s.prompt} placeholder={placeholder} aria-label={placeholder}
            onChange={(e) => s.setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); s.generate(); } }} />
          <div className="chips">
            <button className="chip-tap" aria-label={s.uploading ? "Uploading" : video ? "Add a start frame" : "Add a reference image"} disabled={s.uploading} onClick={() => { if (!s.needAccount({ tab: "create" })) fileRef.current?.click(); }}>
              <span className="chip">{s.uploading ? <i className="spin" style={{ width: 16, height: 16 }} /> : <Icon name="plus" size={18} />}</span>
            </button>
            {s.ref ? (
              <span className="sm t2 b" style={{ whiteSpace: "nowrap", padding: "0 4px" }}>{video ? TOOLS.animate.detail : TOOLS.reference.detail}</span>
            ) : (
              <>
                <button className="chip-tap" onClick={() => s.setSheet({ type: "models" })} aria-label={cmp ? `Comparing ${cmp.models.length} models. Change` : `Model: ${video ? vm.name : im.name}. Change`}>
                  <span className="chip">{cmp ? `${cmp.models.length} models` : video ? vm.name : im.name}<Icon name="down" size={16} /></span>
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
          <button className="btn btn-p btn-wide btn-split" onClick={s.generate} disabled={!canGo}>
            <span>{action}</span>{cost ? <Price n={cost} /> : null}
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) s.upload(f); }} />
    </div>
  );
}
