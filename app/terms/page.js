import { LegalPage } from '../_legal/Legal';
export const metadata = { title: 'Terms · PixelPulse', description: 'PixelPulse terms.', alternates: { canonical: '/terms' } };
export default function Terms() {
  return (
    <LegalPage title="Terms of Use">
      <p>By using PixelPulse you agree to these terms. If you don't agree, please don't use the service.</p>
      <h2>The service</h2>
      <p>PixelPulse lets you create and edit images with AI models run by third-party providers. Free daily credits are offered as-is and may change or end at any time. Features may be added, changed or removed.</p>
      <h2>Purchases</h2>
      <p>Paid credits and the Pulse Pro subscription are sold through our reseller and Merchant of Record, <b>Lemon Squeezy</b> (Lemon Squeezy LLC), which processes payments, handles sales tax/VAT and issues your receipt. Lemon Squeezy's own terms apply to the payment. Prices are shown on the <a href="/pricing">Pricing</a> page. Purchased Creator Pack credits don't expire; Pulse Pro credits are added each billing month and you can cancel anytime from your receipt email. Refunds follow our <a href="/refund-policy">Refund Policy</a>. Credits have no cash value and can't be transferred or resold.</p>
      <h2>Your content</h2>
      <ul>
        <li>You keep whatever rights you have in your prompts, uploads and results. You are responsible for what you create, upload and publish.</li>
        <li>When you publish an image to the Pulse Feed, you allow PixelPulse to display it publicly, including on share pages and previews.</li>
        <li>Only upload images you have the right to use. Uploaded photos stay private and can't be published.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Follow the <a href="/content-policy">Content Policy</a>. Don't abuse, scrape, overload or try to bypass limits or security. We may remove content or block access that breaks these rules.</p>
      <h2>No warranty</h2>
      <p>AI output can be inaccurate or unexpected. The service is provided "as is", without warranties, and to the extent permitted by law we're not liable for indirect or consequential losses.</p>
      <h2>Changes</h2>
      <p>We may update these terms; continued use means you accept the updated version.</p>
    </LegalPage>
  );
}
