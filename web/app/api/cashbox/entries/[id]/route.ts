import { NextResponse, type NextRequest } from 'next/server';
import CashboxEntry from '@/lib/models/CashboxEntry';
import { handler, notFound } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope, scopeFilter } from '@/lib/business';
import { cashboxDashboard } from '@/lib/app-data';
import type { RouteContext } from '@/lib/route-utils';

/** DELETE /api/cashbox/entries/:id */

export const dynamic = 'force-dynamic';

export const DELETE = handler(
  async (req: NextRequest, ctx: RouteContext<{ id: string }>) => {
    const { user } = await requireAuth(req);
    const { scope } = await resolveScope(req, user);

    const doc = await CashboxEntry.findOne({
      _id: ctx.params.id,
      ...scopeFilter(scope),
    }).catch(() => null);
    if (!doc) throw notFound('এন্ট্রি পাওয়া যায়নি');

    await doc.deleteOne();
    return NextResponse.json({
      ok: true,
      deletedId: ctx.params.id,
      dashboard: await cashboxDashboard(scope),
    });
  },
);
