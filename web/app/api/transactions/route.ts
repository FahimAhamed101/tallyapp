import { NextResponse, type NextRequest } from 'next/server';
import Transaction from '@/lib/models/Transaction';
import '@/lib/models/Customer';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { entryView } from '@/lib/app-data';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 200, 1000);
  const kind = req.nextUrl.searchParams.get('kind');

  const filter: Record<string, unknown> = { owner: user._id };
  if (kind) filter.kind = kind;

  const entries = await Transaction.find(filter)
    .populate('customer', 'name phone type')
    .sort({ date: -1 })
    .limit(limit);

  return NextResponse.json({
    items: entries.map((t) => {
      const v = entryView(t);
      const cust = t.customer as any;
      return {
        ...v,
        customerId: cust?._id ? String(cust._id) : '',
        customerName: cust?.name || '',
        customerPhone: cust?.phone || '',
        customerType: cust?.type || 'customer',
      };
    }),
  });
});
