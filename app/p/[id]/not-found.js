export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#07070a', color: '#e9e7f5', fontFamily: 'system-ui', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
      <div><h1 style={{ fontSize: 20 }}>This pulse faded out</h1><p style={{ color: '#7c7c94' }}>The image is private or no longer exists.</p>
        <a href="/" style={{ display: 'inline-block', marginTop: 10, padding: '11px 20px', borderRadius: 999, background: 'linear-gradient(90deg,#9333ea,#ec4899)', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Make your own</a></div>
    </div>
  );
}
