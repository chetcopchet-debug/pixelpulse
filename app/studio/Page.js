import "./studio.css";
import ThemeRoot from "./ThemeRoot";
import { N } from "../i18n/index.js";
import { getT } from "../i18n/server";
import LangPicker from "../i18n/LangPicker";

const LINKS = [[N("Prices"), "/pricing"], [N("Formats"), "/formats"], [N("Terms"), "/terms"], [N("Privacy"), "/privacy"], [N("Refunds"), "/refund-policy"], [N("Content policy"), "/content-policy"], [N("Safety and reporting"), "/terms#safety"], [N("Contact"), "/contact"]];

// Frame for every page outside the studio (prices, policies, formats, shared images, admin):
// the same header, type, colours and footer, so the whole site reads as one product.
export default async function Page({ children, wide, bare }) {
  const { t, lang } = await getT();
  return (
    <ThemeRoot>
      <header className="top site-top">
        <a href="/" className="r" style={{ gap: 10, minHeight: 44 }} aria-label={t("Yelvo, home")}>
          <i className="logo" aria-hidden="true" /><span className="wm">Yelvo</span>
        </a>
        {bare ? null : <a className="btn btn-s" style={{ height: 44, padding: "0 14px" }} href="/?tab=create">{t("Open the studio")}</a>}
      </header>
      <main className={`doc${wide ? " wide" : ""}`}>{children}</main>
      {bare ? null : (
        <footer className={`doc${wide ? " wide" : ""}`} style={{ paddingBottom: 40 }}>
          <nav className="foot" aria-label={t("About")}>{LINKS.map(([name, h]) => <a key={h} href={h}>{t(name)}</a>)}</nav>
          <LangPicker lang={lang} label={t("Language")} />
        </footer>
      )}
    </ThemeRoot>
  );
}
