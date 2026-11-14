import { LegalPage } from '../_legal/Legal';
import { LEGAL_NAME, LEGAL_COUNTRY, MIN_AGE, CONTACT_EMAIL } from '../../lib/site';
export const metadata = { title: 'Privacy · Yelvo', description: 'Yelvo privacy.', alternates: { canonical: '/privacy' } };
export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Yelvo is operated {LEGAL_NAME ? <>by <b>{LEGAL_NAME}</b>, </> : null}from {LEGAL_COUNTRY}. You can look around without an account; creating needs one. Here is what we store, why, and who else handles it.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Your email address</b>, when you sign up: used to sign you in and to keep your credits and library with your account. If you sign in with Google, Google tells our sign-in provider your email address, name and profile picture; we use only the email address. We never receive your Google password.</li>
        <li><b>Your prompts, images, videos and uploads.</b> They are stored so you can see them in your library, and are shown only there. Their file links are long and unguessable.</li>
        <li><b>A creation log.</b> For every creation we record the account or device id, a hashed IP address, the prompt, references to the input and the result, the outcome of the safety check and the time. It is used to prevent abuse, to handle reports and to answer lawful requests.</li>
        <li><b>Purchases.</b> When you buy, our payment provider collects your payment details. We receive only what we need to add your credits and handle refunds: the order number, the product, the amount, and the email address used at checkout. We never see your card details.</li>
        <li><b>Cookies.</b> A signed cookie that keeps you signed in, a signed random identity cookie that links creations to your browser, and cookies for your language and credit balance. Preferences and favorites are kept in your browser. We don't use advertising or tracking cookies.</li>
        <li><b>Technical data</b> such as IP address, used briefly for rate limiting and abuse prevention, and standard hosting logs.</li>
      </ul>
      <h2>Who processes it</h2>
      <ul>
        <li><b>AI models (Replicate).</b> Images and videos are made by models hosted on Replicate, from companies such as Google, OpenAI, Black Forest Labs, ByteDance and Kuaishou. Your prompt, and any image you start from, is sent to the model you choose in order to produce the result.</li>
        <li><b>Language models.</b> Prompts in other languages are translated to English before they are sent, and the improve button rewrites a prompt, using a language model hosted on Replicate (or, as a backup for translation only, the MyMemory translation service). When you ask for a prompt to be written from an attached image, that image is sent to the language model so it can look at it.</li>
        <li><b>Safety checks.</b> Prompts are screened, and results and the images a video starts from are checked automatically for prohibited content by a classifier hosted on Replicate.</li>
        <li><b>Storage and sign-in (Supabase)</b> and <b>hosting (Vercel)</b>.</li>
        <li><b>Payments.</b> Our payment provider, named at checkout and on your receipt, acts as the seller of record and handles your payment under its own privacy policy.</li>
      </ul>
      <p>These providers may process data in the United States, the European Union and other countries. We don't sell personal data and don't use advertising trackers.</p>
      <h2>How long we keep it</h2>
      <ul>
        <li>Your images, videos and uploads: until you delete them or delete your account.</li>
        <li>Your account and email address: until you delete your account.</li>
        <li>The record of past payments is kept without your email address after an account is deleted, because bookkeeping and refunds need it.</li>
        <li>The creation log and records about blocked content are kept after deletion for as long as they are needed for safety, disputes and legal duties.</li>
      </ul>
      <h2>Your choices</h2>
      <ul>
        <li>Delete any image or video from your <b>Library</b> (removes the file and its record).</li>
        <li>Delete your account from your profile ("Delete account"). This removes everything you made, your uploads, your unused credits and your sign-in. It cannot be undone.</li>
        <li>Email <a href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20request`}>{CONTACT_EMAIL}</a> to ask what we hold about you, to correct it or to have it deleted.</li>
      </ul>
      <h2>Age</h2>
      <p>Yelvo is for people aged {MIN_AGE} and over. We don't knowingly collect data from anyone younger; if you believe someone under {MIN_AGE} has an account, write to us and we will remove it.</p>
      <h2>Changes</h2>
      <p>We may update this policy; the date at the top shows the latest version.</p>
    </LegalPage>
  );
}
