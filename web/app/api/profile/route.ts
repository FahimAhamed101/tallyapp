import { NextResponse, type NextRequest } from 'next/server';
import Profile from '@/lib/models/Profile';
import User from '@/lib/models/User';
import { badRequest, conflict, handler, notFound, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/app-data';
import { effectiveMethod } from '@/lib/route-utils';

/**
 * GET   /api/profile  -> the gold toolbar's shop profile
 * PATCH /api/profile  -> edit it (also POST + X-HTTP-Method-Override: PATCH,
 *                        because the Android client cannot send PATCH)
 *
 * This is also the write behind সেটিংস → প্রোফাইল সেটিংস → মোবাইল নম্বর পরিবর্তন:
 * the number is the login credential, so it is validated and de-duplicated here
 * rather than in a route of its own.
 */

export const dynamic = 'force-dynamic';

const EDITABLE = [
  'name',
  'phone',
  'initials',
  'photoUrl',
  'goldPlanName',
  'goldTrialDays',
  'inboxUnread',
  'smsRemaining',
  'appVersion',
] as const;

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  return NextResponse.json(await getProfile(user));
});

async function patchProfile(req: NextRequest) {
  const { user } = await requireAuth(req);
  const body = await readJson(req);

  // মোবাইল নম্বর পরিবর্তন. Normalise to the canonical `+8801…` form before it
  // reaches either document, and refuse a number another account already owns:
  // `User.phone` is unique, so without this check the clash surfaces as a raw
  // 500 from the index instead of a message the shopkeeper can act on. A blank
  // phone is left alone — it must never be able to wipe the login credential.
  if (typeof body.phone === 'string' && body.phone.trim()) {
    const normalized = User.normalizePhone(body.phone);
    if (!User.isValidPhone(normalized)) {
      throw badRequest('সঠিক মোবাইল নম্বর দিন');
    }
    const clash = await User.findOne({ phone: normalized, _id: { $ne: user._id } });
    if (clash) throw conflict('এই নম্বরটি অন্য একটি অ্যাকাউন্টে ব্যবহৃত হচ্ছে');
    body.phone = normalized;
  }

  let doc = await Profile.findOne({ owner: user._id });
  if (!doc) {
    await getProfile(user); // self-heal
    doc = await Profile.findOne({ owner: user._id });
  }
  if (!doc) throw notFound('প্রোফাইল পাওয়া যায়নি');

  EDITABLE.forEach((k) => {
    if (body[k] !== undefined) {
      (doc as unknown as Record<string, unknown>)[k] = body[k];
    }
  });
  await doc.save();

  // Keep the account record in step with the shop profile.
  const touched =
    body.name !== undefined || body.phone !== undefined || body.photoUrl !== undefined;
  if (touched) {
    if (body.name !== undefined) user.name = String(body.name).trim() || user.name;
    if (body.phone !== undefined) user.phone = String(body.phone).trim() || user.phone;
    if (body.photoUrl !== undefined) user.photoUrl = String(body.photoUrl || '').trim();
    await user.save();
  }

  return NextResponse.json(await getProfile(user));
}

export const PATCH = handler(patchProfile);

/** Verb-override alias — see the note in lib/route-utils.ts. */
export const POST = handler(async (req: NextRequest) => {
  if (effectiveMethod(req) === 'PATCH') return patchProfile(req);
  return NextResponse.json(
    { error: 'NOT_FOUND', message: `No route for POST ${req.nextUrl.pathname}` },
    { status: 404 },
  );
});
