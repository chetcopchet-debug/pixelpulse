import { LegalPage } from '../_legal/Legal';
import { CONTACT_EMAIL } from '../../lib/site';
import { getT } from '../i18n/server';
import { rich } from '../i18n/rich.js';
export const metadata = { title: { absolute: 'Contact · PixelPulse' }, description: 'Contact PixelPulse for support, billing, refunds and removal requests.', alternates: { canonical: '/contact' } };
export default async function Contact() {
  const { t } = await getT();
  const b = (c) => <b>{c}</b>;
  return (
    <LegalPage title={t("Contact")} noRemoval noDate>
      <p>{t("We read every message and usually reply within 1–2 business days.")}</p>
      <p style={{ fontSize: 18, lineHeight: '26px', margin: '18px 0' }}><a href={`mailto:${CONTACT_EMAIL}`}><b>{CONTACT_EMAIL}</b></a></p>
      <h2>{t("What to include")}</h2>
      <ul>
        <li>{rich(t("<b>Billing or refunds:</b> your order number or checkout email. See the <a>Refund Policy</a>."), { b, a: (c) => <a href="/refund-policy">{c}</a> })}</li>
        <li>{rich(t("<b>Lost credits:</b> your order email."), { b })}</li>
        <li>{rich(t("<b>Removal requests:</b> a link to the image or video, or a screenshot of it, and the reason. We act on valid requests within 48 hours."), { b })}</li>
        <li>{rich(t("<b>Bugs:</b> what you did and what happened; a screenshot helps."), { b })}</li>
      </ul>
    </LegalPage>
  );
}
