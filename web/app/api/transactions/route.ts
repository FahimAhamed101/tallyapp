import { NextResponse, type NextRequest } from 'next/server';
import Transaction from '@/lib/models/Transaction';
import '@/lib/models/Customer';
import { handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope, scopeFilter } from '@/lib/business';
import { entryView } from '@/lib/app-data';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 200, 1000);
  const kind = req.nextUrl.searchParams.get('kind');

  const filter: Record<string, unknown> = scopeFilter(scope);
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
