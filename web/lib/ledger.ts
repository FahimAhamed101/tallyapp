import Transaction from './models/Transaction';
import { amount, relativeBn } from './bengali';

/**
 * Balances are always derived from the ledger, never stored, so a form write
 * can never leave a stale total behind.
 *
 *   receivable (পাবো) = sale - refund - payment_received
 *   payable    (দেবো) = purchase - payment_made
 */

/**
 * Anything mongoose accepts as an owner reference: a 24-hex string, a real
 * ObjectId instance, or the ObjectId *constructor* type that `InferSchemaType`
 * produces for a `type: Types.ObjectId` path. Mongoose casts all of them, so
 * the alias is deliberately permissive.
 */
export type OwnerId = unknown;

export interface Balance {
  receivable: number;
  payable: number;
  lastDate: Date | null;
  count: number;
}

const GROUP_STAGE = {
  $group: {
    _id: '$customer',
    sale: { $sum: { $cond: [{ $eq: ['$kind', 'sale'] }, '$amount', 0] } },
    refund: { $sum: { $cond: [{ $eq: ['$kind', 'refund'] }, '$amount', 0] } },
    received: { $sum: { $cond: [{ $eq: ['$kind', 'payment_received'] }, '$amount', 0] } },
    purchase: { $sum: { $cond: [{ $eq: ['$kind', 'purchase'] }, '$amount', 0] } },
    made: { $sum: { $cond: [{ $eq: ['$kind', 'payment_made'] }, '$amount', 0] } },
    lastDate: { $max: '$date' },
    count: { $sum: 1 },
  },
} as const;

interface GroupRow {
  _id: unknown;
  sale?: number;
  refund?: number;
  received?: number;
  purchase?: number;
  made?: number;
  lastDate?: Date | null;
  count?: number;
}

export function shape(row: GroupRow | undefined | null): Balance {
  if (!row) return { receivable: 0, payable: 0, lastDate: null, count: 0 };
  return {
    receivable: (row.sale || 0) - (row.refund || 0) - (row.received || 0),
    payable: (row.purchase || 0) - (row.made || 0),
    lastDate: row.lastDate || null,
    count: row.count || 0,
  };
}

/** Map of customerId(string) -> balance, scoped to one user's ledger. */
export async function balancesFor(owner: OwnerId, ids: unknown[]): Promise<Map<string, Balance>> {
  const match: Record<string, unknown> = { owner };
  if (ids && ids.length) match.customer = { $in: ids };

  const rows = (await Transaction.aggregate([
    { $match: match },
    GROUP_STAGE,
  ])) as GroupRow[];

  const map = new Map<string, Balance>();
  rows.forEach((r) => map.set(String(r._id), shape(r)));
  return map;
}

export async function balanceFor(owner: OwnerId, id: unknown): Promise<Balance> {
  const rows = (await Transaction.aggregate([
    { $match: { owner, customer: id } },
    GROUP_STAGE,
  ])) as GroupRow[];
  return shape(rows[0]);
}

/** Net position of a customer: positive = they owe us, negative = we owe them. */
export function net(balance: Partial<Balance> | null | undefined): number {
  return (balance?.receivable || 0) - (balance?.payable || 0);
}

export type AmountTone = 'pabo' | 'debo' | 'zero';

export interface CustomerView {
  id: string;
  name: string;
  phone: string;
  type: string;
  /** Free-text বিবরণ typed on the add/edit form. */
  note: string;
  initials: string;
  avatarColor: string;
  avatarTextColor: string;
  /** Cloudinary URL when the user attached a photo, otherwise ''. */
  photoUrl: string;
  subtitle: string;
  lastActivityAt: Date;
  amountRaw: number;
  amountDisplay: string;
  amountTone: AmountTone;
  receivable: number;
  payable: number;
  net: number;
  transactionCount: number;
}

interface CustomerLike {
  _id: unknown;
  name: string;
  phone?: string;
  type?: string;
  note?: string;
  initials?: string;
  avatarColor?: string;
  avatarTextColor?: string;
  photoUrl?: string;
  lastActivityAt?: Date;
  createdAt?: Date;
}

/**
 * The JSON shape every customer row/header in the app consumes. The Android
 * side only picks a colour from `amountTone`; all text is pre-formatted.
 */
export function customerView(customer: CustomerLike, balance?: Balance | null): CustomerView {
  const b: Balance = balance || { receivable: 0, payable: 0, lastDate: null, count: 0 };
  const n = net(b);

  const amountRaw = Math.abs(n);
  let amountTone: AmountTone = 'zero'; // 'pabo' | 'debo' | 'zero'
  if (n > 0.004) amountTone = 'pabo';
  else if (n < -0.004) amountTone = 'debo';

  const lastActivity = b.lastDate || customer.lastActivityAt || customer.createdAt || new Date();

  return {
    id: String(customer._id),
    name: customer.name,
    phone: customer.phone || '',
    type: customer.type || 'customer',
    note: customer.note || '',
    initials: customer.initials || '?',
    avatarColor: customer.avatarColor || '#D1FAD1',
    avatarTextColor: customer.avatarTextColor || '#1A1A1A',
    photoUrl: customer.photoUrl || '',
    subtitle: relativeBn(lastActivity),
    lastActivityAt: lastActivity,
    amountRaw,
    amountDisplay: amount(amountRaw),
    amountTone,
    receivable: b.receivable || 0,
    payable: b.payable || 0,
    net: n,
    transactionCount: b.count || 0,
  };
}

export interface LedgerHeadline {
  label: string;
  tone: AmountTone;
  amountDisplay: string;
}

/** Label shown on the ledger form: পাবো / দেবো / পরিশোধিত. */
export function ledgerHeadline(view: Pick<CustomerView, 'amountTone' | 'amountDisplay'>): LedgerHeadline {
  if (view.amountTone === 'pabo') {
    return { label: 'পাবো', tone: 'pabo', amountDisplay: view.amountDisplay };
  }
  if (view.amountTone === 'debo') {
    return { label: 'দেবো', tone: 'debo', amountDisplay: view.amountDisplay };
  }
  return { label: 'পাবো', tone: 'zero', amountDisplay: amount(0) };
}
