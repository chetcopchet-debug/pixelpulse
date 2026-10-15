import { LegalPage } from '../_legal/Legal';
export const metadata = { title: 'Content Policy · PixelPulse', description: 'PixelPulse content policy.', alternates: { canonical: '/content-policy' } };
export default function ContentPolicy() {
  return (
    <LegalPage title="Content Policy">
      <p>Keep the pulse friendly. These rules apply to prompts, uploads, edits and anything published to the Pulse Feed.</p>
      <h2>Not allowed</h2>
      <ul>
        <li>Sexual content involving minors, in any form. Reported to authorities.</li>
        <li>Sexual or intimate imagery of real people, or non-consensual / "deepfake" imagery of anyone.</li>
        <li>Content that harasses, threatens, or promotes hate or violence against people or groups.</li>
        <li>Realistic images of real, identifiable people presented as real events, or used to mislead.</li>
        <li>Graphic gore, self-harm promotion, or illegal activity.</li>
        <li>Content that infringes someone else's copyright, trademark or privacy.</li>
      </ul>
      <h2>Publishing</h2>
      <p>Only AI creations can be published; uploaded photos stay private. Published images may be reviewed, hidden or removed at our discretion.</p>
      <h2>Reporting</h2>
      <p>See something that breaks these rules or shows you without consent? Email us with the link and we'll review it promptly.</p>
    </LegalPage>
  );
}
