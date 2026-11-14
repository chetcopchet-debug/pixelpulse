import { LegalPage } from '../_legal/Legal';
import { MIN_AGE } from '../../lib/site';
export const metadata = { title: 'Acceptable Use Policy · Yelvo', description: 'What may and may not be created on Yelvo, and how the rules are enforced.', alternates: { canonical: '/content-policy' } };
export default function ContentPolicy() {
  return (
    <LegalPage title="Acceptable Use Policy">
      <p>This policy (also called our Content Policy) applies to prompts, uploads, edits and everything you create on Yelvo, images and videos alike. It is part of the <a href="/terms">Terms of Use</a>. Yelvo is for people aged {MIN_AGE} and over.</p>
      <h2>Not allowed</h2>
      <ul>
        <li><b>Minors.</b> Any sexual, suggestive or revealing content involving a minor, or anyone who looks like one. Reported to the authorities.</li>
        <li><b>Sexual content.</b> Pornography, nudity and explicit sexual content of any kind.</li>
        <li><b>Real people without consent.</b> Images or videos of a real, identifiable person made without their permission; any sexual, intimate, humiliating or "deepfake" content of a real person; undressing or sexualizing a photo of anyone.</li>
        <li><b>Deception.</b> Realistic content of real people or events presented as real, impersonation, fake documents, and anything made to mislead, defraud or influence elections.</li>
        <li><b>Hate and harassment.</b> Content that harasses, threatens or demeans people, or promotes hate or violence against a person or a group.</li>
        <li><b>Violence and harm.</b> Graphic gore, promotion of self-harm, terrorism or violent extremism.</li>
        <li><b>Illegal activity.</b> Content that promotes or helps illegal acts, including the sale of drugs or weapons.</li>
        <li><b>Other people's rights.</b> Content that infringes someone else's copyright, trademark, privacy or right to their own likeness.</li>
        <li><b>Abuse of the service.</b> Getting around the safety checks or limits, automated scraping, reselling access, or opening several accounts to collect free credits.</li>
      </ul>
      <h2>How the rules are enforced</h2>
      <ul>
        <li>Prompts are screened before anything is made, and a blocked prompt is not run.</li>
        <li>Results are checked automatically, images and videos alike, and so is an image a video starts from. Content that fails the check is not saved, and its credits are returned.</li>
        <li>Creations are private: they are shown only in their maker's library. The public gallery shows only works chosen by Yelvo, and none of them shows a real person.</li>
        <li>Blocked attempts are counted. Repeated violations pause video creation for the day or lead to an automatic ban of the account.</li>
        <li>We keep a log of creations so that abuse can be investigated (see the <a href="/privacy">Privacy Policy</a>).</li>
      </ul>
      <h2>Review and removal</h2>
      <p>Anything that breaks these rules may be reviewed, hidden or removed at our discretion, and the account behind it may be suspended, without notice and without a refund of used credits.</p>
      <h2>Reporting</h2>
      <p>See something that breaks these rules, or that shows you without your consent? Email us with the link, or a screenshot, and the reason. No account is needed. Reports about minors or about real people are handled first.</p>
    </LegalPage>
  );
}
