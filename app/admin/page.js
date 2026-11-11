import { cookies } from 'next/headers';
import { isAdmin, adminEnabled } from '../../lib/admin';
import { setupChecks, googleEnabled, deploymentKind } from '../../lib/setup';
import Page from '../studio/Page';
export const metadata = { title: 'Admin · PixelPulse', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const GRANT = { rate: 'Too many grants this hour.', amount: 'Enter a whole number from 1 to 2000.', email: 'That email does not look right.', noacct: 'No account with that email. The person has to sign in once first.', db: 'The database did not answer. Try again.' };
const MSG = { key: 'Wrong key.', rate: 'Too many attempts. Wait 10 minutes.', off: 'Admin is switched off in this deployment: it was built without ADMIN_KEY. See the setup check below.' };

export default async function AdminLogin(props) {
  const sp = await props.searchParams;
  const e = MSG[sp?.e];
  const enabled = adminEnabled();
  const admin = isAdmin({ cookies: await cookies() });
  const g = sp?.g;
  // The setup check is shown to the admin, and to anyone only while admin can't be opened at all
  // (that is exactly when the owner needs to see what is missing). It lists names, never values.
  const showSetup = admin || !enabled;
  const checks = showSetup ? setupChecks() : [];
  const google = showSetup ? await googleEnabled() : false;
  const kind = deploymentKind();
  return (
    <Page bare>
      <h1>Admin</h1>

      {enabled ? (
        <form className="form" method="post" action="/api/admin" autoComplete="off" style={{ marginTop: 16 }}>
          <input className="field" name="key" type="password" required placeholder="Admin key" aria-label="Admin key" />
          <button className="btn btn-p" type="submit">Enter</button>
          {e && <p className="sm bad" role="alert">{e}</p>}
          {admin && <p className="sm ok">Admin mode is on in this browser. Nothing is charged while it is on. <a className="link" href="/">Open the site</a></p>}
        </form>
      ) : (
        <p className="notice" style={{ marginTop: 16 }} role="alert">Admin is switched off here because this deployment has no ADMIN_KEY. Add it in Vercel for this environment ({kind}), then redeploy: a deployment only sees the settings that existed when it was built.</p>
      )}

      {admin && (
        <>
          <h2 className="sec">Add bought credits</h2>
          <form className="form" method="post" action="/api/admin/grant" autoComplete="off">
            <p className="sm t2">For testing or support. Leave the email empty to add them to this browser. Then log out of admin below, because admin mode never spends credits.</p>
            <input className="field" name="amount" type="number" inputMode="numeric" min="1" max="2000" required placeholder="How many credits (1 to 2000)" aria-label="How many credits" />
            <input className="field" name="email" type="email" placeholder="Account email (optional)" aria-label="Account email (optional)" />
            <button className="btn btn-s" type="submit">Add credits</button>
            {g === 'ok' && <p className="sm ok" role="status">Added {String(sp?.n || '').replace(/\D/g, '')} credits to {sp?.t === 'email' ? 'that account' : 'this browser'}. Bought balance now: {String(sp?.b || '').replace(/\D/g, '')}.</p>}
            {g && g !== 'ok' && GRANT[g] && <p className="sm bad" role="alert">{GRANT[g]}</p>}
          </form>
        </>
      )}

      {showSetup && (
        <>
          <h2 className="sec">Setup check</h2>
          <p className="sm t2" style={{ marginBottom: 10 }}>This deployment is a <b>{kind}</b> build. Each line is a setting it was built with. A missing one has to be added in Vercel (Settings, Environment Variables) with "{kind === 'production' ? 'Production' : 'Preview'}" ticked, followed by a new deployment.</p>
          <div className="ptable">
            {checks.map((c) => (
              <div key={c.name}>
                <span className="grow"><span className="b">{c.name}</span><span className="sm t2" style={{ display: 'block' }}>{c.ok ? c.why : `Missing: ${c.missing.join(', ')}. ${c.why}`}</span></span>
                <span className={`b sm ${c.ok ? 'ok' : c.optional ? 't3' : 'bad'}`}>{c.ok ? 'Set' : c.optional ? 'Not set' : 'Missing'}</span>
              </div>
            ))}
            <div>
              <span className="grow"><span className="b">Google sign-in</span><span className="sm t2" style={{ display: 'block' }}>{google ? 'Switched on in Supabase. The Google button is shown.' : 'Supabase did not report Google as switched on, so the button is hidden. Check Supabase, Authentication, Sign In / Providers, Google.'}</span></span>
              <span className={`b sm ${google ? 'ok' : 't3'}`}>{google ? 'On' : 'Off'}</span>
            </div>
          </div>
          {kind !== 'production' && <p className="sm t2" style={{ marginTop: 10 }}>Sign-in on a preview also needs this address pattern in Supabase (Authentication, URL Configuration, Redirect URLs): <b>https://*-caissa3.vercel.app/**</b></p>}
        </>
      )}

      <div className="r" style={{ gap: 20, marginTop: 28, flexWrap: 'wrap' }}>
        <a className="link sm r" style={{ minHeight: 44 }} href="/admin/reports">Reports queue</a>
        {admin && <form method="post" action="/api/admin"><input type="hidden" name="logout" value="1" /><button className="link sm t2" style={{ minHeight: 44 }} type="submit">Log out of admin</button></form>}
      </div>
    </Page>
  );
}
