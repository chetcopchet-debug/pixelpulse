import { cookies } from 'next/headers';
import Studio from './studio/Studio';
import { ACCT_COOKIE } from '../lib/account';
import { ADMIN_COOKIE } from '../lib/admin';

// The studio: create images and video, browse your library, manage your credits.
// The page is told whether this browser carries an account (or admin) cookie, so the first paint is already the
// right one: a new visitor sees the headline at once, a signed-in person never sees it flash.
export default async function Home() {
  const jar = await cookies();
  return <Studio signedHint={Boolean(jar.get(ACCT_COOKIE) || jar.get(ADMIN_COOKIE))} />;
}
