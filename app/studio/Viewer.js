"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { Price, lockScroll } from "./bits";
import { madeWith } from "./models";
import { nextActions } from "./next";
import { download } from "./download";

// The only place a video is actually played. Starts muted so every browser allows it to start by itself.
// First try: a mode that lets the page save one frame as the video's picture for lists. If the browser refuses
// that mode the same file is loaded again the plain way. If it still can't play, the person gets a way to watch
// it anyway (the phone's own player handles more formats than a browser) and the server is told what happened.
function Player({ item, own, s }) {
  const ref = useRef(null);
  const [plain, setPlain] = useState(false);
  const [failed, setFailed] = useState(null); // null | "checking" | "device" | "format"
  const framed = useRef(false);
  const onError = async () => {
    const e = ref.current?.error;
    if (!plain) { setPlain(true); return; }
    if (!own) { setFailed("device"); return; }
    setFailed("checking");
    // The server converts a file this device can't play; the viewer then gets the new address and starts over.
    const why = await s.reportVideo(item, { code: e?.code, message: e?.message });
    if (why !== "removed" && why !== "converted") setFailed(why);
  };
  const onTime = () => {
    const el = ref.current;
    if (!own || plain || framed.current || !el || el.currentTime < 0.3) return;
    framed.current = true; s.savePoster(item, el);
  };
  if (failed === "checking") {
    return <div className="vfail" role="status"><i className="spin" style={{ width: 28, height: 28 }} /><p className="b">Preparing the video for this device</p><p className="sm t2">This takes a few seconds and happens once.</p></div>;
  }
  if (failed) {
    return (
      <div className="vfail" role="alert">
        <Icon name="alert" size={28} />
        <p className="b">This browser can't play the video</p>
        <p className="sm t2" style={{ maxWidth: 320 }}>{failed === "format" ? "The file is saved and complete, but it uses a video format this browser doesn't support." : "The file is saved and complete."} Open it in your phone's video player, or download it.</p>
        <div className="r" style={{ gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <a className="btn btn-p" href={item.url} target="_blank" rel="noreferrer">Open the video</a>
          <button className="btn btn-s" onClick={() => download(item)}><Icon name="download" size={18} />Download</button>
        </div>
      </div>
    );
  }
  return <video key={plain ? "plain" : "frame"} ref={ref} src={item.url} {...(plain ? {} : { crossOrigin: "anonymous" })} controls autoPlay muted loop playsInline onError={onError} onTimeUpdate={onTime} />;
}

// One result, full screen: the picture or video, what you can do with it next, and how it was made.
export default function Viewer({ s }) {
  const { item, before, readonly } = s.viewer;
  const [side, setSide] = useState("after");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSide("after"); setConfirm(false); }, [item]);
  useEffect(() => lockScroll(), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !s.sheet && !s.area) s.setViewer(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.sheet, s.area, s.setViewer]);

  const shown = before && side === "before" ? before : item;
  const fav = item.id && s.favs.has(item.id);
  // The Library's copy knows the project even when this item was opened from the Create screen.
  const inProject = s.projects.find((p) => p.id === ((s.items.find((x) => x.id === item.id) ?? item).project || null));
  const canEdit = !readonly && !item.video && item.id;
  const busy = s.busyTool;
  const next = nextActions(s, item);
  const copy = async () => { try { await navigator.clipboard.writeText(item.prompt || ""); s.say("Prompt copied"); } catch { s.say("Couldn't copy. Select the text instead."); } };
  const save = async () => { if (saving) return; setSaving(true); await download(shown); setSaving(false); };

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={item.video ? "Video" : "Image"}>
      <div className="viewer-in">
        <header className="top">
          <button className="ib" aria-label="Close" onClick={() => s.setViewer(null)}><Icon name="x" /></button>
          <div className="r">
            <button className="ib" aria-label="Download" onClick={save}>{saving ? <i className="spin" /> : <Icon name="download" />}</button>
            {!readonly && item.id ? <button className={`ib${fav ? " on" : ""}`} aria-label={fav ? "Remove from favorites" : "Add to favorites"} aria-pressed={Boolean(fav)} onClick={() => s.toggleFav(item)}><Icon name="heart" style={fav ? { fill: "currentColor" } : null} /></button> : null}
            {!readonly ? <button className="ib" aria-label="Delete" onClick={() => setConfirm(true)}><Icon name="trash" /></button> : null}
          </div>
        </header>

        <div className="stage">
          {shown.video
            ? <Player key={shown.url} item={shown} own={!readonly} s={s} />
            : <img key={shown.url} className="fadein" src={shown.url} alt={shown.prompt || ""} />}
          {before ? (
            <div className="seg" role="tablist" aria-label="Compare with the original">
              <button role="tab" aria-selected={side === "before"} className={side === "before" ? "on" : ""} onClick={() => setSide("before")}>Before</button>
              <button role="tab" aria-selected={side === "after"} className={side === "after" ? "on" : ""} onClick={() => setSide("after")}>After</button>
            </div>
          ) : null}
        </div>

        <div className="pad" style={{ paddingTop: 16 }}>
          {confirm ? (
            <div className="failed" style={{ marginBottom: 16 }}>
              <p>Delete this {item.video ? "video" : "image"} from your Library? This can't be undone.</p>
              <div className="r" style={{ gap: 8 }}>
                <button className="btn btn-p" onClick={() => s.remove(item)}>Delete</button>
                <button className="btn btn-s" onClick={() => setConfirm(false)}>Keep it</button>
              </div>
            </div>
          ) : null}

          {before ? <p className="sm t2" style={{ marginBottom: 16 }}>The original stays in your Library.</p> : null}

          {canEdit ? (
            <>
              <h2 className="d h2" style={{ marginBottom: 10 }}>What next?</h2>
              <div className="next">
                {next.map((a) => (
                  <button key={a.key} onClick={a.run} disabled={Boolean(busy)}>
                    <span className="c" style={{ gap: 6 }}>{busy === a.key ? <i className="spin" /> : <Icon name={a.icon} />}<span>{busy === a.key ? "Working" : a.label}</span></span>
                    <Price n={a.cost} />
                  </button>
                ))}
              </div>
              <div className="rule" />
            </>
          ) : null}

          {item.prompt ? (
            <>
              <p className="sm b t3">Prompt</p>
              <p style={{ margin: "4px 0 12px", overflowWrap: "anywhere" }}>{item.prompt}</p>
              <div className="r" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-s" onClick={copy}><Icon name="copy" size={18} />Copy prompt</button>
                <button className={`btn ${readonly ? "btn-p" : "btn-s"}`} onClick={() => s.useAgain(item)}><Icon name="again" size={18} />{readonly ? "Use this prompt" : "Use again"}</button>
              </div>
            </>
          ) : null}

          {!readonly ? (
            <div className="r" style={{ gap: 32, marginTop: 20 }}>
              <div><p className="sm t3">Made with</p><p className="b">{madeWith(item.model)}</p></div>
              <div><p className="sm t3">Shape</p><p className="b num">{item.ratio}</p></div>
              {s.projectsOn && item.id ? (
                <div style={{ minWidth: 0 }}>
                  <p className="sm t3">Project</p>
                  <button className="link b clamp1" style={{ textAlign: "left" }} onClick={() => s.setSheet({ type: "project", mode: "pick", item })}>{inProject ? inProject.name : "Add to a project"}</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
