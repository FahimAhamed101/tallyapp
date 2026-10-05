import { NextResponse, type NextRequest } from 'next/server';
import CashboxEntry from '@/lib/models/CashboxEntry';
import { handler } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { amount, dateBn, toBn } from '@/lib/bengali';
import { CASHBOX_KIND_TITLE } from '@/lib/app-data';
import { escapeRegex, ownerIndex, ownerOf } from '@/lib/admin';

/**
 * GET /api/admin/cashbox?kind=&owner=&page=&limit=
 *
 * Every cash-box movement across all accounts. Admin only.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const sp = req.nextUrl.searchParams;
  const kind = sp.get('kind');
  const owner = sp.get('owner');
  const q = sp.get('q');
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const limit = Math.min(Math.max(1, Number(sp.get('limit')) || 50), 200);

  const filter: Record<string, unknown> = {};
  if (kind) filter.kind = kind;
  if (owner) filter.owner = owner;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ description: rx }, { category: rx }];
  }

  const [rows, total, index] = await Promise.all([
    CashboxEntry.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CashboxEntry.countDocuments(filter),
    ownerIndex(),
  ]);

  const items = rows.map((e) => {
    const who = ownerOf(index, e.owner);
    const dir = CashboxEntry.FLOW[e.kind] || 0;
    return {
      id: String(e._id),
      kind: e.kind,
      title: CASHBOX_KIND_TITLE[e.kind] || e.kind,
      direction: dir > 0 ? 'in' : 'out',
      amount: e.amount,
      amountDisplay: amount(e.amount),
      description: e.description || '',
      category: e.category || '',
      hasPhoto: !!e.hasPhoto,
      date: e.date,
      dateDisplay: dateBn(e.date),
      ownerId: who.id,
      ownerName: who.name,
      ownerPhone: who.phone,
    };
  });

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    label: `মোট ${toBn(total)} টি এন্ট্রি`,
  });
});
