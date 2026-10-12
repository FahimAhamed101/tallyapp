import CashboxEntry from './models/CashboxEntry';
import Transaction from './models/Transaction';
import { amount, dateFullBn, dateShortBn, MONTHS, signedMoney } from './bengali';
import { type Scope, scopeFilter } from './scope';

/**
 * The cash book, and the two reports built on top of it.
 *
 * Two collections move cash, and both have to be read to get the numbers the
 * reference app shows:
 *
 *   CashboxEntry  cash_sale / cash_purchase / expense / owner_in / owner_out
 *   Transaction   payment_received (বাকি আদায়) / payment_made (পেমেন্ট দেয়া)
 *
 * A customer paying off a due puts money in the drawer exactly as a counter
 * sale does, which is why বাকি আদায় and পেমেন্ট দেয়া are rows of the ক্যাশ
 * রিপোর্ট. Reading only CashboxEntry is what left those two rows — and, on the
 * client, the whole screen — showing zeros.
 *
 * The two reports differ in one deliberate way, and the reference is explicit
 * about it:
 *
 *   ক্যাশবক্স রিপোর্ট (day)  opening + every row = the box. ব্যালেন্স equals
 *                            বর্তমান ক্যাশ at the end of that day.
 *   ক্যাশ রিপোর্ট (month)    the table covers business movements only; the
 *                            owner's deposits and withdrawals are reported
 *                            underneath as their own balance. The two halves
 *                            add back up to the box:
 *                            ক্যাশ ব্যালেন্স + মালিকের ব্যালেন্স = বর্তমান ক্যাশ.
 */

export type CashMoveKey =
  | 'cash_sale'
  | 'received'
  | 'owner_in'
  | 'cash_purchase'
  | 'paid'
  | 'expense'
  | 'owner_out';

/** +1 money in, -1 money out. */
export const CASH_DIR: Record<CashMoveKey, 1 | -1> = {
  cash_sale: 1,
  received: 1,
  owner_in: 1,
  cash_purchase: -1,
  paid: -1,
  expense: -1,
  owner_out: -1,
};

export const CASH_LABEL: Record<CashMoveKey, string> = {
  cash_sale: 'ক্যাশ বেচা',
  received: 'বাকি আদায়',
  owner_in: 'মালিক দিল',
  cash_purchase: 'ক্যাশ কেনা',
  paid: 'পেমেন্ট দেয়া',
  expense: 'খরচ',
  owner_out: 'মালিক নিল',
};

export interface CashMovement {
  key: CashMoveKey;
  amount: number;
  date: Date;
}

/** Every rupee that moved through the drawer, from both collections. */
export async function cashMovements(scope: Scope): Promise<CashMovement[]> {
  const filter = scopeFilter(scope);
  const [boxes, payments] = await Promise.all([
    CashboxEntry.find(filter, 'kind amount date').lean(),
    Transaction.find(
      { ...filter, kind: { $in: ['payment_received', 'payment_made'] } },
      'kind amount date',
    ).lean(),
  ]);

  const moves: CashMovement[] = boxes.map((e) => ({
    key: e.kind as CashMoveKey,
    amount: Number(e.amount) || 0,
    date: new Date(e.date),
  }));

  payments.forEach((t) => {
    moves.push({
      key: t.kind === 'payment_received' ? 'received' : 'paid',
      amount: Number(t.amount) || 0,
      date: new Date(t.date),
    });
  });

  return moves;
}

/** The drawer's balance — what the app calls বর্তমান ক্যাশ. */
export function cashBalance(moves: CashMovement[]): number {
  return moves.reduce((sum, m) => sum + CASH_DIR[m.key] * m.amount, 0);
}

/** Signed sum of everything strictly before `at` — a period's opening. */
export function cashBefore(moves: CashMovement[], at: Date): number {
  const t = at.getTime();
  return moves.reduce((sum, m) => (m.date.getTime() < t ? sum + CASH_DIR[m.key] * m.amount : sum), 0);
}

// ---- periods ---------------------------------------------------------------

export type ReportPeriod = 'day' | 'month';

/** Local midnight to the next local midnight — the day the user is looking at. */
export function dayBounds(d: Date): { from: Date; to: Date } {
  const from = new Date(d);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export function monthBounds(d: Date): { from: Date; to: Date } {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { from, to };
}

export function boundsFor(period: ReportPeriod, d: Date): { from: Date; to: Date } {
  return period === 'day' ? dayBounds(d) : monthBounds(d);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' — the key the client sends back to pick a day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM' — the key for a month. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function periodKey(period: ReportPeriod, d: Date): string {
  return period === 'day' ? dayKey(d) : monthKey(d);
}

/**
 * Parses the client's period key, falling back to now.
 *
 * A malformed key must not 500: the client sends the key it was handed, and a
 * report that refuses to open because of a stray character is worse than one
 * that opens on the current period.
 */
export function parsePeriodKey(period: ReportPeriod, key: string | null): Date {
  if (!key) return new Date();
  const m = period === 'day' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return new Date();
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = period === 'day' ? Number(m[3]) : 1;
  const d = period === 'day' ? new Date(year, month, day) : new Date(year, month, 1);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Whether a later period exists.
 *
 * The reference never lets the arrows walk into the future, so the boundary is
 * "does the next period start at or before the current one".
 */
export function canGoNext(period: ReportPeriod, to: Date): boolean {
  const thisPeriod = boundsFor(period, new Date()).from.getTime();
  return to.getTime() <= thisPeriod;
}

// ---- views -----------------------------------------------------------------

export interface ReportAmount {
  raw: number;
  display: string;
}

export interface SignedAmount extends ReportAmount {
  negative: boolean;
}

export interface CashReportRow {
  key: string;
  label: string;
  /** Which column the row belongs in — the reference never moves one. */
  tone: 'in' | 'out';
  amount: ReportAmount;
}

export interface CashReportView {
  period: ReportPeriod;
  periodKey: string;
  periodLabel: string;
  canPrev: boolean;
  canNext: boolean;
  rows: CashReportRow[];
  totalIn: ReportAmount;
  totalOut: ReportAmount;
  balance: SignedAmount;
  owner: { gave: ReportAmount; took: ReportAmount; balance: SignedAmount };
}

/** Rows the day tab shows in its table, in the reference's order. */
const DAY_ROWS: CashMoveKey[] = [
  'cash_sale',
  'received',
  'owner_in',
  'cash_purchase',
  'paid',
  'expense',
  'owner_out',
];

/** The month tab splits the owner out, so its table is the business only. */
const MONTH_ROWS: CashMoveKey[] = [
  'cash_sale',
  'received',
  'cash_purchase',
  'paid',
  'expense',
];

export async function cashReport(
  scope: Scope,
  period: ReportPeriod,
  key: string | null,
): Promise<CashReportView> {
  const anchor = parsePeriodKey(period, key);
  const { from, to } = boundsFor(period, anchor);
  const moves = await cashMovements(scope);

  const totals = {} as Record<CashMoveKey, number>;
  (Object.keys(CASH_DIR) as CashMoveKey[]).forEach((k) => {
    totals[k] = 0;
  });

  let windowNet = 0;
  moves.forEach((m) => {
    const t = m.date.getTime();
    if (t < from.getTime() || t >= to.getTime()) return;
    totals[m.key] += m.amount;
    windowNet += CASH_DIR[m.key] * m.amount;
  });

  const opening = cashBefore(moves, from);
  const openingLabel = period === 'day' ? 'দিনের শুরুরে ক্যাশ' : 'মাসের শুরুরে ক্যাশ';
  const keys = period === 'day' ? DAY_ROWS : MONTH_ROWS;

  const rows: CashReportRow[] = [
    { key: 'opening', label: openingLabel, tone: 'in', amount: { raw: opening, display: amount(opening) } },
    ...keys.map((k) => ({
      key: k,
      label: CASH_LABEL[k],
      tone: (CASH_DIR[k] > 0 ? 'in' : 'out') as 'in' | 'out',
      amount: { raw: totals[k], display: amount(totals[k]) },
    })),
  ];

  const totalIn = opening + rows.slice(1).reduce((s, r) => (r.tone === 'in' ? s + r.amount.raw : s), 0);
  const totalOut = rows.slice(1).reduce((s, r) => (r.tone === 'out' ? s + r.amount.raw : s), 0);

  // The month table excludes the owner on purpose, so its balance is the
  // business half of the drawer; the day table is the whole drawer.
  const balance = period === 'day' ? opening + windowNet : totalIn - totalOut;

  return {
    period,
    periodKey: periodKey(period, from),
    periodLabel: period === 'day' ? dateShortBn(from) : MONTHS[from.getMonth()],
    canPrev: true,
    canNext: canGoNext(period, to),
    rows,
    totalIn: { raw: totalIn, display: amount(totalIn) },
    totalOut: { raw: totalOut, display: amount(totalOut) },
    balance: signedMoney(balance),
    owner: {
      gave: { raw: totals.owner_in, display: amount(totals.owner_in) },
      took: { raw: totals.owner_out, display: amount(totals.owner_out) },
      balance: signedMoney(totals.owner_in - totals.owner_out),
    },
  };
}

export interface OwnerReportDay {
  dateLabel: string;
  gave: ReportAmount;
  took: ReportAmount;
}

export interface OwnerReportView {
  periodKey: string;
  periodLabel: string;
  canPrev: boolean;
  canNext: boolean;
  rows: OwnerReportDay[];
  totalGave: ReportAmount;
  totalTook: ReportAmount;
  balance: SignedAmount;
}

/**
 * মালিকের রিপোর্ট — one row per day, not one row per entry.
 *
 * The reference groups: two deposits and a withdrawal on the same afternoon are
 * a single ১২ অক্টোবর row. Listing each entry separately would put the same
 * date on screen three times and make মোট something the user has to add up.
 */
export async function ownerReport(scope: Scope, key: string | null): Promise<OwnerReportView> {
  const anchor = parsePeriodKey('month', key);
  const { from, to } = monthBounds(anchor);
  const moves = await cashMovements(scope);

  const byDay = new Map<string, { date: Date; gave: number; took: number }>();
  let totalGave = 0;
  let totalTook = 0;

  moves.forEach((m) => {
    if (m.key !== 'owner_in' && m.key !== 'owner_out') return;
    const t = m.date.getTime();
    if (t < from.getTime() || t >= to.getTime()) return;
    const k = dayKey(m.date);
    const bucket = byDay.get(k) || { date: m.date, gave: 0, took: 0 };
    if (m.key === 'owner_in') {
      bucket.gave += m.amount;
      totalGave += m.amount;
    } else {
      bucket.took += m.amount;
      totalTook += m.amount;
    }
    byDay.set(k, bucket);
  });

  const rows: OwnerReportDay[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, b]) => ({
      dateLabel: dateFullBn(b.date),
      gave: { raw: b.gave, display: amount(b.gave) },
      took: { raw: b.took, display: amount(b.took) },
    }));

  return {
    periodKey: monthKey(from),
    periodLabel: MONTHS[from.getMonth()],
    canPrev: true,
    canNext: canGoNext('month', to),
    rows,
    totalGave: { raw: totalGave, display: amount(totalGave) },
    totalTook: { raw: totalTook, display: amount(totalTook) },
    balance: signedMoney(totalGave - totalTook),
  };
}
