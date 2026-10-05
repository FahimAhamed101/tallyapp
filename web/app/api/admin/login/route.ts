import { NextResponse, type NextRequest } from 'next/server';
import { dbConnect } from '@/lib/mongodb';
import User from '@/lib/models/User';
import { badRequest, forbidden, handler, readJson, unauthorized } from '@/lib/api-helpers';
import { SESSION_COOKIE } from '@/lib/auth';
import { formatZodError, loginSchema } from '@/lib/validators';

/**
 * POST /api/admin/login  { phone, password }
 *
 * The panel's own sign-in. Same credential check as /api/auth/login, but it
 * refuses anyone whose `role` is not 'admin' — and it never returns a bearer
 * token, because the panel is cookie-only.
 */

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest) => {
  await dbConnect();

  const body = await readJson(req);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const identifier = String(
    parsed.data.phone || parsed.data.email || parsed.data.identifier || '',
  ).trim();

  let user = null;
  if (identifier.includes('@')) {
    user = await User.findOne({ email: identifier.toLowerCase() });
  } else if (identifier.toLowerCase() === 'admin') {
    user = await User.findOne({ role: 'admin' });
  } else {
    const cleanPhone = User.normalizePhone(identifier);
    user = (await User.findOne({ phone: cleanPhone })) || (await User.findOne({ phone: identifier }));
    if (!user) {
      user = await User.findOne({ email: identifier.toLowerCase() });
    }
  }

  // Same message either way, so the endpoint cannot be used to enumerate accounts.
  if (!user || !User.verifyPassword(user, parsed.data.password)) {
    throw unauthorized('নম্বর বা পাসওয়ার্ড সঠিক নয়');
  }
  if (user.disabled) throw forbidden('এই অ্যাকাউন্টটি বন্ধ করা হয়েছে');
  if (user.role !== 'admin') throw forbidden('এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই');

  const token = User.issueToken(user);
  await user.save();

  const res = NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      name: user.name,
      phone: user.phone,
      email: user.email || '',
      role: user.role,
    },
  });

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Number(process.env.AUTH_TOKEN_TTL_DAYS || 90) * 86400,
  });

  return res;
});
