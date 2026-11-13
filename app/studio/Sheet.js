"use client";
import { t } from "../i18n/index.js";
import { useEffect } from "react";
import Icon from "./icons";
import { lockScroll } from "./bits";

// A panel that slides up from the bottom on phones and sits in the middle on wide screens.
export default function Sheet({ title, sub, onClose, children }) {
  useEffect(() => lockScroll(), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-h"><h2 className="d">{title}</h2><button className="ib" aria-label={t("Close")} onClick={onClose}><Icon name="x" /></button></div>
        {sub ? <p className="sm t2" style={{ padding: "2px 20px 6px" }}>{sub}</p> : null}
        <div className="sheet-b">{children}</div>
      </div>
    </div>
  );
}
