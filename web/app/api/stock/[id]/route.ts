import { NextResponse, type NextRequest } from 'next/server';
import StockItem from '@/lib/models/StockItem';
import StockMovement from '@/lib/models/StockMovement';
import { badRequest, conflict, handler, notFound, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope } from '@/lib/business';
import { escapeRegex } from '@/lib/app-data';
import {
  deleteStockItemCascade,
  findStockItem,
  movementTotalsFor,
  stockItemView,
  stockMovementView,
  type StockItemLike,
  type StockMovementLike,
  type StockTotals,
} from '@/lib/stock';
import { scopeFilter } from '@/lib/scope';
import { formatZodError, stockItemUpdateSchema } from '@/lib/validators';
import { effectiveMethod, type RouteContext } from '@/lib/route-utils';

/**
 * GET    /api/stock/:id   -> the item plus its movement history
 * PATCH  /api/stock/:id   -> edit name, unit, prices, opening stock, threshold
 * DELETE /api/stock/:id   -> remove the item and its movements
 *
 * PATCH is also reachable as POST + X-HTTP-Method-Override, which is how the
 * Android client sends it (`HttpURLConnection` cannot send PATCH).
 */

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<{ id: string }>;

const ZERO: StockTotals = { in: 0, out: 0, count: 0 };

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  const item = await findStockItem(scope, ctx.params.id);

  const [totals, movements] = await Promise.all([
    movementTotalsFor(scope, [ctx.params.id]).then((m) => m.get(ctx.params.id) || ZERO),
    StockMovement.find({ ...scopeFilter(scope), item: ctx.params.id }).sort({ date: -1, _id: -1 }),
  ]);

  const unit = item.unit || 'পিস';

  return NextResponse.json({
    item: stockItemView(item, totals, movements[0]?.date ?? null),
    // Newest first, so the top of the list is the most recent thing that happened.
    movements: movements.map((m) => stockMovementView(m as unknown as StockMovementLike, unit)),
    total: movements.length,
  });
});

async function patchItem(req: NextRequest, ctx: Ctx) {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  const item = await findStockItem(scope, ctx.params.id);
  const body = await readJson(req);
  const parsed = stockItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const d = parsed.data;

  // Renaming onto an existing item would split that product's quantity across
  // two rows. `_id: { $ne: … }` so saving without changing the name is fine.
  if (d.name !== undefined && d.name !== item.name) {
    const clash = await StockItem.findOne({
      ...scopeFilter(scope),
      _id: { $ne: ctx.params.id },
      name: { $regex: `^${escapeRegex(d.name)}$`, $options: 'i' },
    }).lean();
    if (clash) throw conflict('এই নামে একটি পণ্য আগেই আছে');
  }

  const doc = await StockItem.findOne({ ...scopeFilter(scope), _id: ctx.params.id });
  if (!doc) throw notFound('পণ্যটি পাওয়া যায়নি');

  // Only the keys actually sent are touched, so a PATCH that changes the price
  // cannot blank the note.
  if (d.name !== undefined) doc.name = d.name;
  if (d.unit !== undefined) doc.unit = d.unit || 'পিস';
  if (d.purchasePrice !== undefined) doc.purchasePrice = d.purchasePrice;
  if (d.salePrice !== undefined) doc.salePrice = d.salePrice;
  if (d.openingStock !== undefined) doc.openingStock = d.openingStock;
  if (d.lowStockThreshold !== undefined) doc.lowStockThreshold = d.lowStockThreshold;
  if (d.note !== undefined) doc.note = d.note;
  if (d.photoUrl !== undefined) doc.photoUrl = d.photoUrl;
  if (d.photoPublicId !== undefined) doc.photoPublicId = d.photoPublicId;

  await doc.save();

  const totals = (await movementTotalsFor(scope, [ctx.params.id])).get(ctx.params.id) || ZERO;
  const last = await StockMovement.findOne({ ...scopeFilter(scope), item: ctx.params.id })
    .sort({ date: -1, _id: -1 })
    .select('date')
    .lean();

  return NextResponse.json({
    item: stockItemView(doc as unknown as StockItemLike, totals, last?.date ?? null),
  });
}

export const PATCH = handler(patchItem);

/** Verb-override alias for the Android client. */
export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  if (effectiveMethod(req) === 'PATCH') return patchItem(req, ctx);
  return NextResponse.json(
    { error: 'NOT_FOUND', message: `No route for POST ${req.nextUrl.pathname}` },
    { status: 404 },
  );
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  const item = await findStockItem(scope, ctx.params.id);
  const removed = await deleteStockItemCascade(item);
  await StockItem.deleteOne({ ...scopeFilter(scope), _id: ctx.params.id });

  return NextResponse.json({ ok: true, deletedId: ctx.params.id, removed });
});
