import { cookies } from 'next/headers';
import { dbConnect } from './mongodb';
import User, { type UserDoc } from './models/User';
import { HttpError, forbidden, unauthorized } from './api-helpers';

/**
 * Auth for the Next.js port — a port of backend/src/lib/auth.js, extended with
 * a cookie session so the browser-based admin panel can log in.
 *
 * Two credential carriers are supported on purpose:
 *
 *   1. `Authorization: Bearer <token>` — what the Android app sends. Kept
 *      byte-for-byte identical so the existing APK keeps working untouched.
 *   2. `tally_session` httpOnly cookie — set by the web login form. A browser
 *      cannot easily attach a bearer header to a navigation request, so the
 *      admin panel needs this.
 *
 * Both resolve to the same `User` document via the same SHA-256 token hash.
 */

export const SESSION_COOKIE = 'tally_session';

/** Pulls a raw token out of `Authorization: Bearer <token>`. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** Reads the raw session token from the request cookie, if present. */
export function cookieToken(req?: Request): string | null {
  // Prefer the request's own Cookie header when we have a Request object —
  // `cookies()` is only readable inside a request scope and this helper is
  // also called from route handlers where `req` is available.
  if (req) {
    const raw = req.headers.get('cookie') || '';
    const match = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(raw);
    if (match) return decodeURIComponent(match[1]);
  }
  try {
    return cookies().get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export interface AuthContext {
  user: UserDoc;
  tokenHash: string;
  via: 'bearer' | 'cookie';
}

/**
 * Resolves the caller from their bearer token or session cookie. Every data
 * route sits behind this, which is what makes each account see only its own
 * customers and ledger.
 */
export async function resolveAuth(req: Request): Promise<AuthContext> {
  await dbConnect();

  const bearer = bearerToken(req);
  const token = bearer || cookieToken(req);
  if (!token) throw unauthorized('লগইন প্রয়োজন');

  const hash = User.hashToken(token);
  const user = (await User.findOne({ 'sessions.hash': hash })) as UserDoc | null;
  if (!user) throw unauthorized('সেশন শেষ হয়ে গেছে, আবার লগইন করুন');
  if (user.disabled) throw forbidden('এই অ্যাকাউন্টটি বন্ধ করা হয়েছে');

  return { user, tokenHash: hash, via: bearer ? 'bearer' : 'cookie' };
}

/** Route-handler guard for the Android-facing endpoints. */
export async function requireAuth(req: Request): Promise<AuthContext> {
  return resolveAuth(req);
}

/**
 * Panel guard. Requires an authenticated caller AND `role === 'admin'`.
 *
 * The role check lives here, on the server, so hiding admin links in the UI is
 * never the thing that protects the data.
 */
export async function requireAdmin(req: Request): Promise<AuthContext> {
  const ctx = await resolveAuth(req);
  if (ctx.user.role !== 'admin') {
    throw forbidden('এই কাজটি শুধু অ্যাডমিন করতে পারেন');
  }
  return ctx;
}

/** Non-throwing variant used by pages/layouts that redirect instead of 401. */
export async function getSession(): Promise<UserDoc | null> {
  try {
    await dbConnect();
    const token = cookieToken();
    if (!token) return null;
    const user = (await User.findOne({
      'sessions.hash': User.hashToken(token),
    })) as UserDoc | null;
    if (!user || user.disabled) return null;
    return user;
  } catch {
    return null;
  }
}

/** Non-throwing admin variant for the guarded panel layout. */
export async function getAdminSession(): Promise<UserDoc | null> {
  const user = await getSession();
  return user && user.role === 'admin' ? user : null;
}

export { HttpError, unauthorized, forbidden };
