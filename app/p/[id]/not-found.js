import Page from '../../studio/Page';
export default function NotFound() {
  return (
    <Page>
      <div className="center">
        <h1>This image isn't available</h1>
        <p className="lead">It's private or it was deleted.</p>
        <a className="btn btn-p" href="/?tab=create">Make your own</a>
      </div>
    </Page>
  );
}
