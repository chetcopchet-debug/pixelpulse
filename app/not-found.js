import Page from './studio/Page';
import { getT } from './i18n/server';
export const metadata = { title: 'Page not found · Yelvo' };
export default async function NotFound() {
  const { t } = await getT();
  return (
    <Page>
      <div className="center">
        <h1>{t("This page doesn't exist")}</h1>
        <p className="lead">{t("The link may be old or mistyped.")}</p>
        <a className="btn btn-p" href="/">{t("Go to Yelvo")}</a>
      </div>
    </Page>
  );
}
