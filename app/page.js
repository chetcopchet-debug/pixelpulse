export default function Home() {
  return (
    <div style={{ backgroundColor: '#09090b', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', textAlign: 'center', padding: '20px' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '10px', background: 'linear-gradient(to right, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        PixelPulse AI
      </h1>
      <p style={{ color: '#a1a1aa', fontSize: '1.2rem', marginBottom: '30px' }}>
        Create stunning AI images in seconds. Zero prompting needed.
      </p>
      <button style={{ backgroundColor: '#9333ea', color: 'white', padding: '15px 30px', fontSize: '1.1rem', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>
        Start Generating (5 Free Credits)
      </button>
    </div>
  );
}
