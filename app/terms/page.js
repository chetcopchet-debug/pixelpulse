import { LegalPage } from '../_legal/Legal';
export const metadata = { title: 'Terms · PixelPulse' };
export default function Terms() {
  return (
    <LegalPage title="Terms of Use">
      <p>By using PixelPulse you agree to these terms. If you don't agree, please don't use the service.</p>
      <h2>The service</h2>
      <p>PixelPulse lets you create and edit images with AI models run by third-party providers. Free daily credits are offered as-is and may change or end at any time. Features may be added, changed or removed.</p>
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
