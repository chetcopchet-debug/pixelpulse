"use client";
import { useEffect, useState } from "react";
import Icon from "./icons";
import { Price, lockScroll } from "./bits";
import { imageModels, videoModels, TOOLS } from "./models";
import { FREE_DAILY, BUILD } from "./store";

const THEMES = [["dark", "Dark"], ["light", "Light"], ["auto", "Match device"]];
const ABOUT = [["Terms", "/terms"], ["Privacy", "/privacy"], ["Refunds", "/refund-policy"], ["Content policy", "/content-policy"], ["Contact us", "/contact"]];

// A full page that lies over the tabs, with a way back. Used for Settings, Models & pricing and Help.
function Page({ title, s, children }) {
  useEffect(() => lockScroll(), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !s.sheet) s.setPage(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.sheet, s.setPage]);
  return (
    <div className="page" role="dialog" aria-modal="true" aria-label={title}>
      <div className="page-in">
        <header className="top">
          <button className="ib" aria-label="Back" onClick={() => s.setPage(null)}><Icon name="left" /></button>
          <h1 className="b" style={{ fontSize: 17, lineHeight: "24px" }}>{title}</h1>
          <span style={{ width: 44 }} />
        </header>
        <div className="pad" style={{ paddingBottom: 40 }}>{children}</div>
      </div>
    </div>
  );
}
const Sec = ({ children }) => <h2 className="sec">{children}</h2>;

function Purchases() {
  const [st, setSt] = useState({ status: "loading", items: [] });
  useEffect(() => {
    let live = true;
    fetch("/api/account/purchases", { cache: "no-store" }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))).then(({ ok, d }) => { if (live) setSt(ok ? { status: "ready", items: d.items || [] } : { status: "error", items: [] }); }).catch(() => { if (live) setSt({ status: "error", items: [] }); });
    return () => { live = false; };
  }, []);
  if (st.status === "loading") return <div className="lrow t2"><i className="spin" />Loading</div>;
  if (st.status === "error") return <div className="lrow t2">Your purchases could not be loaded. Try again in a moment.</div>;
  if (!st.items.length) return <div className="lrow t2">No purchases yet.</div>;
  return st.items.map((p) => (
    <div key={p.id} className="lrow two">
      <span className="grow"><span className="b" style={{ display: "block" }}>{p.name}</span><span className="sm t2" style={{ display: "block" }}>{new Date(p.at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}{p.price ? `, ${p.price}` : ""}</span></span>
      <Price n={Number(p.credits).toLocaleString("en-US")} />
    </div>
  ));
}

export function Settings({ s }) {
  const w = s.wallet;
  const [open, setOpen] = useState(""); // "purchases" | "delete"
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const del = async () => { if (busy || word.trim() !== "DELETE") return; setBusy(true); setErr(""); const e = await s.deleteAccount(); if (e) { setErr(e); setBusy(false); } };
  return (
    <Page title="Settings" s={s}>
      <Sec>Appearance</Sec>
      <div className="seg" role="tablist" aria-label="Appearance" style={{ display: "flex" }}>
        {THEMES.map(([id, label]) => <button key={id} role="tab" aria-selected={s.theme === id} className={s.theme === id ? "on" : ""} style={{ flex: "1 1 0", padding: "0 8px" }} onClick={() => s.setTheme(id)}>{label}</button>)}
      </div>

      <Sec>Prompts</Sec>
      <div className="card">
        <label className="lrow two" style={{ cursor: "pointer" }}>
          <span className="grow">
            <span className="b" style={{ display: "block" }}>Translate prompts to English</span>
            <span className="sm t2" style={{ display: "block" }}>Write in any language. Your prompt is translated before it is created, because the models follow English best. Text in quotes stays as you wrote it.</span>
          </span>
          <input type="checkbox" className="sr" checked={s.translate} onChange={(e) => s.setTranslate(e.target.checked)} />
          <span className={`tg${s.translate ? " on" : ""}`} aria-hidden="true"><i /></span>
        </label>
      </div>

      <Sec>Account</Sec>
      {w.account ? (
        <div className="card">
          <div className="lrow"><Icon name="mail" style={{ color: "var(--text-3)" }} /><span className="grow clamp1">{w.account.email}</span></div>
          <button className="lrow" aria-expanded={open === "purchases"} onClick={() => setOpen(open === "purchases" ? "" : "purchases")}><Icon name="receipt" style={{ color: "var(--text-3)" }} /><span className="grow" style={{ textAlign: "left" }}>Purchases</span><Icon name={open === "purchases" ? "down" : "right"} style={{ color: "var(--text-3)" }} /></button>
          {open === "purchases" ? <Purchases /> : null}
          <button className="lrow bad" aria-expanded={open === "delete"} onClick={() => { setOpen(open === "delete" ? "" : "delete"); setErr(""); }}><Icon name="trash" /><span className="grow" style={{ textAlign: "left" }}>Delete account</span><Icon name={open === "delete" ? "down" : "right"} /></button>
          {open === "delete" ? (
            <div className="delbox">
              <p>This deletes your account, every image and video you made, your projects and favorites. {w.paid > 0 ? `Your ${w.paid.toLocaleString("en-US")} bought credits are lost. ` : ""}It can't be undone.</p>
              <label className="sm t2" htmlFor="del-word" style={{ display: "block", margin: "12px 0 6px" }}>Type DELETE to confirm</label>
              <input id="del-word" className="field" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
              {err ? <p className="sm bad" role="alert" style={{ marginTop: 8 }}>{err}</p> : null}
              <div className="r" style={{ gap: 8, marginTop: 12 }}>
                <button className="btn btn-danger" disabled={busy || word.trim() !== "DELETE"} onClick={del}>{busy ? <i className="spin" /> : null}Delete my account</button>
                <button className="btn btn-s" onClick={() => { setOpen(""); setWord(""); }}>Keep it</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="card">
          <button className="lrow" onClick={() => { s.setPage(null); s.askSignIn(); }}><Icon name="person" style={{ color: "var(--text-3)" }} /><span className="grow" style={{ textAlign: "left" }}>Sign up or sign in</span><Icon name="right" style={{ color: "var(--text-3)" }} /></button>
        </div>
      )}

      <Sec>About</Sec>
      <div className="card">
        {ABOUT.map(([t, h]) => <a key={h} className="lrow" href={h}><span className="grow">{t}</span><Icon name="right" style={{ color: "var(--text-3)" }} /></a>)}
      </div>
      <p className="sm t3 num" style={{ marginTop: 20, textAlign: "center" }}>Version {BUILD}</p>
    </Page>
  );
}

const EDITING = [
  [TOOLS.sharpen.label, "The same image at twice the size", TOOLS.sharpen.cost],
  [TOOLS.cutout.label, "A transparent PNG", TOOLS.cutout.cost],
  [TOOLS.reference.label, "A new image that follows one you add", TOOLS.reference.cost],
  [TOOLS.facelock.label, "The same face in a new scene. Bought credits only", TOOLS.facelock.cost],
  [TOOLS.edit.label, "Describe a change to an image you have", TOOLS.edit.cost],
  [TOOLS.repaint.label, "Paint over a part and replace it", TOOLS.repaint.cost],
  [TOOLS.animate.label, "A 5 second video from an image. Bought credits only", TOOLS.animate.cost],
];

// Models & pricing: what credits cost, and what each model and tool costs in credits. A tap on a model opens
// Create with it chosen.
export function Pricing({ s }) {
  const w = s.wallet;
  const [kind, setKind] = useState("image");
  const [busy, setBusy] = useState("");
  const plans = (w.plans || []).filter((p) => p.credits);
  const list = (kind === "video" ? videoModels : imageModels).filter((m) => !s.off.has(m.id));
  const pick = (m) => {
    if (kind === "video") { s.setMode("video"); s.setVidModel(m.id); } else { s.setMode("image"); s.setImgModel(m.id); }
    s.setPage(null);
    if (s.needAccount({ tab: "create" })) return;
    s.setTab("create");
  };
  return (
    <Page title="Models & pricing" s={s}>
      {plans.length ? (
        <div className="packs">
          {plans.map((p, i) => (
            <div key={p.id} className="pack">
              <p className="sm t2">{p.name}</p>
              <p className="d num" style={{ fontSize: 24, lineHeight: "30px", margin: "2px 0 10px" }}><Price n={Number(p.credits).toLocaleString("en-US")} /></p>
              <button className={`btn ${i === 0 ? "btn-p" : "btn-s"} btn-wide`} style={{ height: 44 }} disabled={!p.enabled || Boolean(busy)} onClick={async () => { setBusy(p.id); await s.buy(p.id); setBusy(""); }}>
                {busy === p.id ? <i className="spin" /> : <>{p.price}{p.period === "month" ? " / mo" : ""}</>}
              </button>
              <p className="sm t3" style={{ marginTop: 8 }}>{p.period === "month" ? "Every month" : "One payment"}</p>
            </div>
          ))}
        </div>
      ) : null}
      {plans.length && !plans.some((p) => p.enabled) ? <p className="sm t2" style={{ marginTop: 10 }}>Payments are opening soon. Until then you can keep creating with free credits.</p> : null}
      <p className="sm t2" style={{ margin: "12px 2px 0" }}>One wallet for every model. An account gets {FREE_DAILY} free credits every day, used before bought ones. The price is on the button before you tap, and a run that fails costs nothing.</p>

      <div className="seg" role="tablist" aria-label="Kind" style={{ display: "flex", marginTop: 22 }}>
        {[["image", "Images"], ["video", "Video"], ["edit", "Editing"]].map(([id, label]) => <button key={id} role="tab" aria-selected={kind === id} className={kind === id ? "on" : ""} style={{ flex: "1 1 0", padding: "0 8px" }} onClick={() => setKind(id)}>{label}</button>)}
      </div>
      {kind === "edit" ? (
        <>
          <div className="mlist">{EDITING.map(([name, desc, cost]) => <div key={name}><span className="grow"><span className="b" style={{ display: "block", fontSize: 16 }}>{name}</span><span className="sm t2" style={{ display: "block" }}>{desc}</span></span><Price n={cost} /></div>)}</div>
          <p className="sm t3" style={{ marginTop: 8 }}>Open any image you made to use these.</p>
        </>
      ) : (
        <>
          <div className="mlist">
            {list.map((m) => (
              <button key={m.id} onClick={() => pick(m)} style={{ width: "100%", textAlign: "left" }} aria-label={`${m.name}, ${m.cost} credits. Create with this model`}>
                <span className="grow"><span className="b" style={{ display: "block", fontSize: 16 }}>{m.name}</span><span className="sm t2" style={{ display: "block" }}>{m.by}. {m.desc}</span></span>
                <Price n={m.cost} />
              </button>
            ))}
          </div>
          <p className="sm t3" style={{ marginTop: 8 }}>{kind === "video" ? "Price for the shortest clip. Video uses bought credits. Tap a model to create with it." : "Price for one image. Tap a model to create with it."}</p>
        </>
      )}
      <p className="sm t2" style={{ marginTop: 22 }}>More about credits, refunds and payments on the <a className="link" href="/pricing">full prices page</a>.</p>
    </Page>
  );
}

const QA = [
  ["How do credits work?", `One wallet pays for every model: images, video and editing. An account gets ${FREE_DAILY} free credits every day, and they are used first. Bought credits are used after that. The price is always on the button before you tap.`],
  ["What if a creation fails?", "You don't pay for it. If an image or video doesn't finish, its credits go back to your wallet by themselves."],
  ["Where are my images and videos?", "Everything you make is saved in your Library. A video keeps rendering if you close the site, and is waiting in your Library when you come back."],
  ["Can I write prompts in my own language?", "Yes, in any language. Your prompt is translated before it is created, because the models follow English best. Text in quotes stays exactly as you wrote it. You can switch this off in Settings."],
  ["Which model should I pick?", "Choose Auto and the site picks a model that fits your prompt, showing the price first. Compare runs the same prompt on several models side by side. Models & pricing says what each model is good at."],
  ["How do I change an image I made?", "Open it. Under the picture you can upscale it, remove the background, change it with words, paint over one area and replace it, or turn it into a short video."],
  ["Why does video need bought credits?", "A video costs many times more to make than an image, so free credits don't cover video and a few tools. The button tells you before you tap."],
  ["Can I get a refund?", "Yes. Unused bought credits can be refunded within 14 days.", ["/refund-policy", "Refund policy"]],
  ["How do I delete something, or my account?", "Open an image or video and tap the bin to delete it. To delete your account and everything in it, go to Settings."],
];

export function Help({ s }) {
  return (
    <Page title="Help" s={s}>
      <div className="card" style={{ marginTop: 6 }}>
        {QA.map(([q, a, link]) => (
          <details key={q} className="qa">
            <summary><span className="grow">{q}</span><Icon name="down" style={{ color: "var(--text-3)" }} /></summary>
            <p className="t2">{a}{link ? <> <a className="link" href={link[0]}>{link[1]}</a>.</> : null}</p>
          </details>
        ))}
      </div>
      <p className="t2" style={{ marginTop: 20 }}>Still stuck? <a className="link" href="/contact">Write to us</a> and we will help.</p>
    </Page>
  );
}
