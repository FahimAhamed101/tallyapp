import { NextResponse, type NextRequest } from 'next/server';
import StockItem from '@/lib/models/StockItem';
import { badRequest, conflict, handler, readJson } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { resolveScope } from '@/lib/business';
import { escapeRegex } from '@/lib/app-data';
import {
  listStockItems,
  stockItemView,
  summarise,
  type StockItemLike,
  type StockTotals,
} from '@/lib/stock';
import { scopeFilter } from '@/lib/scope';
import { formatZodError, stockItemCreateSchema } from '@/lib/validators';

/**
 * GET  /api/stock   -> the স্টক হিসাব list: every item in this book, with
 *                      derived quantities, values and a low-stock flag
 * POST /api/stock   -> 'নতুন পণ্য'
 *
 * Scoped to one book via the optional `X-Business-Id` header, exactly like the
 * customers and cash box routes — omitting it lands on the account's primary
 * book, which is what a pre-multi-business client expects.
 */

export const dynamic = 'force-dynamic';

const EMPTY_TOTALS: StockTotals = { in: 0, out: 0, count: 0 };

export const GET = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { scope } = await resolveScope(req, user);

  const items = await listStockItems(scope);

  return NextResponse.json({
    items,
    total: items.length,
    // The header card's numbers. Computed from the same array the list renders,
    // so the total can never disagree with the rows beneath it.
    summary: summarise(items),
  });
});

export const POST = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const { business, scope } = await resolveScope(req, user);

  const body = await readJson(req);
  const parsed = stockItemCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
  }

  const name = parsed.data.name;

  // Two rows with the same name would split one product's quantity in half and
  // make the stock count wrong in a way that looks like a data bug. Rejected
  // here rather than in the UI, because the UI is not what guarantees it.
  const duplicate = await StockItem.findOne({
    ...scopeFilter(scope),
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
  }).lean();
  if (duplicate) throw conflict('এই নামে একটি পণ্য আগেই আছে');

  const doc = await StockItem.create({
    owner: user._id,
    business: business._id,
    name,
    unit: parsed.data.unit || 'পিস',
    purchasePrice: parsed.data.purchasePrice ?? 0,
    salePrice: parsed.data.salePrice ?? 0,
    openingStock: parsed.data.openingStock ?? 0,
    lowStockThreshold: parsed.data.lowStockThreshold ?? 0,
    note: parsed.data.note || '',
    photoUrl: parsed.data.photoUrl || '',
    photoPublicId: parsed.data.photoPublicId || '',
  });

  // A brand-new item has no movements yet, so its quantity is exactly its
  // opening stock — no aggregation needed.
  return NextResponse.json(
    { item: stockItemView(doc as unknown as StockItemLike, EMPTY_TOTALS, null) },
    { status: 201 },
  );
});
