import { NextResponse, type NextRequest } from 'next/server';
import Transaction from '@/lib/models/Transaction';
import '@/lib/models/Customer';
import { badRequest, handler, notFound, parseAmount, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope, scopeFilter } from '@/lib/business';
import { entryView } from '@/lib/app-data';
import { effectiveMethod, type RouteContext } from '@/lib/route-utils';

/**
 * PATCH /api/transactions/:id  -> fix a ledger entry in place
 *
 * A shopkeeper writes "বাকি বেচা" against the wrong customer, or types ৫০০
 * where they meant ৫০০০, and until now the only cure was to write a second
 * entry cancelling the first — which leaves two rows where one fact belongs and
 * makes the ledger unreadable six months later.
 *
 * Only the keys actually present in the body are touched. That is deliberate:
 * the Android edit sheet sends the বিবরণ alone when only the বিবরণ changed, and
 * a "send everything" contract would let a stale client blank the amount or the
 * date it never looked at.
 *
 * Balances are derived from the entries (never stored), so changing `amount`
 * here is enough — the next read recomputes পাবো/দেবো from the corrected row.
 */

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<{ id: string }>;

async function patchEntry(req: NextRequest, ctx: Ctx) {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  const doc = await Transaction.findOne({
    ...scopeFilter(scope),
    _id: ctx.params.id,
  }).catch(() => null);
  if (!doc) throw notFound('লেনদেনটি পাওয়া যায়নি');

  const body = await readJson(req);

  if (body.description !== undefined) {
    doc.description = String(body.description ?? '').trim().slice(0, 500);
  }

  if (body.amount !== undefined) {
    // parseAmount tolerates Bengali digits and "৳ 1,250.50", exactly as the
    // create form does — an edit must not be stricter than the entry.
    const amt = parseAmount(body.amount);
    if (!Number.isFinite(amt) || amt <= 0) throw badRequest('সঠিক পরিমাণ দিন');
    doc.amount = amt;
  }

  if (body.date !== undefined && body.date !== null && body.date !== '') {
    const when = new Date(String(body.date));
    if (Number.isNaN(when.getTime())) throw badRequest('তারিখ সঠিক নয়');
    doc.date = when;
  }

  // The array wins when it is present: it is the real store, and photoUrl is
  // only a projection of its first element. Sent alone, photoUrl still works,
  // which is what keeps a client that predates the gallery from breaking.
  if (Array.isArray(body.photos)) {
    const list = body.photos
      .map((p: unknown) => String(p || '').trim())
      .filter(Boolean)
      .slice(0, 8);
    doc.photos = list;
    doc.photoUrl = list[0] || '';
    doc.hasPhoto = !!doc.photoUrl;
  } else if (body.photoUrl !== undefined) {
    doc.photoUrl = String(body.photoUrl || '').trim();
    // hasPhoto is what the list uses to decide whether to draw a thumbnail at
    // all, so it has to follow the URL rather than drift out of step with it.
    doc.hasPhoto = !!doc.photoUrl;
    doc.photos = doc.photoUrl ? [doc.photoUrl] : [];
  }
  if (body.photoPublicId !== undefined) {
    doc.photoPublicId = String(body.photoPublicId || '').trim();
  }

  await doc.save();

  return NextResponse.json({
    ok: true,
    entry: entryView(doc as unknown as Parameters<typeof entryView>[0]),
  });
}

export const PATCH = handler(patchEntry);

/**
 * Verb-override alias for the Android client: `HttpURLConnection` cannot send
 * PATCH, so it posts with `X-HTTP-Method-Override: PATCH`.
 */
export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  if (effectiveMethod(req) === 'PATCH') return patchEntry(req, ctx);
  return NextResponse.json(
    { error: 'NOT_FOUND', message: `No route for POST ${req.nextUrl.pathname}` },
    { status: 404 },
  );
});
