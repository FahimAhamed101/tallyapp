import { NextResponse, type NextRequest } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { badRequest, handler, readJson, unauthorized } from '@/lib/api-helpers';
import { getProfile, getWallet } from '@/lib/app-data';
import { formatZodError, loginSchema } from '@/lib/validators';

/**
 * POST /api/auth/login  { phone, password }
 *
 * Also sets the `tally_session` httpOnly cookie when the caller is a browser,
 * so the same endpoint serves both the Android app (bearer token) and the web
 * admin panel (cookie session). The Android client simply ignores Set-Cookie.
 */

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest) => {
  await dbConnect();

  const body = await readJson(req);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const cleanPhone = User.normalizePhone(parsed.data.phone);
  const user = await User.findOne({ phone: cleanPhone });

  // Same message either way, so the endpoint cannot be used to enumerate accounts.
  if (!user || !User.verifyPassword(user, parsed.data.password)) {
    throw unauthorized('নম্বর বা পাসওয়ার্ড সঠিক নয়');
  }

  const token = User.issueToken(user);
  await user.save();
  await Promise.all([getProfile(user), getWallet(user._id)]);

  const res = NextResponse.json({ token, user: User.publicView(user) });

  // Browser session. httpOnly so no script can read it; sameSite lax so a
  // top-level navigation to /admin carries it.
  res.cookies.set('tally_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Number(process.env.AUTH_TOKEN_TTL_DAYS || 90) * 86400,
  });

  return res;
});
