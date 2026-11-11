"use client";
import { useEffect, useState } from "react";

// Wraps a page outside the studio in the same theme the person chose in the studio (dark unless they changed it).
export default function ThemeRoot({ children }) {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    try { const t = (JSON.parse(localStorage.getItem("pp_studio") || "{}") || {}).theme; if (["dark", "light", "auto"].includes(t)) setTheme(t); } catch {}
  }, []);
  return <div className="pp plain" data-theme={theme}>{children}</div>;
}
