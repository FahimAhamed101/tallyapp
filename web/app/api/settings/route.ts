import { NextResponse, type NextRequest } from 'next/server';
import { handler, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/settings';
import { effectiveMethod } from '@/lib/route-utils';

/**
 * GET   /api/settings  -> the সেটিংস screen's state
 * PATCH /api/settings  -> flip a toggle, or set / clear the অ্যাপ সিকিউরিটি PIN
 *                        (also POST + X-HTTP-Method-Override: PATCH, because
 *                         the Android client cannot send PATCH)
 *
 * Like GET /api/profile, the view is returned **directly** rather than wrapped
 * in `{ settings }`, so the two app-shell reads have the same shape.
 *
 * There is no route that returns the PIN or its hash, by design. The only thing
 * a caller can learn about it is the `pinSet` boolean.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  return NextResponse.json(await getSettings(user));
});

async function patchSettings(req: NextRequest) {
  const { user } = await requireAuth(req);
  const body = await readJson(req);
  return NextResponse.json(await updateSettings(user, body));
}

export const PATCH = handler(patchSettings);

/** Verb-override alias — see the note in lib/route-utils.ts. */
export const POST = handler(async (req: NextRequest) => {
  if (effectiveMethod(req) === 'PATCH') return patchSettings(req);
  return NextResponse.json(
    { error: 'NOT_FOUND', message: `No route for POST ${req.nextUrl.pathname}` },
    { status: 404 },
  );
});
