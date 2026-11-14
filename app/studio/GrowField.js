"use client";
import { t } from "../i18n/index.js";
import { useLayoutEffect, useRef, useState } from "react";
import Icon from "./icons";

// The small button in the corner of a prompt box. One tap makes the box tall enough to show the whole prompt
// without scrolling (up to a part of the screen's height); another tap puts it back.
export function GrowButton({ on, onClick }) {
  return (
    <button type="button" className={`grow${on ? " on" : ""}`} aria-pressed={on} aria-label={on ? t("Make the box small again") : t("Show the whole prompt")} onClick={onClick}>
      <Icon name={on ? "shrink" : "grow"} size={16} />
    </button>
  );
}

// How tall an opened box may be: a part of what is visible of the screen (less when the keyboard is up).
export const growMax = (part = 0.7) => Math.round(((typeof window !== "undefined" && (window.visualViewport?.height || window.innerHeight)) || 800) * part);

// A prompt box of a tool (Edit, Keep the face, Edit an area) with that button.
export default function GrowField({ value, part = 0.7, ...props }) {
  const ref = useRef(null);
  const [big, setBig] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "";
    if (!big) return;
    const base = el.offsetHeight;
    el.style.height = "auto";
    el.style.height = `${Math.min(growMax(part), Math.max(base, el.scrollHeight + 2))}px`;
  }, [big, value, part]);
  return (
    <div className="growbox">
      <textarea ref={ref} className="field" value={value} {...props} />
      <GrowButton on={big} onClick={() => setBig((b) => !b)} />
    </div>
  );
}
