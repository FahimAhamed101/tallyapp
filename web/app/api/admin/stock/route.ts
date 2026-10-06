import { NextResponse, type NextRequest } from 'next/server';
import StockItem from '@/lib/models/StockItem';
import { handler, getPagination, paginated } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { escapeRegex, ownerIndex, ownerOf } from '@/lib/admin';
import { money } from '@/lib/bengali';
import { qtyBn, totalsForItemIds, type StockTotals } from '@/lib/stock';

/**
 * GET /api/admin/stock?q=&owner=&page=&limit=
 *
 * Every stock item across all accounts. Admin only.
 *
 * Deliberately *not* scoped by `X-Business-Id`: the panel's job is to see all of
 * a shopkeeper's books at once, so filtering on the active one would hide exactly
 * the rows it exists to show.
 *
 * Quantities are derived here too, via `totalsForItemIds` — the same aggregation
 * the app uses, so the panel and the phone cannot disagree about how many are
 * left. Reading a stored field instead would be a second source of truth.
 */

export const dynamic = 'force-dynamic';

const EMPTY: StockTotals = { in: 0, out: 0, count: 0 };

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q');
  const owner = sp.get('owner');
  const { page, limit, skip } = getPagination(sp, 25);

  const filter: Record<string, unknown> = {};
  if (owner) filter.owner = owner;
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');

  const [items, total, index] = await Promise.all([
    StockItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    StockItem.countDocuments(filter),
    ownerIndex(),
  ]);

  // One aggregation for the whole page rather than one per row.
  const totals = await totalsForItemIds(items.map((i) => i._id));

  const rows = items.map((i) => {
    const t = totals.get(String(i._id)) || EMPTY;
    const quantity = (i.openingStock || 0) + t.in - t.out;
    const who = ownerOf(index, i.owner);
    const threshold = i.lowStockThreshold || 0;

    return {
      id: String(i._id),
      name: i.name,
      unit: i.unit || 'পিস',
      businessId: String(i.business),
      ownerId: String(i.owner),
      ownerName: who.name,
      ownerPhone: who.phone,
      purchasePrice: money(i.purchasePrice || 0),
      salePrice: money(i.salePrice || 0),
      openingStock: i.openingStock || 0,
      lowStockThreshold: threshold,
      quantity,
      quantityLabel: `${qtyBn(quantity)} ${i.unit || 'পিস'}`,
      costValue: money(quantity * (i.purchasePrice || 0)),
      movementCount: t.count,
      lowStock: threshold > 0 && quantity <= threshold,
      lowStockLabel: threshold > 0 && quantity <= threshold ? 'স্টক কম' : '',
      note: i.note || '',
      createdAt: i.createdAt,
    };
  });

  return NextResponse.json(paginated(rows, total, { page, limit, skip }));
});
