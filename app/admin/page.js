export const metadata = { title: 'PixelPulse', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MSG = { key: 'Wrong key.', rate: 'Too many attempts — wait 10 minutes.', off: 'Admin is disabled.' };

export default async function AdminLogin(props) {
  const sp = await props.searchParams;
  const e = MSG[sp?.e];
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#07070a', color: '#e9e7f5', fontFamily: 'system-ui,sans-serif', padding: 16 }}>
      <form method="post" action="/api/admin" autoComplete="off" style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <b style={{ fontSize: 18 }}>◉ PixelPulse admin</b>
        <input name="key" type="password" required placeholder="Admin key" autoFocus
          style={{ padding: '13px 16px', borderRadius: 999, border: '1px solid #2a2a40', background: '#101018', color: '#fff', fontSize: 15 }} />
        <button type="submit" style={{ padding: 13, borderRadius: 999, border: 'none', background: 'linear-gradient(90deg,#9333ea,#ec4899)', color: '#fff', fontWeight: 800, fontSize: 15 }}>Enter</button>
        {e && <small style={{ color: '#f87171' }}>{e}</small>}
      </form>
      <form method="post" action="/api/admin" style={{ position: 'fixed', bottom: 16 }}>
        <input type="hidden" name="logout" value="1" />
        <button type="submit" style={{ background: 'none', border: 'none', color: '#7c7c94', textDecoration: 'underline' }}>Log out of admin</button>
      </form>
    </main>
  );
}
