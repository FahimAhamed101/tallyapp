import { NextResponse, type NextRequest } from 'next/server';
import User from '@/lib/models/User';
import Customer from '@/lib/models/Customer';
import Transaction from '@/lib/models/Transaction';
import CashboxEntry from '@/lib/models/CashboxEntry';
import { handler, getPagination, paginated } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { escapeRegex } from '@/lib/admin';
import { amount, toBn } from '@/lib/bengali';

/**
 * GET /api/admin/users?q=&role=&page=&limit=
 *
 * Every account on the platform, with the row counters the panel shows.
 * Admin only.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q');
  const role = sp.get('role');
  const { page, limit, skip } = getPagination(sp, 25);

  const filter: Record<string, unknown> = {};
  if (role === 'user' || role === 'admin') filter.role = role;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { phone: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter, '-passwordSalt -passwordHash -sessions')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const ids = users.map((u) => u._id);

  // Three grouped counts in parallel beats N queries per row.
  const [customerCounts, txCounts, cashCounts] = await Promise.all([
    Customer.aggregate([
      { $match: { owner: { $in: ids } } },
      { $group: { _id: '$owner', count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { owner: { $in: ids } } },
      { $group: { _id: '$owner', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    CashboxEntry.aggregate([
      { $match: { owner: { $in: ids } } },
      { $group: { _id: '$owner', count: { $sum: 1 } } },
    ]),
  ]);

  const keyed = (rows: { _id: unknown; count?: number; total?: number }[]) => {
    const m = new Map<string, { count: number; total: number }>();
    rows.forEach((r) => m.set(String(r._id), { count: r.count || 0, total: r.total || 0 }));
    return m;
  };

  const cm = keyed(customerCounts);
  const tm = keyed(txCounts);
  const km = keyed(cashCounts);

  const items = users.map((u) => {
    const id = String(u._id);
    const tx = tm.get(id);
    return {
      id,
      name: u.name,
      phone: u.phone,
      photoUrl: u.photoUrl || '',
      role: u.role || 'user',
      disabled: !!u.disabled,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      sessionCount: (u.sessions || []).length,
      customerCount: cm.get(id)?.count || 0,
      transactionCount: tx?.count || 0,
      transactionTotal: tx?.total || 0,
      transactionTotalDisplay: amount(tx?.total || 0),
      cashboxCount: km.get(id)?.count || 0,
    };
  });

  return NextResponse.json({
    ...paginated(items, total, { page, limit, skip }),
    label: `মোট ${toBn(total)} জন ব্যবহারকারী`,
  });
});
