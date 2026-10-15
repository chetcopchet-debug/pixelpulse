import { LegalPage } from '../_legal/Legal';
import { PLANS } from '../../lib/paid';
export const metadata = { title: { absolute: 'Pricing · PixelPulse' }, description: '10 free credits every day. Creator Pack: 500 credits for $9.90 that never expire. Pulse Pro: 1,200 credits a month for $14.90.', alternates: { canonical: '/pricing' } };

const COSTS = [['⚡ Fast image', 1], ['🔤 Text image (lettering)', 3], ['◎ Guide (from an image)', 3], ['💎 Quality image', 4], ['✎ Edit with words', 4], ['◐ Repaint an area', 5], ['◇ HD download (2x)', 1], ['✂ Cutout (remove background)', 0], ['✦ Amplify prompt', 0]];
const card = { padding: 18, borderRadius: 20, background: '#12121c', border: '1px solid #2a2a40' };
const FAQ = [
  ['Which credits are used first?', 'Your 10 free daily credits are always used first. Paid credits are only used after the free ones run out.'],
  ['Do purchased credits expire?', 'Creator Pack credits never expire. Pulse Pro adds 1,200 credits each billing month; unused credits stay in your balance.'],
  ['How do I cancel Pulse Pro?', 'Use the "Manage subscription" link in your Lemon Squeezy receipt email. You keep the credits you already received.'],
  ['Can I get a refund?', 'Yes — unused purchased credits can be refunded within 14 days. See the Refund Policy.'],
  ['Who processes payments?', 'Lemon Squeezy, our Merchant of Record. They handle the payment, VAT/sales tax and your receipt. We never see your card details.'],
  ['I changed phone or cleared my browser. Where are my credits?', 'There are no accounts yet, so credits live on your device. Copy your restore code from the profile menu after buying, or contact us with your order email and we will restore them.'],
];
export default function Pricing() {
  return (
    <LegalPage title="Pricing" noRemoval>
      <p>Start free every day. Buy more only if you need it.</p>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', marginTop: 16 }}>
        <div style={card}><b>Free</b><div style={{ fontSize: 26, fontWeight: 800, margin: '6px 0' }}>$0</div><p style={{ margin: 0 }}>10 credits every day, refilled at midnight UTC. No signup.</p></div>
        <div style={card}><b>{PLANS.pack.name}</b><div style={{ fontSize: 26, fontWeight: 800, margin: '6px 0' }}>{PLANS.pack.price} <small style={{ fontSize: 12, color: '#a1a1b5' }}>one-time</small></div><p style={{ margin: 0 }}>{PLANS.pack.credits} credits that never expire.</p></div>
        <div style={{ ...card, borderColor: 'rgba(236,72,153,.7)' }}><b>{PLANS.pro.name}</b><div style={{ fontSize: 26, fontWeight: 800, margin: '6px 0' }}>{PLANS.pro.price} <small style={{ fontSize: 12, color: '#a1a1b5' }}>/ month</small></div><p style={{ margin: 0 }}>{PLANS.pro.credits.toLocaleString('en-US')} credits every month. Cancel anytime.</p></div>
      </div>
      <p style={{ fontSize: 12.5, color: '#8a8aa3' }}>Prices in USD. Taxes may be added at checkout depending on your country. Buy from the ⚡ menu in the <a href="/">Studio</a>.</p>
      <h2>What things cost</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}><tbody>
        {COSTS.map(([k, v]) => <tr key={k} style={{ borderBottom: '1px solid #22223a' }}><td style={{ padding: '9px 2px', color: '#cfcde0' }}>{k}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{v ? `${v}⚡` : 'Free'}</td></tr>)}
      </tbody></table>
      <h2>FAQ</h2>
      {FAQ.map(([q, a]) => <div key={q}><p style={{ marginBottom: 2 }}><b>{q}</b></p><p style={{ marginTop: 0 }}>{a.includes('Refund Policy') ? <>{a.replace(' See the Refund Policy.', ' See the ')}<a href="/refund-policy">Refund Policy</a>.</> : a}</p></div>)}
    </LegalPage>
  );
}
