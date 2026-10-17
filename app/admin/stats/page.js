import StatsDashboard from './StatsDashboard';
export const metadata = { title: 'Stats · PixelPulse', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default function Page() { return <StatsDashboard />; }
