"use client";
import { useEffect, useState } from "react";
import Icon from "./icons";
import { Price, lockScroll } from "./bits";
import { imageModel, imageModels, madeWith, TOOLS } from "./models";
import { download } from "./download";

// One result, full screen: the picture or video, what you can do with it next, and how it was made.
export default function Viewer({ s }) {
  const { item, before, readonly } = s.viewer;
  const [side, setSide] = useState("after");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSide("after"); setConfirm(false); }, [item]);
  useEffect(() => lockScroll(), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !s.sheet) s.setViewer(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.sheet, s.setViewer]);

  const shown = before && side === "before" ? before : item;
  const fav = item.id && s.favs.has(item.id);
  const canEdit = !readonly && !item.video && item.id;
  const varCost = imageModel(imageModels.some((m) => m.id === item.model) ? item.model : "fast").cost;
  const busy = s.busyTool;
  const next = [
    { key: "animate", icon: "film", label: TOOLS.animate.label, cost: TOOLS.animate.cost, run: () => s.animate(item) },
    { key: "sharpen", icon: "upscale", label: TOOLS.sharpen.label, cost: TOOLS.sharpen.cost, run: () => s.runTool("sharpen", item) },
    { key: "cutout", icon: "eraser", label: TOOLS.cutout.label, cost: TOOLS.cutout.cost, run: () => s.runTool("cutout", item) },
    { key: "edit", icon: "edit", label: TOOLS.edit.label, cost: TOOLS.edit.cost, run: () => s.setSheet({ type: "ask", tool: "edit", item }) },
    { key: "variations", icon: "variations", label: "Another version", cost: varCost, run: () => s.variations(item) },
    { key: "facelock", icon: "face", label: TOOLS.facelock.label, cost: TOOLS.facelock.cost, run: () => s.setSheet({ type: "ask", tool: "facelock", item }) },
  ];
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
            ? <video key={shown.url} src={shown.url} controls autoPlay loop playsInline />
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
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
