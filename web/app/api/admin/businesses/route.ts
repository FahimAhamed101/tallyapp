import { NextResponse, type NextRequest } from 'next/server';
import Business from '@/lib/models/Business';
import Customer from '@/lib/models/Customer';
import Transaction from '@/lib/models/Transaction';
import { handler, getPagination, paginated } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { balancesFor } from '@/lib/ledger';
import { escapeRegex, ownerIndex, ownerOf } from '@/lib/admin';
import { money, toBn } from '@/lib/bengali';

/**
 * GET /api/admin/businesses?q=&owner=&page=&limit=
 *
 * Every book (ব্যবসা) across all accounts. Admin only.
 *
 * Deliberately *not* scoped by `X-Business-Id`: the whole point of the panel is
 * to see all of a shopkeeper's books at once, so a filter on the active one
 * would make it blind to exactly the rows it exists to show.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q');
  const owner = sp.get('owner');
  const { page, limit, skip } = getPagination(sp, 25);

  const filter: Record<string, unknown> = {};
  if (owner) filter.owner = owner;
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');

  const [businesses, total, index] = await Promise.all([
    Business.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Business.countDocuments(filter),
    ownerIndex(),
  ]);

  const ids = businesses.map((b) => b._id);

  // Three queries for the whole page rather than three per row.
  const [customers, txCounts] = await Promise.all([
    Customer.find({ business: { $in: ids } }, '_id owner business type').lean(),
    Transaction.aggregate([
      { $match: { business: { $in: ids } } },
      { $group: { _id: '$business', n: { $sum: 1 } } },
    ]),
  ]);

  // Balances are computed per owner, so bucket the customers by owner first —
  // the same shape the admin customers list uses.
  const customersByOwner = new Map<string, unknown[]>();
  customers.forEach((c) => {
    const k = String(c.owner);
    if (!customersByOwner.has(k)) customersByOwner.set(k, []);
    customersByOwner.get(k)!.push(c._id);
  });

  const balanceMaps = new Map<string, Awaited<ReturnType<typeof balancesFor>>>();
  await Promise.all(
    Array.from(customersByOwner.entries()).map(async ([ownerId, ownerCustomerIds]) => {
      balanceMaps.set(ownerId, await balancesFor(ownerId, ownerCustomerIds));
    }),
  );

  const tallies = new Map<
    string,
    { customer: number; supplier: number; receivable: number }
  >();
  customers.forEach((c) => {
    const key = String(c.business);
    const bucket = tallies.get(key) || { customer: 0, supplier: 0, receivable: 0 };
    if (c.type === 'supplier') bucket.supplier += 1;
    else bucket.customer += 1;

    // Only a net-positive customer counts toward পাবো, matching the home tab.
    const b = balanceMaps.get(String(c.owner))?.get(String(c._id));
    const net = b ? b.receivable - b.payable : 0;
    if (net > 0.004) bucket.receivable += net;

    tallies.set(key, bucket);
  });

  const txByBusiness = new Map<string, number>(
    (txCounts as { _id: unknown; n: number }[]).map((r) => [String(r._id), r.n]),
  );

  const items = businesses.map((b) => {
    const id = String(b._id);
    const t = tallies.get(id) || { customer: 0, supplier: 0, receivable: 0 };
    const who = ownerOf(index, b.owner);
    return {
      id,
      name: b.name,
      isPrimary: !!b.isPrimary,
      ownerId: String(b.owner),
      ownerName: who.name,
      ownerPhone: who.phone,
      customerCount: t.customer,
      supplierCount: t.supplier,
      customerLabel: `কাস্টমার ${toBn(t.customer)}, সাপ্লায়ার ${toBn(t.supplier)}`,
      transactionCount: txByBusiness.get(id) || 0,
      receivable: money(t.receivable),
      createdAt: b.createdAt,
    };
  });

  return NextResponse.json(paginated(items, total, { page, limit, skip }));
});
