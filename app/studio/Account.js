"use client";
import Icon from "./icons";
import { Brand } from "./bits";
import { FREE_DAILY, BUILD } from "./store";

const LINKS = [["Prices", "/pricing"], ["Terms", "/terms"], ["Privacy", "/privacy"], ["Refunds", "/refund-policy"], ["Content policy", "/content-policy"], ["Contact", "/contact"]];
const THEMES = [["dark", "Dark"], ["light", "Light"], ["auto", "Match device"]];

// Wallet and account: what you have, how to get more, who is signed in.
export default function Account({ s }) {
  const w = s.wallet;
  const guest = w.loaded && !w.account && !w.admin;
  return (
    <div className="screen">
      <header className="top"><Brand /></header>
      <div className="pad">
        <h1 className="d h1" style={{ margin: "4px 0 16px" }}>Account</h1>

        {guest ? (
          <div className="card" style={{ padding: 16 }}>
            <p className="d" style={{ fontSize: 22, lineHeight: "28px" }}>Sign up and get {FREE_DAILY} free credits every day</p>
            <p className="t2" style={{ margin: "8px 0 14px" }}>Creating needs an account. It takes one step and has no password, and your work is kept on every device.</p>
            <button className="btn btn-p btn-wide" onClick={() => s.askSignIn()}>Sign up or sign in</button>
            {w.paid > 0 ? <p className="sm t2" style={{ marginTop: 12 }}>This browser holds {w.paid.toLocaleString("en-US")} bought credits. They move into your account when you sign in.</p> : null}
          </div>
        ) : (
          <>
            <p className="sm t2">Your balance</p>
            {w.admin ? (
              <p className="d" style={{ fontSize: 32, lineHeight: "40px", margin: "4px 0 16px" }}>Admin mode</p>
            ) : (
              <p className="r" style={{ gap: 12, alignItems: "baseline", margin: "6px 0 16px" }}>
                <i className="coin" style={{ width: 22, height: 22, alignSelf: "center" }} />
                <span className="d balance num">{w.loaded ? (w.free + w.paid).toLocaleString("en-US") : "…"}</span>
                <span className="t2" style={{ fontSize: 17 }}>credits</span>
              </p>
            )}

            {w.admin ? (
              <>
                <p className="t2" style={{ marginBottom: 12 }}>Nothing is charged while admin mode is on, so your credits are not shown. Turn it off to use the site like everyone else.</p>
                <div className="r" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <form method="post" action="/api/admin" className="grow"><input type="hidden" name="logout" value="1" /><button className="btn btn-p btn-wide" type="submit">Turn off admin mode</button></form>
                  <a className="btn btn-s" href="/admin">Admin page</a>
                </div>
              </>
            ) : (
              <>
                <div className="card split">
                  <div>
                    <p className="sm t2">Bought</p>
                    <p className="d num" style={{ fontSize: 22, lineHeight: "30px" }}>{w.paid.toLocaleString("en-US")}</p>
                    <p className="sm t3">Used after free credits</p>
                  </div>
                  <div>
                    <p className="sm t2">Free today</p>
                    <p className="d num" style={{ fontSize: 22, lineHeight: "30px" }}>{w.free} of {w.freeLimit}</p>
                    <p className="sm t3">Refills every day</p>
                  </div>
                </div>
                <div className="r" style={{ gap: 8, marginTop: 12 }}>
                  <button className="btn btn-p grow" onClick={() => s.askCredits(0)}>Add credits</button>
                  <a className="btn btn-s" href="/pricing">See prices</a>
                </div>
              </>
            )}

            {w.account ? (
              <>
                <h2 className="d h2" style={{ margin: "32px 0 10px" }}>Your account</h2>
                <div className="card">
                  <div className="lrow"><Icon name="mail" style={{ color: "var(--text-3)" }} /><span className="grow clamp1">{w.account.email}</span></div>
                  <button className="lrow" onClick={s.signOut}><Icon name="logout" style={{ color: "var(--text-3)" }} /><span className="grow">Sign out</span></button>
                </div>
              </>
            ) : null}
          </>
        )}

        <h2 className="d h2" style={{ margin: "32px 0 10px" }}>Appearance</h2>
        <div className="seg" role="tablist" aria-label="Appearance" style={{ display: "flex" }}>
          {THEMES.map(([id, label]) => <button key={id} role="tab" aria-selected={s.theme === id} className={s.theme === id ? "on" : ""} style={{ flex: "1 1 0", padding: "0 8px" }} onClick={() => s.setTheme(id)}>{label}</button>)}
        </div>

        <h2 className="d h2" style={{ margin: "32px 0 10px" }}>About</h2>
        <div className="card">
          {LINKS.map(([t, h]) => <a key={h} className="lrow" href={h}><span className="grow">{t}</span><Icon name="right" style={{ color: "var(--text-3)" }} /></a>)}
        </div>
        <p className="sm t3 num" style={{ marginTop: 20, textAlign: "center" }}>Version {BUILD}</p>
      </div>
    </div>
  );
}
