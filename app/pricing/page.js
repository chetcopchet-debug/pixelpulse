import Page from '../studio/Page';
import { PLANS } from '../../lib/paid';
import BuyButton from './BuyButton';
import { imageModels, videoModels, TOOLS } from '../studio/models';
import { VIDEO_PRICING } from '../../lib/videoPricing';
export const metadata = { title: { absolute: 'Pricing · PixelPulse' }, description: 'Sign up and get 10 free credits every day. Creator Pack: 500 credits for $9.90 that never expire. Pulse Pro: 1,200 credits a month for $14.90.', alternates: { canonical: '/pricing' } };

const Coin = ({ n }) => <span className="price"><i className="coin" />{n}</span>;
const TOOL_ROWS = [
  [TOOLS.reference.label, 'A new image that follows the look of one you add', TOOLS.reference.cost],
  [TOOLS.edit.label, 'Describe a change to an image you have', TOOLS.edit.cost],
  [TOOLS.sharpen.label, 'The same image at twice the size', TOOLS.sharpen.cost],
  [TOOLS.cutout.label, 'A transparent PNG', TOOLS.cutout.cost],
  [TOOLS.facelock.label, 'The same face in a new scene. Bought credits only', TOOLS.facelock.cost],
  [TOOLS.animate.label, 'A 5 second video from an image. Bought credits only', TOOLS.animate.cost],
];
const FAQ = [
  ['Which credits are used first?', 'Free credits are always used first: 10 every day once you have an account. Bought credits are only used after the free ones run out.'],
  ['Do bought credits expire?', 'Creator Pack credits never expire. Pulse Pro adds 1,200 credits each billing month; unused credits stay in your balance.'],
  ['How do I cancel Pulse Pro?', 'Use the "Manage subscription" link in your Lemon Squeezy receipt email. You keep the credits you already received.'],
  ['Can I get a refund?', 'Yes. Unused bought credits can be refunded within 14 days.', ['/refund-policy', 'Refund Policy']],
  ['Who processes payments?', 'Lemon Squeezy, our Merchant of Record. They handle the payment, VAT or sales tax and your receipt. We never see your card details.'],
  ['I changed phone or cleared my browser. Where are my credits?', 'Sign in with Google or email from the Account screen and your credits follow your account on any device. If you bought without signing in, contact us with your order email.', ['/contact', 'Contact']],
];

export default function Pricing() {
  return (
    <Page wide>
      <h1>Prices</h1>
      <p className="lead">One wallet for every model. Start free, and buy credits only if you need more.</p>

      <div className="cards" style={{ marginTop: 24 }}>
        <div className="pcard">
          <p className="b">Free</p>
          <p className="amount">$0</p>
          <p className="t2">Sign up and get 10 free credits every day, refilled at midnight UTC. Creating needs an account.</p>
        </div>
        <div className="pcard">
          <p className="b">{PLANS.pack.name}</p>
          <p className="amount">{PLANS.pack.price} <span className="sm t3" style={{ fontFamily: 'var(--font-text)', letterSpacing: 0 }}>one payment</span></p>
          <p className="t2 r" style={{ gap: 6 }}><i className="coin" />{PLANS.pack.credits} credits that never expire.</p>
          <BuyButton plan="pack" label={`Buy ${PLANS.pack.name}`} />
        </div>
        <div className="pcard">
          <p className="b">{PLANS.pro.name}</p>
          <p className="amount">{PLANS.pro.price} <span className="sm t3" style={{ fontFamily: 'var(--font-text)', letterSpacing: 0 }}>a month</span></p>
          <p className="t2 r" style={{ gap: 6 }}><i className="coin" />{PLANS.pro.credits.toLocaleString('en-US')} credits every month. Cancel anytime.</p>
          <BuyButton plan="pro" label={`Get ${PLANS.pro.name}`} />
        </div>
      </div>
      <p className="sm t3" style={{ marginTop: 12 }}>Prices in USD. Taxes may be added at checkout depending on your country. Sign in first, from the Account screen in the studio, so the credits are saved to your account.</p>

      <h2 className="sec">Image models</h2>
      <div className="ptable">
        <div className="head"><span className="grow">One image</span><span>Credits</span></div>
        {imageModels.map((m) => <div key={m.id}><span className="grow"><span className="b">{m.name}</span><span className="sm t2" style={{ display: 'block' }}>{m.by}. {m.desc}</span></span><Coin n={m.cost} /></div>)}
      </div>

      <h2 className="sec">Video models</h2>
      <div className="ptable">
        <div className="head"><span className="grow">One video, cheapest setting. Bought credits only</span><span>From</span></div>
        {videoModels.map((m) => { const p = VIDEO_PRICING[m.id]; return <div key={m.id}><span className="grow"><span className="b">{m.name}</span><span className="sm t2" style={{ display: 'block' }}>{m.by}. {p.durations.join(' or ')} seconds, up to {p.resolutions[p.resolutions.length - 1]}</span></span><Coin n={m.from} /></div>; })}
      </div>
      <p className="sm t3" style={{ marginTop: 8 }}>Longer or sharper videos cost more. The exact price is on the button before you generate.</p>

      <h2 className="sec">Working on an image</h2>
      <div className="ptable">
        <div className="head"><span className="grow">Tool</span><span>Credits</span></div>
        {TOOL_ROWS.map(([name, what, cost]) => <div key={name}><span className="grow"><span className="b">{name}</span><span className="sm t2" style={{ display: 'block' }}>{what}</span></span><Coin n={cost} /></div>)}
      </div>

      <h2 className="sec">Questions</h2>
      <div className="faq">
        {FAQ.map(([q, a, link]) => <details key={q}><summary>{q}</summary><p>{a}{link ? <> See <a className="link" href={link[0]}>{link[1]}</a>.</> : null}</p></details>)}
      </div>
    </Page>
  );
}
