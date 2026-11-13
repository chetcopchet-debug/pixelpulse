import Page from "../../studio/Page";
import { getT } from "../../i18n/server";
import Callback from "./Callback";

// Where the emailed link and Google send people back to.
export default async function AuthCallback() {
  const { t, lang } = await getT();
  const words = {
    busy: t("Signing you in…"),
    old: t("This sign-in link is no longer valid. Ask for a new one."),
    failed: t("Sign-in didn't work. Try again."),
    offline: t("Sign-in didn't work. Check your connection and try again."),
    again: t("Try again"),
  };
  return <Page bare><Callback words={words} english={lang === "en"} /></Page>;
}
