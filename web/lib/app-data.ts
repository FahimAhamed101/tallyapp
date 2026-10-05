import Profile from './models/Profile';
import Wallet from './models/Wallet';
import Customer from './models/Customer';
import Transaction from './models/Transaction';
import CashboxEntry, { type CashboxKind } from './models/CashboxEntry';
import { amount, dateBn, money, relativeBn, toBn, initialsFor } from './bengali';
import { balancesFor, type OwnerId } from './ledger';
import { summary, type Summary } from './summary';

/**
 * The server-driven screen payloads: profile, wallet, menu, home summary and
 * the cashbox dashboard. Extracted from the Express routes so the Android
 * endpoints and the admin panel render exactly the same numbers from one place.
 */

export const SERVICE_ICON: Record<string, string> = {
  add_money: 'add_money',
  send_money: 'send_money',
  bank_transfer: 'bank_transfer',
  wallet_transfer: 'wallet_transfer',
  mobile_recharge: 'mobile_recharge',
  tally_transfer: 'tally_transfer',
  qr_code: 'qr_code',
  bill_payment: 'bill_payment',
};

export interface ProfileView {
  id: string;
  name: string;
  phone: string;
  initials: string;
  photoUrl: string;
  goldPlanName: string;
  goldTrialDays: number;
  goldTrialLabel: string;
  inboxUnread: number;
  smsRemaining: number;
  smsLabel: string;
  appVersion: string;
}

interface UserLike {
  _id: unknown;
  name: string;
  phone: string;
  photoUrl?: string;
}

/**
 * A profile is created at registration, but a self-healing getter means a
 * partially provisioned account can never render a broken toolbar.
 */
export async function getProfile(user: UserLike): Promise<ProfileView> {
  let doc = await Profile.findOne({ owner: user._id as never });
  if (!doc) {
    doc = await Profile.create({
      owner: user._id,
      name: user.name,
      phone: user.phone,
      initials: initialsFor(user.name),
      photoUrl: user.photoUrl || '',
    });
  }
  return {
    id: String(doc._id),
    name: doc.name,
    phone: doc.phone,
    initials: doc.initials,
    photoUrl: doc.photoUrl || '',
    goldPlanName: doc.goldPlanName,
    goldTrialDays: doc.goldTrialDays,
    goldTrialLabel: `অবশিষ্ট: ${toBn(doc.goldTrialDays)} দিন`,
    inboxUnread: doc.inboxUnread,
    smsRemaining: doc.smsRemaining,
    smsLabel: `টালি-মেসেজ অবশিষ্ট: ${toBn(doc.smsRemaining)}`,
    appVersion: doc.appVersion,
  };
}

export interface WalletView {
  id: string;
  balance: { raw: number; display: string };
  accountOpened: boolean;
  services: { key: string; label: string; icon: string; enabled: boolean }[];
  benefits: string[];
}

export async function getWallet(owner: OwnerId): Promise<WalletView> {
  let doc = await Wallet.findOne({ owner });
  if (!doc) {
    doc = await Wallet.create({
      owner,
      balance: 0,
      accountOpened: false,
      services: Wallet.DEFAULT_SERVICES.map((s) => ({ ...s })),
      benefits: [...Wallet.DEFAULT_BENEFITS],
    });
  }
  return {
    id: String(doc._id),
    balance: money(doc.balance),
    accountOpened: doc.accountOpened,
    services: doc.services.map((s) => ({
      key: String(s.key || ''),
      label: String(s.label || ''),
      icon: SERVICE_ICON[String(s.key || '')] || String(s.key || ''),
      enabled: !!s.enabled,
    })),
    benefits: doc.benefits.map((b) => String(b)),
  };
}

export interface MenuView {
  sections: {
    title: string;
    items: { key: string; label: string; icon: string; count: number }[];
  }[];
  version: string;
  profile: ProfileView;
}

export async function getMenu(user: UserLike): Promise<MenuView> {
  const owner = user._id;
  const [profile, txCount, expenseCount, cashCount, customers] = await Promise.all([
    getProfile(user),
    Transaction.countDocuments({ owner }),
    CashboxEntry.countDocuments({ owner, kind: 'expense' }),
    CashboxEntry.countDocuments({ owner }),
    Customer.find({ owner }, '_id'),
  ]);

  const balances = await balancesFor(owner as OwnerId, customers.map((c) => c._id));
  let dueCount = 0;
  balances.forEach((b) => {
    if (Math.abs(b.receivable - b.payable) > 0.004) dueCount += 1;
  });

  const days = await CashboxEntry.distinct('date', { owner });
  const dayCount = new Set(days.map((d: Date) => new Date(d).toDateString())).size;

  return {
    sections: [
      {
        title: 'টালিখাতা',
        items: [
          { key: 'ledger', label: 'বেচা কেনা হিসাব', icon: 'note_edit', count: txCount },
          { key: 'expense', label: 'খরচ', icon: 'arrow_out', count: expenseCount },
          { key: 'due', label: 'বাকি হিসাব', icon: 'inbox_doc', count: dueCount },
          { key: 'cash', label: 'ক্যাশ হিসাব', icon: 'document', count: cashCount },
          { key: 'report', label: 'মালিকের রিপোর্ট', icon: 'chart', count: dayCount },
        ],
      },
      {
        title: 'অন্যান্য',
        items: [
          { key: 'settings', label: 'সেটিংস', icon: 'gear', count: 0 },
          { key: 'refer', label: 'টালিখাতা গোল্ড রেফার করুন', icon: 'arrow_out', count: 0 },
        ],
      },
    ],
    version: `ভার্সন - ${profile.appVersion}`,
    profile,
  };
}

export interface SummaryView {
  receivable: { raw: number; display: string };
  payable: { raw: number; display: string };
  customerCount: number;
  supplierCount: number;
  customerLabel: string;
  transactionCount: number;
}

export async function getSummary(owner: OwnerId): Promise<SummaryView> {
  const s: Summary = await summary(owner);
  return {
    receivable: money(s.receivable),
    payable: money(s.payable),
    customerCount: s.customerCount,
    supplierCount: s.supplierCount,
    customerLabel: `কাস্টমার ${toBn(s.customerCount)} / সাপ্লায়ার ${toBn(s.supplierCount)}`,
    transactionCount: s.transactionCount,
  };
}

// ---- cashbox --------------------------------------------------------------

export const CASHBOX_KIND_TITLE: Record<CashboxKind, string> = {
  cash_sale: 'কাশ বেচা',
  cash_purchase: 'কাশ কেনা',
  expense: 'খরচ',
  owner_in: 'মালিক দিল',
  owner_out: 'মালিক নিল',
};

export const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export interface CashboxEntryView {
  id: string;
  kind: CashboxKind;
  title: string;
  amountRaw: number;
  amountDisplay: string;
  description: string;
  category: string;
  dateDisplay: string;
  date: Date;
}

export function cashboxEntryView(e: {
  _id: unknown;
  kind: CashboxKind;
  amount: number;
  description?: string;
  category?: string;
  date: Date;
}): CashboxEntryView {
  return {
    id: String(e._id),
    kind: e.kind,
    title: CASHBOX_KIND_TITLE[e.kind] || e.kind,
    amountRaw: e.amount,
    amountDisplay: amount(e.amount),
    description: e.description || '',
    category: e.category || '',
    dateDisplay: dateBn(e.date),
    date: e.date,
  };
}

export interface CashboxDashboard {
  todaySale: { raw: number; display: string };
  currentCash: { raw: number; display: string };
  todayIn: { raw: number; display: string };
  todayOut: { raw: number; display: string };
  receivable: { raw: number; display: string };
  payable: { raw: number; display: string };
  entryCount: number;
  rows: {
    key: CashboxKind;
    label: string;
    income: boolean;
    amountRaw: number;
    amountDisplay: string;
  }[];
}

/** Everything the ক্যাশবক্স dashboard needs, derived from one user's entries. */
export async function cashboxDashboard(owner: OwnerId): Promise<CashboxDashboard> {
  const entries = await CashboxEntry.find({ owner }).lean();
  const flow = CashboxEntry.FLOW;
  const today = startOfToday();

  let currentCash = 0;
  let todayIn = 0;
  let todayOut = 0;
  let todaySale = 0;
  const totals: Partial<Record<CashboxKind, number>> = {};

  entries.forEach((e) => {
    const dir = flow[e.kind as CashboxKind] || 0;
    currentCash += dir * e.amount;
    totals[e.kind as CashboxKind] = (totals[e.kind as CashboxKind] || 0) + e.amount;

    if (new Date(e.date) >= today) {
      if (dir > 0) todayIn += e.amount;
      else todayOut += e.amount;
      if (e.kind === 'cash_sale') todaySale += e.amount;
    }
  });

  const s = await summary(owner);

  return {
    todaySale: money(todaySale),
    currentCash: money(currentCash),
    todayIn: money(todayIn),
    todayOut: money(todayOut),
    receivable: money(s.receivable),
    payable: money(s.payable),
    entryCount: entries.length,
    rows: CashboxEntry.ROWS.map((r) => ({
      key: r.key,
      label: r.label,
      income: r.income,
      amountRaw: totals[r.key] || 0,
      amountDisplay: amount(totals[r.key] || 0),
    })),
  };
}

// ---- ledger entries -------------------------------------------------------

export const KIND_TITLE: Record<string, string> = {
  sale: 'বেচা',
  purchase: 'কেনা',
  payment_received: 'পেলাম',
  payment_made: 'দিলাম',
  refund: 'ফেরত',
};

/** Money moving toward the shop reads green, away reads red. */
export const KIND_TONE: Record<string, string> = {
  sale: 'in',
  payment_received: 'in',
  purchase: 'out',
  payment_made: 'out',
  refund: 'out',
};

export interface LedgerEntryView {
  id: string;
  kind: string;
  title: string;
  tone: string;
  description: string;
  amountRaw: number;
  amountDisplay: string;
  dateDisplay: string;
  relative: string;
  hasPhoto: boolean;
  date: Date;
}

export function entryView(t: {
  _id: unknown;
  kind: string;
  description?: string;
  amount: number;
  date: Date;
  hasPhoto?: boolean;
}): LedgerEntryView {
  return {
    id: String(t._id),
    kind: t.kind,
    title: KIND_TITLE[t.kind] || t.kind,
    tone: KIND_TONE[t.kind] || 'out',
    description: t.description || '',
    amountRaw: t.amount,
    amountDisplay: amount(t.amount),
    dateDisplay: dateBn(t.date),
    relative: relativeBn(t.date),
    hasPhoto: !!t.hasPhoto,
    date: t.date,
  };
}

/** `escapeRegex` for the name search on the customer list. */
export const escapeRegex = (s: unknown): string =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
