import StockItem from './models/StockItem';
import StockMovement from './models/StockMovement';
import { notFound } from './api-helpers';
import { destroyImage } from './cloudinary';
import { dateBn, money, toBn } from './bengali';
import { type OwnerId } from './ledger';
import { asObjectId } from './object-id';
import { type Scope, scopeFilter } from './scope';

/**
 * Stock accounting (স্টক হিসাব).
 *
 * The whole module exists to answer one question per item: *how many are left,
 * and what are they worth?* Both are derived, never stored:
 *
 *   quantity = openingStock + Σ(movements in) − Σ(movements out)
 *
 * `Customer` balances work the same way for the same reason. A stored running
 * total is a second source of truth, and the moment it disagrees with the
 * movements the shopkeeper has no way to tell which number is wrong.
 */

/**
 * A quantity is not money: no thousands separators, and no forced decimals.
 * `String(2.5)` keeps the shortest exact form, so "১২" and "২.৫" both read
 * naturally and nothing gets padded with trailing zeros.
 */
export function qtyBn(value: number): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? toBn(String(n)) : toBn(0);
}

export interface StockTotals {
  in: number;
  out: number;
  count: number;
}

const NO_TOTALS: StockTotals = { in: 0, out: 0, count: 0 };

/**
 * Coerces item ids for an aggregation `$match`.
 *
 * `$in` casts array elements in `Model.find()` — but *not* in an aggregation
 * pipeline, which is handed to the server verbatim. A 24-hex string compared
 * against an ObjectId field matches nothing, so every quantity silently reads as
 * its opening stock. Same defect class as the ৳০.০০ admin balances, and the same
 * fix: coerce at the point the filter is built rather than trusting the caller.
 *
 * (Caught by the smoke suite: the movement POST returned 201 with the right
 * title while the derived quantity did not move at all.)
 */
const asIds = (ids: OwnerId[]): unknown[] => ids.map((id) => asObjectId(id));

/** The one aggregation, so the coercion above is applied on every path. */
async function aggregateTotals(match: Record<string, unknown>): Promise<Map<string, StockTotals>> {
  const rows = await StockMovement.aggregate<{
    _id: { item: unknown; direction: string };
    qty: number;
    n: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: { item: '$item', direction: '$direction' },
        qty: { $sum: '$quantity' },
        n: { $sum: 1 },
      },
    },
  ]);

  const out = new Map<string, StockTotals>();
  rows.forEach((r) => {
    const key = String(r._id.item);
    const bucket = out.get(key) || { ...NO_TOTALS };
    if (r._id.direction === 'out') bucket.out += r.qty || 0;
    else bucket.in += r.qty || 0;
    bucket.count += r.n || 0;
    out.set(key, bucket);
  });
  return out;
}

/**
 * In/out totals per item, in one aggregation, scoped to one book.
 *
 * `$match` is built by `scopeFilter`, which coerces the ids — mongoose does not
 * cast inside an aggregation pipeline, so a bare 24-hex string here would match
 * nothing and every quantity would silently read as zero.
 */
export async function movementTotalsFor(
  scope: Scope,
  itemIds?: OwnerId[],
): Promise<Map<string, StockTotals>> {
  const match: Record<string, unknown> = scopeFilter(scope);
  if (itemIds) {
    if (!itemIds.length) return new Map();
    match.item = { $in: asIds(itemIds) };
  }
  return aggregateTotals(match);
}

/**
 * Totals for a page of items across accounts — the admin panel.
 *
 * Deliberately unscoped: the panel exists to see every shopkeeper's stock at
 * once, so filtering by one book would make it blind to the rows it is for.
 * Callers pass real `_id`s straight off the documents they just fetched.
 */
export async function totalsForItemIds(itemIds: unknown[]): Promise<Map<string, StockTotals>> {
  if (!itemIds.length) return new Map();
  return aggregateTotals({ item: { $in: itemIds.map((id) => asObjectId(id)) } });
}

/** Live quantity for one item. */
export function quantityOf(
  item: Pick<StockItemLike, 'openingStock'>,
  totals: StockTotals,
): number {
  return (item.openingStock || 0) + totals.in - totals.out;
}

/**
 * The shape `stockItemView` actually reads.
 *
 * Deliberately structural rather than `StockItemDoc`: mongoose's `InferSchemaType`
 * omits `_id`, `createdAt` and `updatedAt`, so a doc-typed parameter would force
 * a cast at every call site. Naming the fields the view needs keeps those casts
 * out and documents the contract at the same time.
 */
export interface StockItemLike {
  _id: unknown;
  name: string;
  unit?: string | null;
  purchasePrice?: number | null;
  salePrice?: number | null;
  openingStock?: number | null;
  lowStockThreshold?: number | null;
  note?: string | null;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StockItemView {
  id: string;
  name: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  openingStock: number;
  lowStockThreshold: number;
  note: string;
  photoUrl: string;
  /** Derived live quantity — never stored. */
  quantity: number;
  /** Cost basis: quantity × purchasePrice. */
  costValue: number;
  /** What the remaining stock would fetch at salePrice. */
  saleValue: number;
  /** True when a threshold is set and the quantity has reached it. */
  lowStock: boolean;
  movementCount: number;
  /** "স্টক: ১২ পিস" */
  quantityLabel: string;
  /** "মূল্য ৳১,২০০.০০" */
  valueLabel: string;
  /** "ক্রয় ৳১০০.০০ · বিক্রয় ৳১২০.০০" */
  priceLabel: string;
  /** "স্টক কম" — rendered as a badge; empty when the item is fine. */
  lowStockLabel: string;
  /** "সর্বশেষ ০৪ অক্টোবর, ২৬" — empty until the item has movements. */
  lastMovementLabel: string;
  createdAt: Date;
  updatedAt: Date;
}

export function stockItemView(
  item: StockItemLike,
  totals: StockTotals = NO_TOTALS,
  lastMovementAt: Date | null = null,
): StockItemView {
  const quantity = quantityOf(item, totals);
  const purchase = item.purchasePrice || 0;
  const sale = item.salePrice || 0;
  const threshold = item.lowStockThreshold || 0;
  const unit = item.unit || 'পিস';

  return {
    id: String(item._id),
    name: item.name,
    unit,
    purchasePrice: purchase,
    salePrice: sale,
    openingStock: item.openingStock || 0,
    lowStockThreshold: threshold,
    note: item.note || '',
    photoUrl: item.photoUrl || '',
    quantity,
    costValue: quantity * purchase,
    saleValue: quantity * sale,
    // A threshold of 0 means "do not warn", which is why this is not `quantity <= 0`
    // — an item that has run out is only flagged if the user asked to be told.
    lowStock: threshold > 0 && quantity <= threshold,
    movementCount: totals.count,
    quantityLabel: `স্টক: ${qtyBn(quantity)} ${unit}`,
    valueLabel: `মূল্য ${money(quantity * purchase).display}`,
    priceLabel: `ক্রয় ${money(purchase).display} · বিক্রয় ${money(sale).display}`,
    lowStockLabel: threshold > 0 && quantity <= threshold ? 'স্টক কম' : '',
    lastMovementLabel: lastMovementAt ? `সর্বশেষ ${dateBn(lastMovementAt)}` : '',
    createdAt: item.createdAt || new Date(0),
    updatedAt: item.updatedAt || item.createdAt || new Date(0),
  };
}

export interface StockSummary {
  itemCount: number;
  /** Sum of every item's quantity. Mixed units, so this is a rough figure. */
  totalQuantity: number;
  /** Stock at cost — the number a shopkeeper thinks of as "money on the shelf". */
  costValue: number;
  /** The same stock at sale price, i.e. what it should turn into. */
  saleValue: number;
  lowStockCount: number;
  countLabel: string;
  costValueLabel: string;
  saleValueLabel: string;
  lowStockLabel: string;
}

export function summarise(items: StockItemView[]): StockSummary {
  const costValue = items.reduce((n, i) => n + i.costValue, 0);
  const saleValue = items.reduce((n, i) => n + i.saleValue, 0);
  const totalQuantity = items.reduce((n, i) => n + i.quantity, 0);
  const lowStockCount = items.filter((i) => i.lowStock).length;

  return {
    itemCount: items.length,
    totalQuantity,
    costValue,
    saleValue,
    lowStockCount,
    countLabel: `পণ্য ${toBn(items.length)}টি`,
    costValueLabel: `স্টকের মূল্য ${money(costValue).display}`,
    saleValueLabel: `বিক্রয় মূল্য ${money(saleValue).display}`,
    // Only mentioned when there is something to mention, so the header does not
    // carry a permanent "স্টক কম ০টি".
    lowStockLabel: lowStockCount > 0 ? `স্টক কম ${toBn(lowStockCount)}টি` : '',
  };
}

/** Newest movement date per item, for the "সর্বশেষ …" line on each row. */
export async function lastMovementFor(
  scope: Scope,
  itemIds: OwnerId[],
): Promise<Map<string, Date>> {
  if (!itemIds.length) return new Map();

  const rows = await StockMovement.aggregate<{ _id: unknown; last: Date }>([
    { $match: { ...scopeFilter(scope), item: { $in: asIds(itemIds) } } },
    { $group: { _id: '$item', last: { $max: '$date' } } },
  ]);

  return new Map(rows.map((r) => [String(r._id), r.last]));
}

/** Everything in this book, name-ordered, with derived quantities. */
export async function listStockItems(scope: Scope): Promise<StockItemView[]> {
  const docs = await StockItem.find(scopeFilter(scope)).sort({ name: 1, _id: 1 });
  if (!docs.length) return [];

  const ids = docs.map((d) => d._id);
  const [totals, last] = await Promise.all([
    movementTotalsFor(scope, ids),
    lastMovementFor(scope, ids),
  ]);

  return docs.map((d) =>
    stockItemView(
      d as unknown as StockItemLike,
      totals.get(String(d._id)) || NO_TOTALS,
      last.get(String(d._id)) || null,
    ),
  );
}

/** One item, or a 404. `scopeFilter` is what stops a cross-account read. */
export async function findStockItem(scope: Scope, id: string): Promise<StockItemLike> {
  const doc = await StockItem.findOne({ ...scopeFilter(scope), _id: id }).catch(() => null);
  if (!doc) throw notFound('পণ্যটি পাওয়া যায়নি');
  return doc as unknown as StockItemLike;
}

export interface StockMovementView {
  id: string;
  direction: 'in' | 'out';
  quantity: number;
  unitCost: number;
  note: string;
  date: Date;
  /** "স্টক ইন ১২ পিস" */
  title: string;
  /** "০৪ অক্টোবর, ২৬ · নতুন মাল" */
  subtitle: string;
  /** "+১২ পিস" / "−১২ পিস" */
  quantityLabel: string;
  /** "৳১,২০০.০০" */
  amountLabel: string;
  /** "in" | "out" — drives the row's colour, like `LedgerEntryView.tone`. */
  tone: 'in' | 'out';
}

/** The movement fields the view reads — structural, for the same reason as [StockItemLike]. */
export interface StockMovementLike {
  _id: unknown;
  direction: string;
  quantity: number;
  unitCost?: number | null;
  note?: string | null;
  date: Date;
}

export function stockMovementView(m: StockMovementLike, unit: string): StockMovementView {
  const inbound = m.direction !== 'out';
  const quantity = m.quantity || 0;
  const cost = (m.unitCost || 0) * quantity;

  return {
    id: String(m._id),
    direction: inbound ? 'in' : 'out',
    quantity,
    unitCost: m.unitCost || 0,
    note: m.note || '',
    date: m.date,
    title: inbound ? `স্টক ইন ${qtyBn(quantity)} ${unit}` : `স্টক আউট ${qtyBn(quantity)} ${unit}`,
    subtitle: [dateBn(m.date), m.note || ''].filter(Boolean).join(' · '),
    quantityLabel: `${inbound ? '+' : '−'}${qtyBn(quantity)} ${unit}`,
    amountLabel: money(cost).display,
    tone: inbound ? 'in' : 'out',
  };
}

export interface CascadeStockCounts {
  movements: number;
}

/**
 * Deletes an item and its movement history.
 *
 * The photo lives in Cloudinary, not Mongo, so it is destroyed first — a plain
 * cascade would leave the image orphaned in the account forever. Same ordering
 * and same reasoning as `deleteBusinessCascade`.
 */
export async function deleteStockItemCascade(
  item: Pick<StockItemLike, '_id' | 'photoPublicId'>,
): Promise<CascadeStockCounts> {
  const pid = item.photoPublicId;
  if (pid) await destroyImage(pid).catch(() => {});

  const removed = await StockMovement.deleteMany({ item: item._id });
  return { movements: removed.deletedCount || 0 };
}
