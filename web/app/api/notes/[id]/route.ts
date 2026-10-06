import { NextResponse, type NextRequest } from 'next/server';
import Note from '@/lib/models/Note';
import { badRequest, handler, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope } from '@/lib/business';
import { findNote, noteView, type NoteLike } from '@/lib/notes';
import { scopeFilter } from '@/lib/scope';
import { formatZodError, noteUpdateSchema } from '@/lib/validators';
import { effectiveMethod, type RouteContext } from '@/lib/route-utils';

/**
 * PATCH  /api/notes/:id   -> edit the text or tick / untick it
 * DELETE /api/notes/:id   -> remove the line
 *
 * PATCH is also reachable as POST + X-HTTP-Method-Override, which is how the
 * Android client sends it (`HttpURLConnection` cannot send PATCH).
 */

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<{ id: string }>;

async function patchNote(req: NextRequest, ctx: Ctx) {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  const doc = await findNote(scope, ctx.params.id);
  const parsed = noteUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  // Only the keys actually sent are touched, so ticking cannot blank the text.
  if (parsed.data.text !== undefined) doc.text = parsed.data.text;
  if (parsed.data.done !== undefined) doc.done = parsed.data.done;
  await doc.save();

  return NextResponse.json({ note: noteView(doc as unknown as NoteLike) });
}

export const PATCH = handler(patchNote);

/** Verb-override alias for the Android client. */
export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  if (effectiveMethod(req) === 'PATCH') return patchNote(req, ctx);
  return NextResponse.json(
    { error: 'NOT_FOUND', message: `No route for POST ${req.nextUrl.pathname}` },
    { status: 404 },
  );
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  await findNote(scope, ctx.params.id);
  await Note.deleteOne({ ...scopeFilter(scope), _id: ctx.params.id });

  return NextResponse.json({ ok: true, deletedId: ctx.params.id });
});
