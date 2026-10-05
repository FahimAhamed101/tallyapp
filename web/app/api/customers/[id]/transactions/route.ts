import { NextResponse, type NextRequest } from 'next/server';
import Customer from '@/lib/models/Customer';
import Transaction from '@/lib/models/Transaction';
import { badRequest, handler, notFound, parseAmount, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { balanceFor, customerView, ledgerHeadline } from '@/lib/ledger';
import { entryView } from '@/lib/app-data';
import { formatZodError, transactionCreateSchema } from '@/lib/validators';
import type { RouteContext } from '@/lib/route-utils';

/**
 * GET  /api/customers/:id/transactions  -> the ledger list
 * POST /api/customers/:id/transactions  -> the দিলাম/বেচা + পেলাম form
 *
 *   body: { box: 'gave'|'got', amount, description, date, hasPhoto }
 *      or: { kind: 'sale'|'purchase'|'payment_received'|'payment_made'|'refund', ... }
 */

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<{ id: string }>;

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const { user } = await requireAuth(req);
  const doc = await Customer.findOne({ _id: ctx.params.id, owner: user._id }).catch(() => null);
  if (!doc) throw notFound('কাস্টমার পাওয়া যায়নি');

  const entries = await Transaction.find({ customer: doc._id, owner: user._id }).sort({
    date: -1,
  });
  return NextResponse.json({ items: entries.map(entryView) });
});

export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  const { user } = await requireAuth(req);

  const doc = await Customer.findOne({ _id: ctx.params.id, owner: user._id }).catch(() => null);
  if (!doc) throw notFound('কাস্টমার পাওয়া যায়নি');

  const body = await readJson(req);
  const parsed = transactionCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  // `box` is the form's two buttons; `kind` is the explicit ledger kind.
  let resolvedKind = parsed.data.kind;
  if (!resolvedKind && parsed.data.box) {
    resolvedKind = Transaction.kindFor(parsed.data.box, doc.type);
  }
  if (!resolvedKind || !Transaction.SIGN[resolvedKind]) {
    throw badRequest('লেনদেনের ধরন সঠিক নয়');
  }

  // Re-parse through parseAmount so the Bengali-digit tolerance is identical to
  // the Express version even though Zod already coerced it.
  const amt = parseAmount(body.amount ?? parsed.data.amount);
  if (!Number.isFinite(amt) || amt <= 0) throw badRequest('সঠিক পরিমাণ দিন');

  const created = await Transaction.create({
    owner: user._id,
    customer: doc._id,
    kind: resolvedKind,
    amount: amt,
    description: String(parsed.data.description || '').trim(),
    hasPhoto: !!parsed.data.hasPhoto,
    date: parsed.data.date,
  });

  doc.lastActivityAt = new Date();
  await doc.save();

  const balance = await balanceFor(user._id, doc._id);
  const view = customerView(doc, balance);

  return NextResponse.json(
    {
      ok: true,
      entry: entryView(created),
      customer: view,
      headline: ledgerHeadline(view),
    },
    { status: 201 },
  );
});
