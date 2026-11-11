import "./studio.css";
import ThemeRoot from "./ThemeRoot";

const LINKS = [["Prices", "/pricing"], ["Formats", "/formats"], ["Terms", "/terms"], ["Privacy", "/privacy"], ["Refunds", "/refund-policy"], ["Content policy", "/content-policy"], ["Safety and reporting", "/terms#safety"], ["Contact", "/contact"]];

// Frame for every page outside the studio (prices, policies, formats, shared images, admin):
// the same header, type, colours and footer, so the whole site reads as one product.
export default function Page({ children, wide, bare }) {
  return (
    <ThemeRoot>
      <header className="top site-top">
        <a href="/" className="r" style={{ gap: 10, minHeight: 44 }} aria-label="PixelPulse, home">
          <i className="logo" aria-hidden="true" /><span className="d" style={{ fontSize: 20, lineHeight: "24px" }}>PixelPulse</span>
        </a>
        {bare ? null : <a className="btn btn-s" style={{ height: 44, padding: "0 14px" }} href="/?tab=create">Open the studio</a>}
      </header>
      <main className={`doc${wide ? " wide" : ""}`}>{children}</main>
      {bare ? null : <footer className={`doc${wide ? " wide" : ""}`} style={{ paddingBottom: 40 }}><nav className="foot" aria-label="About">{LINKS.map(([t, h]) => <a key={h} href={h}>{t}</a>)}</nav></footer>}
    </ThemeRoot>
  );
}
