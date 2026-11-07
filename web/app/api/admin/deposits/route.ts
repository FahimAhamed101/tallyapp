import { NextResponse, type NextRequest } from 'next/server';
import Deposit from '@/lib/models/Deposit';
import User from '@/lib/models/User';
import { escapeRegex } from '@/lib/admin';
import { getPagination, handler, paginated } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { depositView } from '@/lib/app-data';
import { money, toBn } from '@/lib/bengali';

/**
 * GET /api/admin/deposits?status=&q=&page=&limit=
 *
 * The manual deposit queue. Default view is the pending backlog, oldest first,
 * because that is the order an admin actually works through it — the oldest
 * waiting user is the one closest to the 24-hour promise.
 *
 * Admin only.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const q = sp.get('q');
  const { page, limit, skip } = getPagination(sp, 25);

  const filter: Record<string, unknown> = {};
  if (status === 'pending' || status === 'approved' || status === 'rejected') {
    filter.status = status;
  }

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    // The admin searches by whatever they have in front of them: the bKash SMS
    // (trx id, sender number) or the person (name, phone). Matching an owner
    // needs the user ids first, since they live in another collection.
    const owners = await User.find({ $or: [{ name: rx }, { phone: rx }] })
      .select('_id')
      .limit(200)
      .lean();
    filter.$or = [
      { trxId: rx },
      { senderNumber: rx },
      { owner: { $in: owners.map((u) => u._id) } },
    ];
  }

  // Oldest first while working the queue; newest first once you are browsing
  // history, which is what the status filter switches between.
  // Annotated because a bare ternary widens 1/-1 to `number`, which Mongoose's
  // `SortOrder` rejects at build time.
  const sort: Record<string, 1 | -1> =
    status === 'pending' || !status ? { createdAt: 1 } : { createdAt: -1 };

  const [rows, total, pendingAgg] = await Promise.all([
    Deposit.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('owner', 'name phone photoUrl')
      .populate('reviewedBy', 'name')
      .lean(),
    Deposit.countDocuments(filter),
    Deposit.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const waiting = pendingAgg[0] || { count: 0, total: 0 };

  const items = rows.map((r) => {
    const owner = r.owner as unknown as { _id?: unknown; name?: string; phone?: string };
    const reviewer = r.reviewedBy as unknown as { name?: string } | null;
    const view = depositView(r as never);
    return {
      ...view,
      createdAt: view.createdAt as unknown as string,
      reviewedAt: (view.reviewedAt as unknown as string) ?? null,
      userName: owner?.name || '—',
      userPhone: owner?.phone || '',
      userId: owner?._id ? String(owner._id) : '',
      reviewedByName: reviewer?.name || '',
    };
  });

  return NextResponse.json({
    ...paginated(items, total, { page, limit, skip }),
    pending: {
      count: waiting.count,
      total: waiting.total,
      totalDisplay: money(waiting.total).display,
    },
    // Counts the whole filtered set, not the page — the header is read as a
    // backlog size, and a page-sized number would understate it by design.
    label: `${toBn(total)}টি রিকোয়েস্ট · অপেক্ষমাণ ${toBn(waiting.count)}টি (${money(
      waiting.total,
    ).display} ৳)`,
  });
});