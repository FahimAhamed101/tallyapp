import Business, { type BusinessDoc } from './models/Business';
import Customer from './models/Customer';
import Transaction from './models/Transaction';
import CashboxEntry from './models/CashboxEntry';
import Note from './models/Note';
import { type UserDoc } from './models/User';
import { isObjectId, notFound } from './api-helpers';
import { destroyImage } from './cloudinary';
import { money, toBn } from './bengali';
import { balancesFor, type OwnerId } from './ledger';
import { type Scope, scopeFilter } from './scope';

export type { Scope };
export { scopeFilter };

/**
 * Multi-business support (মাল্টি ব্যবসা).
 *
 * Before this existed, every document was scoped by `owner` alone, so a
 * shopkeeper had exactly one book. Now each document also carries a `business`,
 * and the client picks which book it is talking to with an `X-Business-Id`
 * header.
 *
 * Two decisions are worth stating outright:
 *
 *   1. **The header is optional.** An APK built before this feature sends no
 *      header at all, and it still has to work. `resolveBusiness` falls back to
 *      the account's primary business, so old clients keep reading and writing
 *      exactly one book — which is precisely the behaviour they were built for.
 *
 *   2. **Nothing is migrated up front.** Accounts that already have customers
 *      get their primary business created on first use, and their existing
 *      documents are *adopted* into it in the same call. That keeps the change
 *      deployable without a downtime window, and it self-heals an account that
 *      was only partly provisioned.
 */

/** The header the client uses to say which book it means. */
export const BUSINESS_HEADER = 'x-business-id';

export const scopeOf = (user: UserDoc, business: BusinessDoc | null): Scope => ({
  owner: user._id,
  business: business ? business._id : null,
});

/**
 * Adopts documents that predate multi-business support into `businessId`.
 *
 * Guarded by three counts so the steady state costs nothing: once every
 * document has a business, this returns without writing anything.
 */
async function adoptOrphans(owner: OwnerId, businessId: unknown): Promise<void> {
  const orphan = { owner, business: null };
  const [customers, transactions, entries] = await Promise.all([
    Customer.countDocuments(orphan),
    Transaction.countDocuments(orphan),
    CashboxEntry.countDocuments(orphan),
  ]);
  if (!customers && !transactions && !entries) return;

  await Promise.all([
    Customer.updateMany(orphan, { $set: { business: businessId } }),
    Transaction.updateMany(orphan, { $set: { business: businessId } }),
    CashboxEntry.updateMany(orphan, { $set: { business: businessId } }),
  ]);
}

/**
 * The account's primary book, created on first use.
 *
 * Hot path is a single indexed lookup — the adoption sweep only runs while the
 * account still has no primary business.
 */
export async function ensurePrimaryBusiness(user: UserDoc): Promise<BusinessDoc> {
  const owner = user._id;

  const primary = await Business.findOne({ owner, isPrimary: true });
  if (primary) return primary;

  // Either this account predates the feature, or provisioning was interrupted.
  let doc = await Business.findOne({ owner }).sort({ createdAt: 1, _id: 1 });
  if (!doc) {
    doc = await Business.create({
      owner,
      name: (user.name || '').trim() || 'আমার ব্যবসা',
      isPrimary: true,
    });
  } else if (!doc.isPrimary) {
    doc.isPrimary = true;
    await doc.save();
  }

  await adoptOrphans(owner, doc._id);
  return doc;
}

/**
 * Which book this request is about.
 *
 * Falls back to the primary when the header is absent, so a client that knows
 * nothing about multi-business still works.
 */
export async function resolveBusiness(req: Request, user: UserDoc): Promise<BusinessDoc> {
  const primary = await ensurePrimaryBusiness(user);

  const raw = (req.headers.get(BUSINESS_HEADER) || '').trim();
  if (!raw || raw === String(primary._id)) return primary;
  // A malformed or foreign id is reported as missing rather than forbidden, so
  // the response cannot be used to probe which business ids exist. A *deleted*
  // book lands here too, which is what the client's stale-selection retry is for.
  if (!isObjectId(raw)) throw notFound('ব্যবসাটি পাওয়া যায়নি');

  const doc = await Business.findOne({ _id: raw, owner: user._id });
  if (!doc) throw notFound('ব্যবসাটি পাওয়া যায়নি');
  return doc;
}

/** Convenience: the scope for the request's active book. */
export async function resolveScope(
  req: Request,
  user: UserDoc,
): Promise<{ business: BusinessDoc; scope: Scope }> {
  const business = await resolveBusiness(req, user);
  return { business, scope: scopeOf(user, business) };
}

export interface BusinessView {
  id: string;
  name: string;
  isPrimary: boolean;
  customerCount: number;
  supplierCount: number;
  /** The book's net receivable (পাবো), on the same rule the home tab uses. */
  receivable: number;
  /** "কাস্টমার ১, সাপ্লায়ার ০" — the sheet's row subtitle, part one. */
  customerLabel: string;
  /** "মোট পাওয়া ০.০০" — the sheet's row subtitle, part two. */
  receivableLabel: string;
  createdAt: Date;
}

interface Tally {
  customer: number;
  supplier: number;
  receivable: number;
}

const EMPTY_TALLY: Tally = { customer: 0, supplier: 0, receivable: 0 };

/**
 * Per-business customer, supplier and receivable tallies for one account.
 *
 * Receivable is computed with `balancesFor` and the *same* net-positive rule as
 * `summary()`: only a customer whose net position is positive counts toward
 * পাবো. Reusing that rule matters — if the sheet summed sales and payments
 * itself, the figure here would disagree with the number on the home tab for
 * the very same book.
 */
async function talliesFor(owner: OwnerId): Promise<Map<string, Tally>> {
  const customers = await Customer.find({ owner }, '_id type business').lean();
  const balances = await balancesFor(owner, customers.map((c) => c._id));

  const out = new Map<string, Tally>();
  customers.forEach((c) => {
    const key = String(c.business || '');
    const bucket = out.get(key) || { ...EMPTY_TALLY };
    if (c.type === 'supplier') bucket.supplier += 1;
    else bucket.customer += 1;

    const b = balances.get(String(c._id));
    const net = b ? b.receivable - b.payable : 0;
    if (net > 0.004) bucket.receivable += net;

    out.set(key, bucket);
  });
  return out;
}

export function businessView(biz: BusinessDoc, tally: Tally = EMPTY_TALLY): BusinessView {
  return {
    id: String(biz._id),
    name: biz.name,
    isPrimary: !!biz.isPrimary,
    customerCount: tally.customer,
    supplierCount: tally.supplier,
    receivable: tally.receivable,
    customerLabel: `কাস্টমার ${toBn(tally.customer)}, সাপ্লায়ার ${toBn(tally.supplier)}`,
    receivableLabel: `মোট পাবো ${money(tally.receivable).display}`,
    createdAt: biz.createdAt,
  };
}

/** Every book on the account, oldest first, with live tallies. */
export async function listBusinesses(user: UserDoc): Promise<BusinessView[]> {
  await ensurePrimaryBusiness(user);

  const [docs, tallies] = await Promise.all([
    Business.find({ owner: user._id }).sort({ createdAt: 1, _id: 1 }),
    talliesFor(user._id),
  ]);

  return docs.map((d) => businessView(d, tallies.get(String(d._id)) || EMPTY_TALLY));
}

/** How many books the account has, for the (১/৫) header. */
export async function businessCount(user: UserDoc): Promise<number> {
  await ensurePrimaryBusiness(user);
  return Business.countDocuments({ owner: user._id });
}

export interface CascadeCounts {
  customers: number;
  transactions: number;
  cashboxEntries: number;
}

/**
 * Deletes a book and everything in it.
 *
 * Photos live in Cloudinary, not Mongo, so a plain cascade would leave them
 * behind in the account — they are destroyed explicitly first.
 *
 * Shared by the owner-facing route and the admin panel on purpose: two copies
 * of this would eventually diverge, and the failure mode is silent (orphaned
 * documents, or images that outlive the book they belonged to).
 */
export async function deleteBusinessCascade(
  owner: OwnerId,
  businessId: unknown,
): Promise<CascadeCounts> {
  const customers = await Customer.find({ owner, business: businessId }, 'photoPublicId');
  await Promise.all(
    customers
      .map((c) => c.photoPublicId)
      .filter((pid): pid is string => Boolean(pid))
      .map((pid) => destroyImage(pid).catch(() => {})),
  );

  const [removedCustomers, removedTransactions, removedEntries] = await Promise.all([
    Customer.deleteMany({ owner, business: businessId }),
    Transaction.deleteMany({ owner, business: businessId }),
    CashboxEntry.deleteMany({ owner, business: businessId }),
    // ব্যবসার নোট belong to the book too; not counted, since the admin panel's
    // `removed` contract predates them.
    Note.deleteMany({ owner, business: businessId }),
  ]);

  return {
    customers: removedCustomers.deletedCount || 0,
    transactions: removedTransactions.deletedCount || 0,
    cashboxEntries: removedEntries.deletedCount || 0,
  };
}

/**
 * Restores the "exactly one primary" invariant after a deletion: if the primary
 * went away, the oldest survivor is promoted. Without this a later
 * `ensurePrimaryBusiness` could pick an arbitrary book.
 */
export async function promoteOldestIfNeeded(owner: OwnerId): Promise<void> {
  const survivor = await Business.findOne({ owner }).sort({ createdAt: 1, _id: 1 });
  if (survivor && !survivor.isPrimary) {
    survivor.isPrimary = true;
    await survivor.save();
  }
}
