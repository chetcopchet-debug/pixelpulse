import { CONTACT_EMAIL, LEGAL_UPDATED } from '../../lib/site';
import Page from '../studio/Page';
import { getT } from '../i18n/server';

// The legal pages are in English, and the English text is the one that binds. A visitor who reads the site in
// another language is told so in that language, at the top. (`noDate` marks the Contact page, which is translated.)
export async function LegalPage({ title, children, noRemoval, noDate }) {
  const { t, lang } = await getT();
  return (
    <Page>
      <h1>{title}</h1>
      {!noDate && lang !== 'en' ? <p className="notice" style={{ marginTop: 12 }}>{t("This page is in English. The English version is the one that applies.")}</p> : null}
      {noDate ? null : <p className="sm t3">Last updated {LEGAL_UPDATED}</p>}
      <div className="prose" style={{ marginTop: 20 }}>
        {children}
        {!noRemoval && <><h2>Contact and removal requests</h2>
        <p>Email <a href={`mailto:${CONTACT_EMAIL}?subject=Removal%20request`}>{CONTACT_EMAIL}</a> with a link to the image or video, or a screenshot of it, and the reason. We aim to act on valid removal requests within 48 hours.</p></>}
      </div>
    </Page>
  );
}
