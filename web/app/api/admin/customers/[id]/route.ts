import { NextResponse, type NextRequest } from 'next/server';
import Customer from '@/lib/models/Customer';
import Transaction from '@/lib/models/Transaction';
import { badRequest, handler, isObjectId, notFound, readJson } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { balanceFor, customerView, ledgerHeadline } from '@/lib/ledger';
import { destroyImage } from '@/lib/cloudinary';
import { entryView } from '@/lib/app-data';
import { adminCustomerUpdateSchema, formatZodError } from '@/lib/validators';
import { ownerIndex, ownerOf } from '@/lib/admin';

/**
 * GET    /api/admin/customers/:id  -> one customer with their full ledger
 * PATCH  /api/admin/customers/:id  -> edit any account's customer
 * DELETE /api/admin/customers/:id  -> delete the customer and their ledger
 *
 * Unlike /api/customers/:id these are NOT owner-scoped — that is the whole
 * point of the panel — so the admin guard is the only thing protecting them.
 */

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

async function load(id: string) {
  if (!isObjectId(id)) throw notFound('কাস্টমার পাওয়া যায়নি');
  const doc = await Customer.findById(id);
  if (!doc) throw notFound('কাস্টমার পাওয়া যায়নি');
  return doc;
}

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);
  const doc = await load(ctx.params.id);

  const balance = await balanceFor(doc.owner, doc._id);
  const view = customerView(doc, balance);
  const entries = await Transaction.find({ customer: doc._id, owner: doc.owner }).sort({
    date: -1,
  });
  const index = await ownerIndex();

  const ownerId = String(doc.owner);
  const who = ownerOf(index, doc.owner);

  // Namespace the owner's fields rather than spreading `ownerOf()` in raw.
  // It returns `{ id, name, phone, role, disabled }`, so a bare spread collides
  // with the customer's own `id`, `name` and `phone` and silently replaces them
  // with the owner's — the customer's `id` even came back as the owner's id.
  // Same shape as the list route in `../route.ts`.
  return NextResponse.json({
    customer: {
      ...view,
      ownerId,
      ownerName: who.name,
      ownerPhone: who.phone,
      hasPhoto: Boolean(doc.photoUrl),
      createdAt: doc.createdAt,
    },
    headline: ledgerHeadline(view),
    entries: entries.map(entryView),
  });
});

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);
  const doc = await load(ctx.params.id);

  const body = await readJson(req);
  const parsed = adminCustomerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const { name, phone, type, note, photoUrl, photoPublicId } = parsed.data;

  if (name !== undefined) {
    doc.name = name;
    doc.initials = Customer.makeInitials(name);
  }
  if (phone !== undefined) doc.phone = phone;
  if (type !== undefined) doc.type = type;
  if (note !== undefined) doc.note = String(note || '').trim();

  if (photoUrl !== undefined || photoPublicId !== undefined) {
    const previous = doc.photoPublicId;
    const nextPublicId =
      photoPublicId === undefined ? doc.photoPublicId : String(photoPublicId || '').trim();
    const nextUrl = photoUrl === undefined ? doc.photoUrl : String(photoUrl || '').trim();

    const orphaned = previous && (previous !== nextPublicId || !nextUrl);
    doc.photoUrl = nextUrl;
    doc.photoPublicId = nextUrl ? nextPublicId : '';
    if (orphaned) await destroyImage(previous);
  }

  await doc.save();

  const balance = await balanceFor(doc.owner, doc._id);
  return NextResponse.json({ customer: customerView(doc, balance) });
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);
  const doc = await load(ctx.params.id);

  const removed = await Transaction.deleteMany({ customer: doc._id, owner: doc.owner });
  if (doc.photoPublicId) await destroyImage(doc.photoPublicId);
  await doc.deleteOne();

  return NextResponse.json({
    ok: true,
    deletedId: ctx.params.id,
    removedTransactions: removed.deletedCount || 0,
  });
});
