"use client";
import { LANGS, LANG_COOKIE } from "./index";

// The language picker for pages the server draws: choosing a language saves it and loads the page again in it.
export default function LangPicker({ lang, label }) {
  const pick = (e) => {
    document.cookie = `${LANG_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
    try { localStorage.setItem(LANG_COOKIE, e.target.value); } catch { /* private mode: the cookie is enough */ }
    window.location.reload();
  };
  return (
    <label className="langpick">
      <span className="sr">{label}</span>
      <select value={lang} onChange={pick} aria-label={label}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
    </label>
  );
}
