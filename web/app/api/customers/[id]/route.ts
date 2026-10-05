import { NextResponse, type NextRequest } from 'next/server';
import type { HydratedDocument } from 'mongoose';
import Customer, { type CustomerDoc } from '@/lib/models/Customer';
import Transaction from '@/lib/models/Transaction';
import { badRequest, handler, notFound, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { balanceFor, customerView, ledgerHeadline } from '@/lib/ledger';
import { destroyImage } from '@/lib/cloudinary';
import { entryView } from '@/lib/app-data';
import { customerUpdateSchema, formatZodError } from '@/lib/validators';
import { effectiveMethod, type RouteContext } from '@/lib/route-utils';

/**
 * GET    /api/customers/:id   -> ledger screen
 * PATCH  /api/customers/:id   -> edit screen (name / phone / type / photo)
 * DELETE /api/customers/:id   -> remove the customer and their ledger
 *
 * PATCH is also reachable as POST + X-HTTP-Method-Override, which is how the
 * Android client sends it.
 */

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<{ id: string }>;

/** Loads a customer belonging to the caller, or throws 404. */
async function ownCustomer(req: NextRequest, id: string): Promise<HydratedDocument<CustomerDoc>> {
  const { user } = await requireAuth(req);
  const doc = await Customer.findOne({ _id: id, owner: user._id }).catch(() => null);
  if (!doc) throw notFound('কাস্টমার পাওয়া যায়নি');
  return doc as HydratedDocument<CustomerDoc>;
}

/** Replaces a customer's photo, cleaning up the asset it supersedes. */
async function applyPhoto(
  doc: HydratedDocument<CustomerDoc>,
  body: Record<string, unknown>,
): Promise<void> {
  if (body.photoUrl === undefined && body.photoPublicId === undefined) return;

  const previous = doc.photoPublicId;
  const nextPublicId =
    body.photoPublicId === undefined ? doc.photoPublicId : String(body.photoPublicId || '').trim();
  const nextUrl = body.photoUrl === undefined ? doc.photoUrl : String(body.photoUrl || '').trim();

  // The old asset is orphaned when it is swapped out, or when the photo is cleared.
  const orphaned = previous && (previous !== nextPublicId || !nextUrl);

  doc.photoUrl = nextUrl;
  doc.photoPublicId = nextUrl ? nextPublicId : '';

  if (orphaned) await destroyImage(previous);
}

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const { user } = await requireAuth(req);
  const doc = await ownCustomer(req, ctx.params.id);

  const balance = await balanceFor(user._id, doc._id);
  const view = customerView(doc, balance);
  const entries = await Transaction.find({ customer: doc._id, owner: user._id }).sort({
    date: -1,
  });

  return NextResponse.json({
    customer: view,
    headline: ledgerHeadline(view),
    entries: entries.map(entryView),
  });
});

async function patchCustomer(req: NextRequest, ctx: Ctx) {
  const { user } = await requireAuth(req);
  const doc = await ownCustomer(req, ctx.params.id);

  const body = await readJson(req);
  const parsed = customerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const { name, phone, type, note } = parsed.data;
  if (name !== undefined) {
    doc.name = name;
    doc.initials = Customer.makeInitials(name);
  }
  if (phone !== undefined) doc.phone = phone;
  if (type !== undefined) doc.type = type;
  if (note !== undefined) doc.note = String(note || '').trim();

  await applyPhoto(doc, body);
  await doc.save();

  const balance = await balanceFor(user._id, doc._id);
  return NextResponse.json({ customer: customerView(doc, balance) });
}

export const PATCH = handler(patchCustomer);

/** Verb-override alias for the Android client. */
export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  if (effectiveMethod(req) === 'PATCH') return patchCustomer(req, ctx);
  return NextResponse.json(
    { error: 'NOT_FOUND', message: `No route for POST ${req.nextUrl.pathname}` },
    { status: 404 },
  );
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  const { user } = await requireAuth(req);
  const doc = await ownCustomer(req, ctx.params.id);

  await Transaction.deleteMany({ customer: doc._id, owner: user._id });
  if (doc.photoPublicId) await destroyImage(doc.photoPublicId);
  await doc.deleteOne();

  return NextResponse.json({ ok: true, deletedId: ctx.params.id });
});
