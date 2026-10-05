import { NextResponse, type NextRequest } from 'next/server';
import User from '@/lib/models/User';
import { handler } from '@/lib/api-helpers';
import { resolveAuth, SESSION_COOKIE } from '@/lib/auth';

/** POST /api/admin/logout — revokes this session and clears the cookie. */

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest) => {
  const { user, tokenHash } = await resolveAuth(req);
  User.revokeToken(user, tokenHash);
  await user.save();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
