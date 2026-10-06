import { NextResponse, type NextRequest } from 'next/server';
import Business from '@/lib/models/Business';
import { badRequest, conflict, handler, isObjectId, notFound, readJson } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { businessView, deleteBusinessCascade, promoteOldestIfNeeded } from '@/lib/business';
import { businessUpdateSchema, formatZodError } from '@/lib/validators';

/**
 * PATCH  /api/admin/businesses/:id  -> rename, or promote to primary
 * DELETE /api/admin/businesses/:id  -> remove the book and everything in it
 *
 * Admin only, and not owner-scoped: an admin acts on any account's book.
 *
 * Both verbs go through the *same* cascade the owner-facing route uses, so the
 * panel can never leave orphaned documents or stranded Cloudinary images that a
 * user-initiated delete would have cleaned up.
 */

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

async function load(id: string) {
  if (!isObjectId(id)) throw notFound('ব্যবসাটি পাওয়া যায়নি');
  const doc = await Business.findById(id);
  if (!doc) throw notFound('ব্যবসাটি পাওয়া যায়নি');
  return doc;
}

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);
  const doc = await load(ctx.params.id);

  const body = await readJson(req);
  const parsed = businessUpdateSchema.safeParse(body);
  if (!parsed.success) throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));

  const { name, isPrimary } = parsed.data;
  if (name !== undefined) doc.name = name;

  if (isPrimary === true && !doc.isPrimary) {
    // Exactly one primary per account — demote the incumbent first, or a later
    // `ensurePrimaryBusiness` could pick either one.
    await Business.updateMany(
      { owner: doc.owner, _id: { $ne: doc._id } },
      { $set: { isPrimary: false } },
    );
    doc.isPrimary = true;
  }

  await doc.save();
  return NextResponse.json({ ok: true, business: businessView(doc) });
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);
  const doc = await load(ctx.params.id);

  // The same invariant the owner-facing route enforces. It is about the
  // account's ability to resolve *some* book, so it holds whoever is deleting:
  // without a surviving book every screen on that account would 404.
  const remaining = await Business.countDocuments({ owner: doc.owner });
  if (remaining <= 1) throw conflict('শেষ ব্যবসাটি মুছে ফেলা যাবে না');

  const wasPrimary = !!doc.isPrimary;
  const owner = doc.owner;
  const removed = await deleteBusinessCascade(owner, doc._id);
  await doc.deleteOne();

  if (wasPrimary) await promoteOldestIfNeeded(owner);

  return NextResponse.json({ ok: true, deletedId: ctx.params.id, removed });
});
