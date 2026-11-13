"use client";
import { useEffect } from "react";
import "./studio.css";
import Icon from "./icons";
import { useStudio } from "./store";
import Create from "./Create";
import Explore from "./Explore";
import Library from "./Library";
import { Settings, Pricing, Help } from "./Pages";
import Viewer from "./Viewer";
import AreaEditor from "./AreaEditor";
import { ModelSheet, RatioSheet, VideoSheet, PricingSheet, SignInSheet, AskSheet, ProjectSheet, IdeasSheet, MeSheet } from "./Sheets";

// Three tabs. Create is the one in the middle and stands out. Everything about the account is in the profile menu.
const TABS = [["explore", "compass", "Explore"], ["create", "plus", "Create"], ["library", "library", "Library"]];

export default function Studio() {
  const s = useStudio();
  const close = () => s.setSheet(null);
  // Every screen opens at its top; Create scrolls itself to the newest result.
  useEffect(() => { if (s.tab !== "create") window.scrollTo(0, 0); }, [s.tab]);
  const sh = s.sheet;
  return (
    <div className="pp" data-theme={s.theme}>
      {!s.ready ? null : s.tab === "create" ? <Create s={s} /> : s.tab === "library" ? <Library s={s} /> : <Explore s={s} />}

      <nav className="nav" aria-label="Main">
        {TABS.map(([id, icon, label]) => (
          <button key={id} className={`${s.tab === id ? "on" : ""}${id === "create" ? " mid" : ""}`} aria-current={s.tab === id ? "page" : undefined} onClick={() => s.setTab(id)}>
            {id === "create" ? <span className="plusb"><Icon name={icon} size={22} /></span> : <Icon name={icon} size={22} />}{label}
          </button>
        ))}
      </nav>

      {s.page === "settings" ? <Settings s={s} /> : s.page === "pricing" ? <Pricing s={s} /> : s.page === "help" ? <Help s={s} /> : null}
      {s.viewer ? <Viewer s={s} /> : null}
      {s.area ? <AreaEditor s={s} item={s.area} onClose={() => s.setArea(null)} /> : null}

      {sh?.type === "models" ? <ModelSheet s={s} onClose={close} /> : null}
      {sh?.type === "ratio" ? <RatioSheet s={s} onClose={close} /> : null}
      {sh?.type === "video" ? <VideoSheet s={s} onClose={close} /> : null}
      {sh?.type === "pricing" ? <PricingSheet s={s} need={sh.need} label={sh.label} paidOnly={sh.paidOnly} onClose={close} /> : null}
      {sh?.type === "signin" ? <SignInSheet s={s} reason={sh.reason} onClose={close} /> : null}
      {sh?.type === "ask" ? <AskSheet s={s} tool={sh.tool} item={sh.item} onClose={close} /> : null}
      {sh?.type === "me" ? <MeSheet s={s} onClose={close} /> : null}
      {sh?.type === "ideas" ? <IdeasSheet s={s} onClose={close} /> : null}
      {sh?.type === "project" ? <ProjectSheet s={s} mode={sh.mode} item={sh.item} id={sh.id} onClose={close} /> : null}

      {s.newer ? <div className="newer" role="status"><span>A newer version of the site is ready.</span><button onClick={() => window.location.reload()}>Reload</button></div> : null}
      {s.toast ? <div className="toast" role="status">{s.toast}</div> : null}
    </div>
  );
}
