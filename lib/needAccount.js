// Creating anything (an image, a video, an edit, an upload) needs an account. Browsing does not.
// Routes call accountGate() first: a visitor who is not signed in gets a 401 that tells the page to open the
// sign-in screen. The admin cookie passes, so the owner can still test without an account.
import { NextResponse } from 'next/server';
import { readAccount } from './account';
import { isAdmin } from './admin';

export const SIGN_IN_MSG = 'Sign up or sign in to create. You get 10 free credits every day.';

// Returns the 401 answer for a visitor without an account, or null when the request may go on.
export function accountGate(request) {
  if (isAdmin(request) || readAccount(request)) return null;
  return NextResponse.json({ error: SIGN_IN_MSG, needSignIn: true, credits: 0 }, { status: 401 });
}
