import { NextResponse, type NextRequest } from 'next/server';
import User from '@/lib/models/User';
import { badRequest, handler, readJson, unauthorized } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { changePasswordSchema, formatZodError } from '@/lib/validators';

/** POST /api/auth/password — change password, keeping the caller logged in. */

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest) => {
  const { user, tokenHash } = await requireAuth(req);

  const body = await readJson(req);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  if (!User.verifyPassword(user, parsed.data.currentPassword)) {
    throw unauthorized('বর্তমান পাসওয়ার্ড সঠিক নয়');
  }

  User.setPassword(user, parsed.data.newPassword);
  // Keep this device signed in; drop every other session.
  // `set()` because the inferred `sessions` type is a DocumentArray.
  user.set(
    'sessions',
    (user.sessions || []).filter((s) => s.hash === tokenHash),
  );
  await user.save();

  return NextResponse.json({ ok: true });
});
