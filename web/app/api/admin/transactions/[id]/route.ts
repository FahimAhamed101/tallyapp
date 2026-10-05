import { NextResponse, type NextRequest } from 'next/server';
import Transaction from '@/lib/models/Transaction';
import Customer from '@/lib/models/Customer';
import { badRequest, handler, isObjectId, notFound, parseAmount, readJson } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { adminTransactionUpdateSchema, formatZodError } from '@/lib/validators';
import { entryView } from '@/lib/app-data';
import { balanceFor, customerView } from '@/lib/ledger';

/**
 * PATCH  /api/admin/transactions/:id — correct a mis-keyed ledger entry
 * DELETE /api/admin/transactions/:id — remove it
 *
 * Admin only, and deliberately not owner-scoped. After a write the owning
 * customer's derived balance is returned so the panel can show the corrected
 * number immediately.
 */

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

async function load(id: string) {
  if (!isObjectId(id)) throw notFound('লেনদেন পাওয়া যায়নি');
  const doc = await Transaction.findById(id);
  if (!doc) throw notFound('লেনদেন পাওয়া যায়নি');
  return doc;
}

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);
  const doc = await load(ctx.params.id);

  const body = await readJson(req);
  const parsed = adminTransactionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const { kind, description, hasPhoto, date } = parsed.data;

  if (body.amount !== undefined) {
    const amt = parseAmount(body.amount);
    if (!Number.isFinite(amt) || amt <= 0) throw badRequest('সঠিক পরিমাণ দিন');
    doc.amount = amt;
  }
  if (kind !== undefined) doc.kind = kind;
  if (description !== undefined) doc.description = String(description || '').trim();
  if (hasPhoto !== undefined) doc.hasPhoto = !!hasPhoto;
  if (date !== undefined) doc.date = new Date(date);

  await doc.save();

  const balance = await balanceFor(doc.owner, doc.customer);

  return NextResponse.json({
    ok: true,
    entry: entryView(doc),
    balance: { receivable: balance.receivable, payable: balance.payable },
  });
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);
  const doc = await load(ctx.params.id);

  const owner = doc.owner;
  const customerId = doc.customer;
  await doc.deleteOne();

  // Recompute the customer's balance after the removal.
  const customer = await Customer.findById(customerId).catch(() => null);
  const balance = await balanceFor(owner, customerId);

  return NextResponse.json({
    ok: true,
    deletedId: ctx.params.id,
    customer: customer ? customerView(customer, balance) : null,
  });
});
