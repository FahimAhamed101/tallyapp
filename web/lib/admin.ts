import User from './models/User';
import Business from './models/Business';
import Customer from './models/Customer';
import Transaction from './models/Transaction';
import CashboxEntry from './models/CashboxEntry';

/**
 * Helpers for the superadmin panel.
 *
 * The panel looks across *all* users, so every list needs to say which account
 * a row belongs to. Rather than a $lookup on every query, one small in-memory
 * index of `ownerId -> { name, phone }` is built per request and used to
 * annotate the rows.
 */

export interface OwnerInfo {
  id: string;
  name: string;
  phone: string;
  role: string;
  disabled: boolean;
}

export type OwnerIndex = Map<string, OwnerInfo>;

export async function ownerIndex(): Promise<OwnerIndex> {
  const users = await User.find({}, '_id name phone role disabled').lean();
  const map: OwnerIndex = new Map();
  users.forEach((u) => {
    map.set(String(u._id), {
      id: String(u._id),
      name: u.name,
      phone: u.phone,
      role: u.role || 'user',
      disabled: !!u.disabled,
    });
  });
  return map;
}

export function ownerOf(index: OwnerIndex, owner: unknown) {
  const key = String(owner);
  return index.get(key) ?? { id: key, name: '—', phone: '', role: 'user', disabled: false };
}

/** Escape a user-supplied string for use inside a RegExp. */
export const escapeRegex = (s: unknown): string =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface PlatformStats {
  users: { total: number; admins: number; disabled: number; newLast7Days: number };
  businesses: { total: number; primaries: number; multiBookAccounts: number };
  customers: { total: number; customers: number; suppliers: number };
  transactions: { total: number; byKind: Record<string, { count: number; total: number }> };
  cashbox: { total: number; byKind: Record<string, { count: number; total: number }> };
  photos: { customersWithPhoto: number; entriesWithPhoto: number };
  generatedAt: Date;
}

/** Platform-wide aggregates for the panel dashboard. */
export async function platformStats(): Promise<PlatformStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  const [
    userTotal,
    adminTotal,
    disabledTotal,
    newUsers,
    customerTotal,
    supplierTotal,
    photoCustomers,
    photoEntries,
    txAgg,
    cashAgg,
    businessTotal,
    businessPrimaries,
    multiBookAgg,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ disabled: true }),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Customer.countDocuments({ type: 'customer' }),
    Customer.countDocuments({ type: 'supplier' }),
    Customer.countDocuments({ photoUrl: { $nin: ['', null] } }),
    CashboxEntry.countDocuments({ hasPhoto: true }),
    Transaction.aggregate([
      { $group: { _id: '$kind', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    CashboxEntry.aggregate([
      { $group: { _id: '$kind', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    Business.countDocuments({}),
    Business.countDocuments({ isPrimary: true }),
    // How many shopkeepers actually use multi-business — the number that says
    // whether the feature is worth keeping. One group, one count.
    Business.aggregate([
      { $group: { _id: '$owner', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: 'n' },
    ]),
  ]);

  const toMap = (rows: { _id: string; count: number; total: number }[]) => {
    const out: Record<string, { count: number; total: number }> = {};
    rows.forEach((r) => {
      out[r._id] = { count: r.count, total: r.total };
    });
    return out;
  };

  const txByKind = toMap(txAgg as { _id: string; count: number; total: number }[]);
  const cashByKind = toMap(cashAgg as { _id: string; count: number; total: number }[]);

  const sum = (m: Record<string, { count: number }>) =>
    Object.values(m).reduce((acc, v) => acc + v.count, 0);

  return {
    users: {
      total: userTotal,
      admins: adminTotal,
      disabled: disabledTotal,
      newLast7Days: newUsers,
    },
    businesses: {
      total: businessTotal,
      primaries: businessPrimaries,
      multiBookAccounts: (multiBookAgg as { n: number }[])[0]?.n || 0,
    },
    customers: {
      total: customerTotal + supplierTotal,
      customers: customerTotal,
      suppliers: supplierTotal,
    },
    transactions: { total: sum(txByKind), byKind: txByKind },
    cashbox: { total: sum(cashByKind), byKind: cashByKind },
    photos: { customersWithPhoto: photoCustomers, entriesWithPhoto: photoEntries },
    generatedAt: new Date(),
  };
}
