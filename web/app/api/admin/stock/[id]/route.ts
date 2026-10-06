import { NextResponse, type NextRequest } from 'next/server';
import StockItem from '@/lib/models/StockItem';
import StockMovement from '@/lib/models/StockMovement';
import { badRequest, conflict, handler, notFound, readJson } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { escapeRegex } from '@/lib/app-data';
import {
  deleteStockItemCascade,
  stockItemView,
  totalsForItemIds,
  type StockItemLike,
} from '@/lib/stock';
import { stockItemUpdateSchema, formatZodError } from '@/lib/validators';
import { effectiveMethod, type RouteContext } from '@/lib/route-utils';

/**
 * PATCH  /api/admin/stock/:id   -> edit any shopkeeper's stock item
 * DELETE /api/admin/stock/:id   -> delete it, its movements and its photo
 *
 * Cross-account on purpose: the panel is the only place that can reach into an
 * account it does not own. Reuses `stockItemUpdateSchema` and
 * `deleteStockItemCascade` from the owner-facing path so the two cannot drift —
 * two copies would eventually validate differently, and the failure mode is
 * silent (a field the panel cannot set, or an orphaned Cloudinary image).
 */

export const dynamic = 'force-dynamic';

type Ctx = RouteContext<{ id: string }>;

async function patchStock(req: NextRequest, ctx: Ctx) {
  await requireAdmin(req);

  const doc = await StockItem.findById(ctx.params.id).catch(() => null);
  if (!doc) throw notFound('পণ্যটি পাওয়া যায়নি');

  const body = await readJson(req);
  const parsed = stockItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const d = parsed.data;

  // Two rows with the same name in one book would split that product's quantity.
  if (d.name !== undefined && d.name !== doc.name) {
    const clash = await StockItem.findOne({
      owner: doc.owner,
      business: doc.business,
      _id: { $ne: doc._id },
      name: new RegExp(`^${escapeRegex(d.name)}$`, 'i'),
    }).lean();
    if (clash) throw conflict('এই নামে একটি পণ্য আগেই আছে');
  }

  if (d.name !== undefined) doc.name = d.name;
  if (d.unit !== undefined) doc.unit = d.unit || 'পিস';
  if (d.purchasePrice !== undefined) doc.purchasePrice = d.purchasePrice;
  if (d.salePrice !== undefined) doc.salePrice = d.salePrice;
  if (d.openingStock !== undefined) doc.openingStock = d.openingStock;
  if (d.lowStockThreshold !== undefined) doc.lowStockThreshold = d.lowStockThreshold;
  if (d.note !== undefined) doc.note = d.note;

  await doc.save();

  const totals = await totalsForItemIds([doc._id]);
  const last = await StockMovement.findOne({ item: doc._id })
    .sort({ date: -1, _id: -1 })
    .select('date')
    .lean();

  return NextResponse.json({
    item: stockItemView(doc as unknown as StockItemLike, totals.get(String(doc._id)), last?.date ?? null),
  });
}

export const PATCH = handler(patchStock);

/** Verb-override alias, so the panel can use either shape. */
export const POST = handler(async (req: NextRequest, ctx: Ctx) => {
  if (effectiveMethod(req) === 'PATCH') return patchStock(req, ctx);
  return NextResponse.json(
    { error: 'NOT_FOUND', message: `No route for POST ${req.nextUrl.pathname}` },
    { status: 404 },
  );
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  await requireAdmin(req);

  const doc = await StockItem.findById(ctx.params.id).catch(() => null);
  if (!doc) throw notFound('পণ্যটি পাওয়া যায়নি');

  const removed = await deleteStockItemCascade(doc);
  await StockItem.deleteOne({ _id: doc._id });

  return NextResponse.json({ ok: true, deletedId: ctx.params.id, removed });
});
