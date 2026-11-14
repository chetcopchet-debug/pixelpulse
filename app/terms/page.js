import { LegalPage } from '../_legal/Legal';
import { LEGAL_NAME, LEGAL_COUNTRY, MIN_AGE, CONTACT_EMAIL } from '../../lib/site';
export const metadata = { title: 'Terms · Yelvo', description: 'Yelvo terms.', alternates: { canonical: '/terms' } };
export default function Terms() {
  return (
    <LegalPage title="Terms of Use">
      <p>Yelvo (yelvoai.com) is operated {LEGAL_NAME ? <>by <b>{LEGAL_NAME}</b>, </> : null}from {LEGAL_COUNTRY} ("Yelvo", "we"). By using Yelvo you agree to these terms. If you don't agree, please don't use the service.</p>
      <h2>Who can use Yelvo</h2>
      <p>You must be at least {MIN_AGE} years old to use Yelvo. By creating an account you confirm that you are.</p>
      <h2>The service</h2>
      <p>Yelvo lets you create and edit images and videos with AI models run by third-party providers. The models on offer, their prices in credits and the features around them may be added, changed or removed. Free daily credits are offered as-is and may change or end at any time.</p>
      <h2>Your account</h2>
      <p>Creating needs an account, with an email address or with Google. Keep your sign-in to yourself; you are responsible for what is done with your account. You can delete your account at any time from your profile ("Delete account"): this removes your images, videos, uploads and any unused credits, and it cannot be undone.</p>
      <h2>Purchases</h2>
      <ul>
        <li><b>What we sell.</b> Yelvo Pack is a one-time purchase of credits that don't expire. Yelvo Pro is a monthly subscription that adds credits each billing month. Prices are on the <a href="/pricing">Pricing</a> page, in US dollars; tax may be added at checkout depending on your country.</li>
        <li><b>Renewal and cancelling.</b> Yelvo Pro renews automatically every month, at the price shown when you subscribed, until you cancel. You can cancel at any time, from the link in your receipt email or by writing to <a href={`mailto:${CONTACT_EMAIL}?subject=Cancel%20subscription`}>{CONTACT_EMAIL}</a>. Cancelling stops the next renewal; you keep the credits you already received.</li>
        <li><b>Who takes the payment.</b> Purchases are handled by our payment provider, which acts as the reseller and Merchant of Record: it processes the payment, handles sales tax or VAT, and issues your receipt. Its name is shown at checkout and on your receipt, and its own terms apply to the payment. We never see your card details.</li>
        <li><b>Refunds</b> follow our <a href="/refund-policy">Refund Policy</a>.</li>
        <li><b>Credits</b> are a way to use the service. They have no cash value and can't be transferred or resold.</li>
      </ul>
      <h2>Your content</h2>
      <ul>
        <li>You keep whatever rights you have in your prompts, uploads and results. You are responsible for what you create and upload.</li>
        <li>Only upload images you have the right to use. Your uploads and creations are shown only in your own library.</li>
        <li>Images and videos are made by AI. Don't present them as real photos or recordings of real events.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Follow the <a href="/content-policy">Acceptable Use Policy</a>. Don't abuse, scrape, overload or try to bypass limits, safety checks or security. We may remove content or block access that breaks these rules.</p>
      <h2 id="safety">Safety, consent and takedowns</h2>
      <ul>
        <li><b>Consent for real people.</b> Don't upload, edit, animate or otherwise create images or videos of a real, identifiable person unless you have their permission. Never use the service to make intimate, sexual, humiliating or deceptive content of a real person.</li>
        <li><b>Prohibited content.</b> Don't create, upload or share sexual or nude content, content that sexualizes or depicts minors in any way that is sexual or revealing, graphic violence or gore, or content that harasses, threatens or promotes harm. Any content sexualizing minors is reported to the relevant authorities.</li>
        <li><b>You are responsible.</b> You are solely responsible for your prompts, uploads and results and for how you use them, and you confirm you have every right and consent needed. You agree to indemnify Yelvo against claims arising from content you create or upload in breach of these terms.</li>
        <li><b>Removal and bans.</b> We may, at our discretion and without notice, hide, remove or delete any content and suspend or ban any account or device, including through automated systems. Repeated violations lead to an automatic ban.</li>
        <li><b>Reporting.</b> Anyone can report content by email, no account needed; the address is on the <a href="/contact">Contact</a> page. Reports about minors or about real people shown without consent are handled first, and we aim to act on every valid removal request within 48 hours.</li>
        <li><b>Records.</b> To prevent abuse and to cooperate with lawful requests, we keep a log of generation activity (account or device id, a hashed IP address, prompts, input and output references, safety-check results and time). See the <a href="/privacy">Privacy Policy</a>.</li>
      </ul>
      <h2>No warranty</h2>
      <p>AI output can be inaccurate or unexpected. The service is provided "as is", without warranties, and to the extent permitted by law we're not liable for indirect or consequential losses.</p>
      <h2>Changes</h2>
      <p>We may update these terms; the date at the top shows the latest version. Continued use means you accept the updated version.</p>
    </LegalPage>
  );
}
