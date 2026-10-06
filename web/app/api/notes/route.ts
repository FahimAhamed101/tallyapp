import { NextResponse, type NextRequest } from 'next/server';
import Note from '@/lib/models/Note';
import { badRequest, handler, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope } from '@/lib/business';
import { noteView, type NoteLike } from '@/lib/notes';
import { scopeFilter } from '@/lib/scope';
import { formatZodError, noteCreateSchema } from '@/lib/validators';

/**
 * GET  /api/notes   -> the ব্যবসার নোট checklist for this book, newest first
 * POST /api/notes   -> add one line
 *
 * Scoped to one book via the optional `X-Business-Id` header, like stock.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  const notes = await Note.find(scopeFilter(scope)).sort({ createdAt: -1, _id: -1 }).lean();
  const items = notes.map((n) => noteView(n as unknown as NoteLike));

  return NextResponse.json({
    items,
    total: items.length,
    pending: items.filter((n) => !n.done).length,
  });
});

export const POST = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { business } = await resolveScope(req, user);

  const parsed = noteCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const doc = await Note.create({
    owner: user._id,
    business: business._id,
    text: parsed.data.text,
    done: parsed.data.done ?? false,
  });

  return NextResponse.json({ note: noteView(doc as unknown as NoteLike) }, { status: 201 });
});
