import Page from './studio/Page';
export const metadata = { title: 'Page not found · PixelPulse' };
export default function NotFound() {
  return (
    <Page>
      <div className="center">
        <h1>This page doesn't exist</h1>
        <p className="lead">The link may be old or mistyped.</p>
        <a className="btn btn-p" href="/">Go to PixelPulse</a>
      </div>
    </Page>
  );
}
