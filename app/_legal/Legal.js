import { CONTACT_EMAIL, LEGAL_UPDATED } from '../../lib/site';
import Page from '../studio/Page';

export function LegalPage({ title, children, noRemoval, noDate }) {
  return (
    <Page>
      <h1>{title}</h1>
      {noDate ? null : <p className="sm t3">Last updated {LEGAL_UPDATED}</p>}
      <div className="prose" style={{ marginTop: 20 }}>
        {children}
        {!noRemoval && <><h2>Contact and removal requests</h2>
        <p>Email <a href={`mailto:${CONTACT_EMAIL}?subject=Removal%20request`}>{CONTACT_EMAIL}</a> with the image link (pixelpulse…/p/&lt;id&gt;) and the reason. We aim to act on valid removal requests within 48 hours.</p></>}
      </div>
    </Page>
  );
}
