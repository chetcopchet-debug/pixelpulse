import { LegalPage } from '../_legal/Legal';
export const metadata = { title: 'Privacy · PixelPulse', description: 'PixelPulse privacy.', alternates: { canonical: '/privacy' } };
const draft = { padding: '10px 14px', border: '1px dashed #f59e0b', borderRadius: 12, color: '#fbbf24', fontSize: 13 };
export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p style={draft}>Draft — pending legal review. This policy describes how the service works today and may change.</p>
      <p>You can try PixelPulse without signing in. You can also create an account (email sign-in link or Google) to keep your credits and images across devices. Here is what we store and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account data</b> (if you sign in): your email address and, with Google sign-in, the basic profile data Google shares (name/email). Used to sign you in and attach your credits and images to you.</li>
        <li><b>Anonymous identity cookie</b> (signed, random): links your images and credits to your browser when you are not signed in. It is never shown publicly.</li>
        <li><b>Credits &amp; settings</b>: your daily free-credit balance (cookie), your paid credit balance (our database), and preferences/favorites kept in your browser (localStorage).</li>
        <li><b>Your prompts, images, videos and uploads</b>, stored with our storage provider. Private items have unguessable links; items you publish are public.</li>
        <li><b>Generation log</b>: for safety and abuse prevention we keep a record of each creation request — the prompt, the tool used, references to the input/output files, the content-check result, and a one-way hash of your IP address (never the raw IP).</li>
        <li><b>Reports</b>: when you report content we store the reason, any details you write, and a one-way hash identifying the reporter (to prevent duplicate reports).</li>
        <li><b>Purchases</b>: payments are handled by Lemon Squeezy. We receive an order reference and which pack/plan was bought, never your card details.</li>
        <li><b>Technical data</b> such as IP address, used briefly for rate limiting and abuse prevention, and standard hosting logs.</li>
        <li><b>Usage analytics</b>: anonymous counts of how the site is used — page views, and steps such as typing a first prompt, starting a creation (which tool), whether it succeeded, opening pricing, starting checkout and completed purchases (pack/plan and amount). Visitors are counted with a one-way hash of the IP address and browser type that changes every day, so we can&apos;t recognise you across days. We don&apos;t store your prompts, email or raw IP address in analytics, and we don&apos;t use analytics cookies. We also use Vercel Web Analytics and Speed Insights, which are cookieless and receive page addresses with query strings removed.</li>
        <li><b>Error reports</b>: when something breaks in your browser or on our servers we record the error message, the technical stack trace, the page or API path and the app version, with emails, IP addresses, links&apos; query strings and long tokens removed. Repeats of the same error are counted, not stored again.</li>
      </ul>
      <h2>Who processes it</h2>
      <ul>
        <li><b>Supabase</b> — database, file storage and sign-in.</li>
        <li><b>Replicate</b> — runs the AI models; prompts and source images are sent to it to produce results and to run automated content-safety checks.</li>
        <li><b>Vercel</b> — website hosting, server logs, and cookieless Web Analytics / Speed Insights.</li>
        <li><b>Lemon Squeezy</b> — payments, tax and receipts (Merchant of Record).</li>
        <li><b>Google</b> — only if you choose Google sign-in. Some non-English prompts may be translated through the MyMemory translation service.</li>
      </ul>
      <p>These providers may process data outside your country, including in the United States. We don&apos;t sell personal data and don&apos;t use advertising trackers or analytics cookies.</p>
      <h2>How long we keep it</h2>
      <ul>
        <li>Images and videos: until you delete them or your account.</li>
        <li>Generation log and reports: [retention period — to be confirmed].</li>
        <li>Usage analytics: 13 months. Error reports: 90 days after the error was last seen.</li>
        <li>Content removed for safety reasons may be kept privately for longer where the law requires us to preserve it.</li>
      </ul>
      <h2>Your choices</h2>
      <ul>
        <li>Delete any image from <b>My Pulses</b> (removes the file and its record). Items under a safety review can&apos;t be deleted until the review ends.</li>
        <li>Clearing your cookies disconnects anonymous history from this browser.</li>
        <li>Contact us via the <a href="/contact">Contact</a> page for access, correction or deletion requests.</li>
      </ul>
    </LegalPage>
  );
}
