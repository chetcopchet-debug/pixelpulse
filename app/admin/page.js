import { cookies } from 'next/headers';
import { isAdmin } from '../../lib/admin';
export const metadata = { title: 'PixelPulse', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const GRANT = { rate: 'Too many grants this hour.', amount: 'Enter a whole number from 1 to 2000.', email: 'That email does not look right.', noacct: 'No account with that email. The person has to sign in once first.', db: 'The database did not answer. Try again.' };
const field = { padding: '13px 16px', borderRadius: 999, border: '1px solid #2a2a40', background: '#101018', color: '#fff', fontSize: 15 };
const MSG = { key: 'Wrong key.', rate: 'Too many attempts — wait 10 minutes.', off: 'Admin is disabled.' };

export default async function AdminLogin(props) {
  const sp = await props.searchParams;
  const e = MSG[sp?.e];
  const admin = isAdmin({ cookies: await cookies() });
  const g = sp?.g;
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#07070a', color: '#e9e7f5', fontFamily: 'system-ui,sans-serif', padding: 16 }}>
      <form method="post" action="/api/admin" autoComplete="off" style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <b style={{ fontSize: 18 }}>◉ PixelPulse admin</b>
        <input name="key" type="password" required placeholder="Admin key" autoFocus
          style={{ padding: '13px 16px', borderRadius: 999, border: '1px solid #2a2a40', background: '#101018', color: '#fff', fontSize: 15 }} />
        <button type="submit" style={{ padding: 13, borderRadius: 999, border: 'none', background: 'linear-gradient(90deg,#9333ea,#ec4899)', color: '#fff', fontWeight: 800, fontSize: 15 }}>Enter</button>
        {e && <small style={{ color: '#f87171' }}>{e}</small>}
        {admin && <small style={{ color: '#5fd592' }}>Admin mode is on in this browser. <a href="/" style={{ color: '#5fd592' }}>Open the site</a></small>}
        <a href="/admin/reports" style={{ color: '#7c7c94', fontSize: 13, textAlign: 'center' }}>Reports queue →</a>
      </form>
      {admin && (
        <form method="post" action="/api/admin/grant" autoComplete="off" style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
          <b style={{ fontSize: 16 }}>Add paid credits</b>
          <small style={{ color: '#a1a1b5', lineHeight: 1.5 }}>For testing or support. Leave the email empty to add them to this browser. Then log out of admin below, because admin mode never spends credits.</small>
          <input name="amount" type="number" inputMode="numeric" min="1" max="2000" required placeholder="How many credits (1 to 2000)" style={field} />
          <input name="email" type="email" placeholder="Account email (optional)" style={field} />
          <button type="submit" style={{ padding: 13, borderRadius: 999, border: '1px solid #2a2a40', background: '#fff', color: '#000', fontWeight: 800, fontSize: 15 }}>Add credits</button>
          {g === 'ok' && <small style={{ color: '#5fd592' }}>Added {String(sp?.n || '').replace(/\D/g, '')} credits to {sp?.t === 'email' ? 'that account' : 'this browser'}. Paid balance now: {String(sp?.b || '').replace(/\D/g, '')}.</small>}
          {g && g !== 'ok' && GRANT[g] && <small style={{ color: '#f87171' }}>{GRANT[g]}</small>}
        </form>
      )}
      <form method="post" action="/api/admin" style={{ position: 'fixed', bottom: 16 }}>
        <input type="hidden" name="logout" value="1" />
        <button type="submit" style={{ background: 'none', border: 'none', color: '#7c7c94', textDecoration: 'underline' }}>Log out of admin</button>
      </form>
    </main>
  );
}
