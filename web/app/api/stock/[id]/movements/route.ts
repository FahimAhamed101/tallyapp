import { NextResponse, type NextRequest } from 'next/server';
import StockMovement from '@/lib/models/StockMovement';
import { badRequest, handler } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope } from '@/lib/business';
import {
  findStockItem,
  movementTotalsFor,
  stockItemView,
  stockMovementView,
  type StockMovementLike,
  type StockTotals,
} from '@/lib/stock';
import { scopeFilter } from '@/lib/scope';
import { formatZodError, stockMovementCreateSchema } from '@/lib/validators';
import { type RouteContext } from '@/lib/route-utils';

/**
 * POST /api/stock/:id/movements -> স্টক ইন / স্টক আউট
 *
 * Movements are append-only, so there is no PATCH or DELETE here: a mistake is
 * corrected by recording the opposite movement, which keeps the item's history
 * intact and means the quantity can always be recomputed from the log.
 *
 * The response carries the *refreshed item* alongside the new movement, so the
 * detail screen can update its quantity without a second round trip.
 */

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<{ id: string }>;

const ZERO: StockTotals = { in: 0, out: 0, count: 0 };

export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  const { user } = await requireAuth(req);
  const { business, scope } = await resolveScope(req, user);

  // Scoped lookup first: without it a caller could post a movement against
  // another account's item id and silently move their stock.
  const item = await findStockItem(scope, ctx.params.id);

  const body = await req.json().catch(() => ({}));
  const parsed = stockMovementCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const d = parsed.data;
  const movement = await StockMovement.create({
    owner: user._id,
    business: business._id,
    item: ctx.params.id,
    direction: d.direction,
    quantity: d.quantity,
    unitCost: d.unitCost ?? 0,
    note: d.note || '',
    date: d.date,
  });

  const totals = (await movementTotalsFor(scope, [ctx.params.id])).get(ctx.params.id) || ZERO;
  const unit = item.unit || 'পিস';

  return NextResponse.json(
    {
      movement: stockMovementView(movement as unknown as StockMovementLike, unit),
      item: stockItemView(item, totals, movement.date),
    },
    { status: 201 },
  );
});
