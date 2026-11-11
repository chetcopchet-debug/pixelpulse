"use client";
import { useState } from "react";
import Icon from "./icons";
import { Price, Picture, Tile, Brand, Balance } from "./bits";
import { imageModels, videoModels, imageModel, videoModel, videoPlan } from "./models";
import { FREE_DAILY } from "./store";

const LINKS = [["Pricing", "/pricing"], ["Terms", "/terms"], ["Privacy", "/privacy"], ["Refunds", "/refund-policy"], ["Content policy", "/content-policy"], ["Contact", "/contact"]];

// The front page: what PixelPulse is, a place to start, the models and their prices, and work people shared.
export default function Explore({ s }) {
  const [kind, setKind] = useState("image");
  const w = s.wallet;
  const video = s.mode === "video";
  const cost = video ? videoPlan(videoModel(s.vidModel).id, s.vDur, s.vRes, s.ratio)?.cost : imageModel(s.imgModel).cost;
  const samples = s.feed.filter((x) => !x.video && x.prompt).slice(0, 4);
  const shared = s.feed.slice(0, 30);
  const list = kind === "video" ? videoModels : imageModels;
  const start = () => { s.setTab("create"); s.generate(); };
  const pick = (m) => { if (kind === "video") { s.setMode("video"); s.setVidModel(m.id); } else { s.setMode("image"); s.setImgModel(m.id); } s.setTab("create"); };

  return (
    <div className="screen">
      <header className="top">
        <Brand wordmark />
        {w.account || w.admin ? <Balance s={s} /> : <button className="btn btn-s" style={{ height: 44, padding: "0 14px" }} onClick={() => s.askSignIn()}>Sign in or sign up</button>}
      </header>

      <section className="hero">
        <h1 className="d">The best image and video models. One wallet.</h1>
        <p>Veo, Kling, FLUX, Imagen, Ideogram and more. Buy credits once, spend them on any model, and see the price before every generation.</p>
      </section>

      <div className="starter">
        <div className="composer">
          <textarea className="prompt" rows={2} style={{ height: 66 }} maxLength={1500} value={s.prompt} onChange={(e) => s.setPrompt(e.target.value)} placeholder={video ? "Describe the video you want" : "Describe the image you want"} aria-label="Describe what you want to make" />
          <div className="r" style={{ gap: 8, flexWrap: "wrap" }}>
            <div className="seg" role="tablist" aria-label="What to make">
              <button role="tab" aria-selected={!video} className={video ? "" : "on"} onClick={() => s.setMode("image")}><Icon name="image" size={18} />Image</button>
              <button role="tab" aria-selected={video} className={video ? "on" : ""} onClick={() => s.setMode("video")}><Icon name="video" size={18} />Video</button>
            </div>
            <button className="chip-tap" onClick={() => s.setSheet({ type: "models" })} aria-label="Change the model">
              <span className="chip">{video ? videoModel(s.vidModel).name : imageModel(s.imgModel).name}<Icon name="down" size={16} /></span>
            </button>
          </div>
          <button className="btn btn-p btn-wide btn-split" disabled={!s.prompt.trim()} onClick={start}><span>{video ? "Generate video" : "Generate"}</span>{cost ? <Price n={cost} /> : null}</button>
        </div>
        {samples.length === 4 ? (
          <>
            <div className="samples">
              {samples.map((x) => <button key={x.id} className="tile" aria-label={`Start from: ${x.prompt}`} onClick={() => { s.setMode("image"); s.setPrompt(x.prompt); }}><Picture src={x.url} eager /></button>)}
            </div>
            <p className="sm t3" style={{ textAlign: "center", marginTop: 8 }}>Tap a picture to start from its idea</p>
          </>
        ) : null}
        <p className="sm t2" style={{ textAlign: "center", marginTop: 14 }}>
          {w.loaded && !w.guest ? `${FREE_DAILY} free credits every day.` : `3 free tries, no sign-up. Sign in and get ${FREE_DAILY} free credits every day.`}
        </p>
      </div>

      <section className="section pad">
        <h2 className="d" style={{ fontSize: 28, lineHeight: "32px" }}>{imageModels.length + videoModels.length} models. Pick the one that fits the job.</h2>
        <div className="seg" role="tablist" aria-label="Kind of model" style={{ marginTop: 14 }}>
          <button role="tab" aria-selected={kind === "image"} className={kind === "image" ? "on" : ""} onClick={() => setKind("image")}>Images<span className="t3 num">{imageModels.length}</span></button>
          <button role="tab" aria-selected={kind === "video"} className={kind === "video" ? "on" : ""} onClick={() => setKind("video")}>Video<span className="t3 num">{videoModels.length}</span></button>
        </div>
        <div className="mlist">
          {list.map((m) => (
            <button key={m.id} onClick={() => pick(m)} style={{ width: "100%" }}>
              <span className="grow">
                <span className="b" style={{ display: "block", fontSize: 16 }}>{m.name}</span>
                <span className="sm t2" style={{ display: "block" }}>{m.by}. {m.desc}</span>
              </span>
              <Price n={m.cost} />
            </button>
          ))}
        </div>
        <p className="sm t3" style={{ marginTop: 8 }}>{kind === "video" ? "Prices are for the shortest clip. Video uses bought credits." : "Price for one image."}</p>
      </section>

      <section className="section pad">
        <h2 className="d" style={{ fontSize: 28, lineHeight: "32px" }}>How credits work</h2>
        <div className="steps">
          <div className="step"><p className="b">One wallet for every model</p><p className="sm t2" style={{ marginTop: 4 }}>The same credits pay for images, video and editing. No separate plan for each model.</p></div>
          <div className="step"><p className="b r" style={{ gap: 6 }}>The price is on the button <i className="coin" /></p><p className="sm t2" style={{ marginTop: 4 }}>You always see what a generation costs before you tap.</p></div>
          <div className="step"><p className="b">Failed runs cost nothing</p><p className="sm t2" style={{ marginTop: 4 }}>If an image or video doesn't finish, the credits go back to your wallet.</p></div>
        </div>
      </section>

      {shared.length >= 6 ? (
        <section className="section">
          <h2 className="d pad" style={{ fontSize: 28, lineHeight: "32px", marginBottom: 12 }}>Made on PixelPulse</h2>
          <div className="grid3">{shared.map((x) => <Tile key={x.id} item={x} onClick={() => s.setViewer({ item: x, readonly: true })} />)}</div>
        </section>
      ) : null}

      <nav className="foot pad" aria-label="About">{LINKS.map(([t, h]) => <a key={h} href={h}>{t}</a>)}</nav>
    </div>
  );
}
