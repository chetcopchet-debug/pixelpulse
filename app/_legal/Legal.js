import { CONTACT_EMAIL, LEGAL_UPDATED, SITE_NAME } from '../../lib/site';

export function LegalPage({ title, children, noRemoval }) {
  return (
    <div style={{ minHeight: '100vh', background: '#07070a', color: '#e9e7f5', fontFamily: 'system-ui,-apple-system,sans-serif', padding: '20px 18px 60px', boxSizing: 'border-box' }}>
      <style>{`.lg a{color:#f0abfc}.lg h2{font-size:16px;margin:26px 0 8px}.lg p,.lg li{font-size:14.5px;line-height:1.65;color:#cfcde0}.lg ul{padding-left:20px}`}</style>
      <div className="lg" style={{ maxWidth: 680, margin: '0 auto' }}>
        <a href="/" style={{ textDecoration: 'none', fontWeight: 800, fontSize: 18 }}>← {SITE_NAME}</a>
        <h1 style={{ fontSize: 26, margin: '22px 0 4px', background: 'linear-gradient(90deg,#c084fc,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{title}</h1>
        <p style={{ fontSize: 12, color: '#7c7c94' }}>Last updated {LEGAL_UPDATED}</p>
        {children}
        {!noRemoval && <><h2>Contact & removal requests</h2>
        <p>Email <a href={`mailto:${CONTACT_EMAIL}?subject=Removal%20request`}>{CONTACT_EMAIL}</a> with the image link (pixelpulse…/p/&lt;id&gt;) and the reason. We aim to act on valid removal requests within 48 hours.</p></>}
        <p style={{ marginTop: 30, fontSize: 13 }}><a href="/pricing">Pricing</a> · <a href="/contact">Contact</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/refund-policy">Refunds</a> · <a href="/content-policy">Content Policy</a></p>
      </div>
    </div>
  );
}
