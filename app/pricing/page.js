import Page from '../studio/Page';
import { PLANS } from '../../lib/paid';
import BuyButton from './BuyButton';
import { N } from '../i18n/index.js';
import { rich } from '../i18n/rich.js';
import { getT } from '../i18n/server';
import { imageModels, videoModels, TOOLS } from '../studio/models';
import { VIDEO_PRICING } from '../../lib/videoPricing';
export const metadata = { title: { absolute: 'Models & pricing · PixelPulse' }, description: 'Sign up and get 10 free credits every day. Creator Pack: 500 credits for $9.90 that never expire. Pulse Pro: 1,200 credits a month for $14.90.', alternates: { canonical: '/pricing' } };

const Coin = ({ n }) => <span className="price"><i className="coin" />{n}</span>;
const TOOL_ROWS = [
  [TOOLS.reference.label, N('A new image that follows the look of one you add'), TOOLS.reference.cost],
  [TOOLS.edit.label, N('Describe a change to an image you have'), TOOLS.edit.cost],
  [TOOLS.sharpen.label, N('The same image at twice the size'), TOOLS.sharpen.cost],
  [TOOLS.cutout.label, N('A transparent PNG'), TOOLS.cutout.cost],
  [TOOLS.facelock.label, N('The same face in a new scene. Bought credits only'), TOOLS.facelock.cost],
  [TOOLS.animate.label, N('A 5 second video from an image. Bought credits only'), TOOLS.animate.cost],
];
const FAQ = [
  [N('Which credits are used first?'), N('Free credits are always used first: 10 every day once you have an account. Bought credits are only used after the free ones run out.')],
  [N('Do bought credits expire?'), N('Creator Pack credits never expire. Pulse Pro adds 1,200 credits each billing month; unused credits stay in your balance.')],
  [N('How do I cancel Pulse Pro?'), N('Use the "Manage subscription" link in your Lemon Squeezy receipt email. You keep the credits you already received.')],
  [N('Can I get a refund?'), N('Yes. Unused bought credits can be refunded within 14 days.'), ['/refund-policy', N('Refund Policy')]],
  [N('Who processes payments?'), N('Lemon Squeezy, our Merchant of Record. They handle the payment, VAT or sales tax and your receipt. We never see your card details.')],
  [N('I changed phone or cleared my browser. Where are my credits?'), N('Sign in with Google or email from the profile menu and your credits follow your account on any device. If you bought without signing in, contact us with your order email.'), ['/contact', N('Contact')]],
];

export default async function Pricing() {
  const { t, num } = await getT();
  const buyLabels = { busy: t("Opening checkout…"), failed: t("Checkout is unavailable right now.") };
  return (
    <Page wide>
      <h1>{t("Models & pricing")}</h1>
      <p className="lead">{t("One wallet for every model. Start free, and buy credits only if you need more.")}</p>

      <div className="cards" style={{ marginTop: 24 }}>
        <div className="pcard">
          <p className="b">{t("Free")}</p>
          <p className="amount">$0</p>
          <p className="t2">{t("Sign up and get 10 free credits every day, refilled at midnight UTC. Creating needs an account.")}</p>
        </div>
        <div className="pcard">
          <p className="b">{PLANS.pack.name}</p>
          <p className="amount">{PLANS.pack.price} <span className="sm t3" style={{ fontFamily: 'var(--font-text)', letterSpacing: 0 }}>{t("one payment")}</span></p>
          <p className="t2 r" style={{ gap: 6 }}><i className="coin" />{t("{n} credits that never expire.", { n: num(PLANS.pack.credits) })}</p>
          <BuyButton plan="pack" label={t("Buy {name}", { name: PLANS.pack.name })} labels={buyLabels} />
        </div>
        <div className="pcard">
          <p className="b">{PLANS.pro.name}</p>
          <p className="amount">{PLANS.pro.price} <span className="sm t3" style={{ fontFamily: 'var(--font-text)', letterSpacing: 0 }}>{t("a month")}</span></p>
          <p className="t2 r" style={{ gap: 6 }}><i className="coin" />{t("{n} credits every month. Cancel anytime.", { n: num(PLANS.pro.credits) })}</p>
          <BuyButton plan="pro" label={t("Get {name}", { name: PLANS.pro.name })} labels={buyLabels} />
        </div>
      </div>
      <p className="sm t3" style={{ marginTop: 12 }}>{t("Prices in USD. Taxes may be added at checkout depending on your country. Sign in first, from the profile menu in the studio, so the credits are saved to your account.")}</p>

      <h2 className="sec">{t("Image models")}</h2>
      <div className="ptable">
        <div className="head"><span className="grow">{t("One image")}</span><span>{t("Credits")}</span></div>
        {imageModels.map((m) => <div key={m.id}><span className="grow"><span className="b">{m.name}</span><span className="sm t2" style={{ display: 'block' }}>{m.by}. {t(m.desc)}</span></span><Coin n={m.cost} /></div>)}
      </div>

      <h2 className="sec">{t("Video models")}</h2>
      <div className="ptable">
        <div className="head"><span className="grow">{t("One video, cheapest setting. Bought credits only")}</span><span>{t("From")}</span></div>
        {videoModels.map((m) => { const p = VIDEO_PRICING[m.id]; return <div key={m.id}><span className="grow"><span className="b">{m.name}</span><span className="sm t2" style={{ display: 'block' }}>{m.by}. {t("{lengths} seconds, up to {quality}", { lengths: p.durations.join(' / '), quality: p.resolutions[p.resolutions.length - 1] })}</span></span><Coin n={m.from} /></div>; })}
      </div>
      <p className="sm t3" style={{ marginTop: 8 }}>{t("Longer or sharper videos cost more. The exact price is on the button before you generate.")}</p>

      <h2 className="sec">{t("Working on an image")}</h2>
      <div className="ptable">
        <div className="head"><span className="grow">{t("Tool")}</span><span>{t("Credits")}</span></div>
        {TOOL_ROWS.map(([name, what, cost]) => <div key={name}><span className="grow"><span className="b">{t(name)}</span><span className="sm t2" style={{ display: 'block' }}>{t(what)}</span></span><Coin n={cost} /></div>)}
      </div>

      <h2 className="sec">{t("Questions")}</h2>
      <div className="faq">
        {FAQ.map(([q, a, link]) => <details key={q}><summary>{t(q)}</summary><p>{t(a)}{link ? <> {rich(t("See the <a>Refund Policy</a>."), { a: (c) => <a className="link" href={link[0]}>{c}</a> })}</> : null}</p></details>)}
      </div>
    </Page>
  );
}
