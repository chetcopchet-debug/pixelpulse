"use client";
import { useEffect } from "react";
import "./studio.css";
import Icon from "./icons";
import { useStudio } from "./store";
import Create from "./Create";
import Explore from "./Explore";
import Library from "./Library";
import Account from "./Account";
import Viewer from "./Viewer";
import { ModelSheet, RatioSheet, VideoSheet, PricingSheet, SignInSheet, AskSheet } from "./Sheets";

const TABS = [["explore", "compass", "Explore"], ["create", "create", "Create"], ["library", "library", "Library"], ["account", "user", "Account"]];

export default function Studio() {
  const s = useStudio();
  const close = () => s.setSheet(null);
  // Every screen opens at its top; Create scrolls itself to the newest result.
  useEffect(() => { if (s.tab !== "create") window.scrollTo(0, 0); }, [s.tab]);
  const sh = s.sheet;
  return (
    <div className="pp" data-theme={s.theme}>
      {!s.ready ? null : s.tab === "create" ? <Create s={s} /> : s.tab === "library" ? <Library s={s} /> : s.tab === "account" ? <Account s={s} /> : <Explore s={s} />}

      <nav className="nav" aria-label="Main">
        {TABS.map(([id, icon, label]) => (
          <button key={id} className={s.tab === id ? "on" : ""} aria-current={s.tab === id ? "page" : undefined} onClick={() => s.setTab(id)}>
            <Icon name={icon} size={22} />{label}
          </button>
        ))}
      </nav>

      {s.viewer ? <Viewer s={s} /> : null}

      {sh?.type === "models" ? <ModelSheet s={s} onClose={close} /> : null}
      {sh?.type === "ratio" ? <RatioSheet s={s} onClose={close} /> : null}
      {sh?.type === "video" ? <VideoSheet s={s} onClose={close} /> : null}
      {sh?.type === "pricing" ? <PricingSheet s={s} need={sh.need} label={sh.label} paidOnly={sh.paidOnly} onClose={close} /> : null}
      {sh?.type === "signin" ? <SignInSheet s={s} reason={sh.reason} onClose={close} /> : null}
      {sh?.type === "ask" ? <AskSheet s={s} tool={sh.tool} item={sh.item} onClose={close} /> : null}

      {s.toast ? <div className="toast" role="status">{s.toast}</div> : null}
    </div>
  );
}
