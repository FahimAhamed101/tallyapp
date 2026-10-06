import { NextResponse, type NextRequest } from 'next/server';
import type { HydratedDocument } from 'mongoose';
import Business, { type BusinessDoc } from '@/lib/models/Business';
import { badRequest, conflict, handler, notFound, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import {
  businessView,
  deleteBusinessCascade,
  promoteOldestIfNeeded,
} from '@/lib/business';
import { businessUpdateSchema, formatZodError } from '@/lib/validators';
import { effectiveMethod, type RouteContext } from '@/lib/route-utils';
import type { UserDoc } from '@/lib/models/User';

/**
 * PATCH  /api/businesses/:id   -> rename, or promote to primary
 * DELETE /api/businesses/:id   -> remove the book and everything in it
 *
 * PATCH is also reachable as POST + X-HTTP-Method-Override, which is how the
 * Android client sends it (`HttpURLConnection` cannot send PATCH).
 */

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<{ id: string }>;

/** Loads a business belonging to `user`, or throws 404. */
async function ownBusiness(user: UserDoc, id: string): Promise<HydratedDocument<BusinessDoc>> {
  const doc = await Business.findOne({ _id: id, owner: user._id }).catch(() => null);
  if (!doc) throw notFound('ব্যবসাটি পাওয়া যায়নি');
  return doc as HydratedDocument<BusinessDoc>;
}

async function patchBusiness(req: NextRequest, ctx: Ctx) {
  const { user } = await requireAuth(req);
  const doc = await ownBusiness(user, ctx.params.id);

  const body = await readJson(req);
  const parsed = businessUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const { name, isPrimary } = parsed.data;
  if (name !== undefined) doc.name = name;

  if (isPrimary === true && !doc.isPrimary) {
    // Exactly one primary per account, so demote the incumbent first. Without
    // this a later `ensurePrimaryBusiness` could pick either one.
    await Business.updateMany(
      { owner: user._id, _id: { $ne: doc._id } },
      { $set: { isPrimary: false } },
    );
    doc.isPrimary = true;
  }

  await doc.save();
  return NextResponse.json({ business: businessView(doc) });
}

export const PATCH = handler(patchBusiness);

/** Verb-override alias for the Android client. */
export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  if (effectiveMethod(req) === 'PATCH') return patchBusiness(req, ctx);
  return NextResponse.json(
    { error: 'NOT_FOUND', message: `No route for POST ${req.nextUrl.pathname}` },
    { status: 404 },
  );
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  const { user } = await requireAuth(req);
  const doc = await ownBusiness(user, ctx.params.id);

  // An account must always keep at least one book, otherwise there is nothing
  // for `resolveBusiness` to fall back to and every screen would 404.
  const remaining = await Business.countDocuments({ owner: user._id });
  if (remaining <= 1) throw conflict('শেষ ব্যবসাটি মুছে ফেলা যাবে না');

  const wasPrimary = !!doc.isPrimary;
  const removed = await deleteBusinessCascade(user._id, doc._id);
  await doc.deleteOne();

  // Keep the invariant: if the primary went away, the oldest survivor takes over.
  if (wasPrimary) await promoteOldestIfNeeded(user._id);

  return NextResponse.json({ ok: true, deletedId: ctx.params.id, removed });
});
