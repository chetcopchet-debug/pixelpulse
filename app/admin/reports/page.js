import Frame from '../../studio/Page';
import ReportsQueue from './ReportsQueue';
export const metadata = { title: 'Reports · PixelPulse', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default function Page() { return <Frame bare wide><ReportsQueue /></Frame>; }
