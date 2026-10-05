import { NextResponse, type NextRequest } from 'next/server';
import User from '@/lib/models/User';
import { handler } from '@/lib/api-helpers';
import { requireAuth, SESSION_COOKIE } from '@/lib/auth';

/**
 * POST /api/auth/logout — drops only the calling device's session, and clears
 * the browser cookie if there is one.
 */

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest) => {
  const { user, tokenHash } = await requireAuth(req);
  User.revokeToken(user, tokenHash);
  await user.save();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
