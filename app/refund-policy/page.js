import { LegalPage } from '../_legal/Legal';
import { CONTACT_EMAIL } from '../../lib/site';
export const metadata = { title: { absolute: 'Refund Policy · PixelPulse' }, description: 'Refunds for unused purchased credits within 14 days.', alternates: { canonical: '/refund-policy' } };
export default function Refunds() {
  return (
    <LegalPage title="Refund Policy" noRemoval>
      <p>We want you to be happy with what you buy. PixelPulse sells digital credits that are delivered instantly, so this policy explains when refunds apply.</p>
      <h2>Creator Pack (one-time)</h2>
      <ul>
        <li>Unused purchased credits can be refunded in full within <b>14 days</b> of purchase.</li>
        <li>If you used part of a pack, we refund the unused part proportionally within the same 14 days.</li>
      </ul>
      <h2>Pulse Pro (monthly)</h2>
      <ul>
        <li>You can cancel anytime; the subscription stops at the end of the current billing month.</li>
        <li>Within 14 days of a monthly charge, we refund that month if its credits weren't used, or the unused part proportionally.</li>
      </ul>
      <h2>Problems with a result</h2>
      <p>If a generation or tool fails, its credits are returned to your balance automatically. If something went wrong anyway (a charge without credits, a broken result, a double charge), contact us and we'll fix it or refund you.</p>
      <h2>How to request a refund</h2>
      <p>Email <a href={`mailto:${CONTACT_EMAIL}?subject=Refund%20request`}>{CONTACT_EMAIL}</a> with your order number or the email used at checkout. Refunds are processed by Lemon Squeezy, our Merchant of Record, to your original payment method, usually within 5–10 business days. Refunded credits are removed from your balance.</p>
      <p>This policy doesn't affect your statutory rights as a consumer.</p>
    </LegalPage>
  );
}
