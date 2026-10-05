import { NextResponse, type NextRequest } from 'next/server';
import Customer from '@/lib/models/Customer';
import { handler, getPagination, paginated } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { balancesFor, customerView } from '@/lib/ledger';
import { escapeRegex, ownerIndex, ownerOf } from '@/lib/admin';

/**
 * GET /api/admin/customers?q=&type=&owner=&page=&limit=
 *
 * Every customer/supplier across all accounts, annotated with the owning
 * account and the derived balance. Admin only.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q');
  const type = sp.get('type');
  const owner = sp.get('owner');
  const { page, limit, skip } = getPagination(sp, 25);

  const filter: Record<string, unknown> = {};
  if (type === 'customer' || type === 'supplier') filter.type = type;
  if (owner) filter.owner = owner;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { phone: rx }];
  }

  const [customers, total, index] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
    ownerIndex(),
  ]);

  // Balances are per-owner, so group the page by owner before aggregating.
  const byOwner = new Map<string, unknown[]>();
  customers.forEach((c) => {
    const k = String(c.owner);
    if (!byOwner.has(k)) byOwner.set(k, []);
    byOwner.get(k)!.push(c._id);
  });

  const balanceMaps = new Map<string, Awaited<ReturnType<typeof balancesFor>>>();
  await Promise.all(
    Array.from(byOwner.entries()).map(async ([ownerId, ids]) => {
      balanceMaps.set(ownerId, await balancesFor(ownerId, ids));
    }),
  );

  const items = customers.map((c) => {
    const ownerId = String(c.owner);
    const view = customerView(c, balanceMaps.get(ownerId)?.get(String(c._id)));
    const who = ownerOf(index, c.owner);
    return {
      ...view,
      ownerId,
      ownerName: who.name,
      ownerPhone: who.phone,
      hasPhoto: Boolean(c.photoUrl),
      createdAt: c.createdAt,
    };
  });

  return NextResponse.json(paginated(items, total, { page, limit, skip }));
});
