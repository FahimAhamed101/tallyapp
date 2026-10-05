import { NextResponse, type NextRequest } from 'next/server';
import Transaction from '@/lib/models/Transaction';
import { handler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { amount, dateBn, relativeBn, toBn } from '@/lib/bengali';
import { KIND_TITLE, KIND_TONE } from '@/lib/app-data';
import { escapeRegex, ownerIndex, ownerOf } from '@/lib/admin';

/**
 * GET /api/admin/transactions?q=&kind=&owner=&from=&to=&page=&limit=
 *
 * The full cross-account ledger. Admin only.
 *
 * Create/update/delete live elsewhere: POST /api/customers/:id/transactions
 * (owner-scoped) and PATCH|DELETE /api/admin/transactions/:id (admin).
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q');
  const kind = sp.get('kind');
  const owner = sp.get('owner');
  const from = sp.get('from');
  const to = sp.get('to');
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const limit = Math.min(Math.max(1, Number(sp.get('limit')) || 50), 200);

  const filter: Record<string, unknown> = {};
  if (kind) filter.kind = kind;
  if (owner) filter.owner = owner;
  if (from || to) {
    filter.date = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }
  if (q) filter.description = new RegExp(escapeRegex(q), 'i');

  const [rows, total, index] = await Promise.all([
    Transaction.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customer', 'name type')
      .lean(),
    Transaction.countDocuments(filter),
    ownerIndex(),
  ]);

  const items = rows.map((t) => {
    const who = ownerOf(index, t.owner);
    const customer = t.customer as unknown as
      | { _id?: unknown; name?: string; type?: string }
      | null;
    return {
      id: String(t._id),
      kind: t.kind,
      title: KIND_TITLE[t.kind] || t.kind,
      tone: KIND_TONE[t.kind] || 'out',
      amount: t.amount,
      amountDisplay: amount(t.amount),
      description: t.description || '',
      hasPhoto: !!t.hasPhoto,
      date: t.date,
      dateDisplay: dateBn(t.date),
      relative: relativeBn(t.date),
      ownerId: who.id,
      ownerName: who.name,
      ownerPhone: who.phone,
      customerId: customer?._id ? String(customer._id) : '',
      customerName: customer?.name || '(মুছে ফেলা)',
      customerType: customer?.type || 'customer',
    };
  });

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    label: `মোট ${toBn(total)} টি লেনদেন`,
  });
});
