import { NextResponse, type NextRequest } from 'next/server';
import Profile from '@/lib/models/Profile';
import { handler, notFound, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/app-data';
import { effectiveMethod } from '@/lib/route-utils';

/**
 * GET   /api/profile  -> the gold toolbar's shop profile
 * PATCH /api/profile  -> edit it (also POST + X-HTTP-Method-Override: PATCH,
 *                        because the Android client cannot send PATCH)
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
