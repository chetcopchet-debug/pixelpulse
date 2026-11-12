"use client";
import { useState } from "react";
import { Price, Brand, Balance } from "./bits";
import { imageModels, videoModels } from "./models";
import { FREE_DAILY } from "./store";

const LINKS = [["Pricing", "/pricing"], ["Terms", "/terms"], ["Privacy", "/privacy"], ["Refunds", "/refund-policy"], ["Content policy", "/content-policy"], ["Contact", "/contact"]];

// The shop window: what PixelPulse is, the models and what they cost, how credits work, and one clear way in.
// Nothing is created here; creating has its own screen. There are no sample pictures on purpose: until there
// is a set of our own, checked examples, an empty window is better than a generic one.
export default function Explore({ s }) {
  const [kind, setKind] = useState("image");
  const w = s.wallet;
  const guest = w.loaded && !w.account && !w.admin;
  const list = (kind === "video" ? videoModels : imageModels).filter((m) => !s.off.has(m.id));
  // Guests are asked to sign in first and land on Create afterwards.
  const start = () => { if (s.needAccount({ tab: "create" })) return; s.setTab("create"); };
  const pick = (m) => {
    if (kind === "video") { s.setMode("video"); s.setVidModel(m.id); } else { s.setMode("image"); s.setImgModel(m.id); }
    start();
  };

  return (
    <div className="screen">
      <header className="top">
        <Brand wordmark />
        <Balance s={s} />
      </header>

      <section className="hero">
        <h1 className="d">The best image and video models. One wallet.</h1>
        <p>Veo, Kling, FLUX, Imagen, Ideogram and more. Buy credits once, spend them on any model, and see the price before every generation.</p>
        <button className="btn btn-p cta" onClick={start}>Start creating</button>
        <p className="sm t2" style={{ marginTop: 12 }}>{guest || !w.loaded ? `Sign up and get ${FREE_DAILY} free credits every day.` : `You get ${FREE_DAILY} free credits every day.`}</p>
      </section>

      <section className="section pad">
        <h2 className="d" style={{ fontSize: 28, lineHeight: "32px" }}>{imageModels.length + videoModels.length} models. Pick the one that fits the job.</h2>
        <div className="seg" role="tablist" aria-label="Kind of model" style={{ marginTop: 14 }}>
          <button role="tab" aria-selected={kind === "image"} className={kind === "image" ? "on" : ""} onClick={() => setKind("image")}>Images<span className="t3 num">{imageModels.length}</span></button>
          <button role="tab" aria-selected={kind === "video"} className={kind === "video" ? "on" : ""} onClick={() => setKind("video")}>Video<span className="t3 num">{videoModels.length}</span></button>
        </div>
        <div className="mlist">
          {list.map((m) => (
            <button key={m.id} onClick={() => pick(m)} style={{ width: "100%" }} aria-label={`${m.name}, ${m.cost} credits. Create with this model`}>
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
        <button className="btn btn-p cta" style={{ marginTop: 24 }} onClick={start}>Start creating</button>
      </section>

      <nav className="foot pad" aria-label="About">{LINKS.map(([t, h]) => <a key={h} href={h}>{t}</a>)}</nav>
    </div>
  );
}
