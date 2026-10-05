import { NextResponse, type NextRequest } from 'next/server';
import Transaction from '@/lib/models/Transaction';
import CashboxEntry from '@/lib/models/CashboxEntry';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { dateBn, money, MONTHS, toBn } from '@/lib/bengali';

/** GET /api/reports/summary?days=30 — the রিপোর্ট pill. */

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const owner = user._id;

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days')) || 30, 1), 365);
  const from = new Date(Date.now() - days * 86400000);

  const [txAgg, cashAgg] = await Promise.all([
    Transaction.aggregate([
      { $match: { owner, date: { $gte: from } } },
      { $group: { _id: '$kind', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    CashboxEntry.aggregate([
      { $match: { owner, date: { $gte: from } } },
      { $group: { _id: '$kind', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const tx = Object.fromEntries(
    (txAgg as { _id: string; total: number }[]).map((r) => [r._id, r.total]),
  ) as Record<string, number>;
  const cash = Object.fromEntries(
    (cashAgg as { _id: string; total: number }[]).map((r) => [r._id, r.total]),
  ) as Record<string, number>;

  return NextResponse.json({
    days,
    range: { from, to: new Date(), label: `${toBn(days)} দিন` },
    sales: money(tx.sale || 0),
    purchases: money(tx.purchase || 0),
    paymentsReceived: money(tx.payment_received || 0),
    paymentsMade: money(tx.payment_made || 0),
    cashSales: money(cash.cash_sale || 0),
    cashPurchases: money(cash.cash_purchase || 0),
    expenses: money(cash.expense || 0),
    ownerIn: money(cash.owner_in || 0),
    ownerOut: money(cash.owner_out || 0),
    generatedAt: new Date(),
    generatedLabel: dateBn(new Date()),
    monthLabel: MONTHS[new Date().getMonth()],
  });
});
