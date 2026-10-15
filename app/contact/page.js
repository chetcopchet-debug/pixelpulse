import { LegalPage } from '../_legal/Legal';
import { CONTACT_EMAIL } from '../../lib/site';
export const metadata = { title: { absolute: 'Contact · PixelPulse' }, description: 'Contact PixelPulse for support, billing, refunds and removal requests.', alternates: { canonical: '/contact' } };
export default function Contact() {
  return (
    <LegalPage title="Contact" noRemoval>
      <p>We read every message and usually reply within 1–2 business days.</p>
      <p style={{ fontSize: 18, margin: '18px 0' }}>✉ <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      <h2>What to include</h2>
      <ul>
        <li><b>Billing or refunds:</b> your order number or checkout email. See the <a href="/refund-policy">Refund Policy</a>.</li>
        <li><b>Lost credits:</b> your order email or restore code.</li>
        <li><b>Removal requests:</b> the image link (pixelpulse…/p/&lt;id&gt;) and the reason. We act on valid requests within 48 hours.</li>
        <li><b>Bugs:</b> what you did and what happened; a screenshot helps.</li>
      </ul>
    </LegalPage>
  );
}
