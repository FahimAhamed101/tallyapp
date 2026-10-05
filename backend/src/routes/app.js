const router = require('express').Router();
const Profile = require('../models/Profile');
const Wallet = require('../models/Wallet');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const CashboxEntry = require('../models/CashboxEntry');
const { asyncHandler, notFound } = require('../lib/http');
const { amount, toBn, dateBn, MONTHS } = require('../lib/bengali');
const { summary } = require('../lib/summary');
const { balancesFor } = require('../lib/ledger');

const money = (n) => ({ raw: Number(n || 0), display: amount(n) });

const SERVICE_ICON = {
  add_money: 'add_money',
  send_money: 'send_money',
  bank_transfer: 'bank_transfer',
  wallet_transfer: 'wallet_transfer',
  mobile_recharge: 'mobile_recharge',
  tally_transfer: 'tally_transfer',
  qr_code: 'qr_code',
  bill_payment: 'bill_payment',
};

/** Initials for the avatar badge, matching the customer rule. */
function initialsFor(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  return /^[\x00-\x7F]+$/.test(raw) ? raw.toUpperCase() : raw;
}

/**
 * A profile is created at registration, but a self-healing getter means a
 * partially provisioned account can never render a broken toolbar.
 */
async function getProfile(user) {
  let doc = await Profile.findOne({ owner: user._id });
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

async function getWallet(owner) {
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
      key: s.key,
      label: s.label,
      icon: SERVICE_ICON[s.key] || s.key,
      enabled: !!s.enabled,
    })),
    benefits: doc.benefits,
  };
}

async function getMenu(user) {
  const owner = user._id;
  const [profile, txCount, expenseCount, cashCount, customers] = await Promise.all([
    getProfile(user),
    Transaction.countDocuments({ owner }),
    CashboxEntry.countDocuments({ owner, kind: 'expense' }),
    CashboxEntry.countDocuments({ owner }),
    Customer.find({ owner }, '_id'),
  ]);

  const balances = await balancesFor(owner, customers.map((c) => c._id));
  let dueCount = 0;
  balances.forEach((b) => {
    if (Math.abs(b.receivable - b.payable) > 0.004) dueCount += 1;
  });

  const days = await CashboxEntry.distinct('date', { owner });
  const dayCount = new Set(days.map((d) => new Date(d).toDateString())).size;

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

async function getSummary(owner) {
  const s = await summary(owner);
  return {
    receivable: money(s.receivable),
    payable: money(s.payable),
    customerCount: s.customerCount,
    supplierCount: s.supplierCount,
    customerLabel: `কাস্টমার ${toBn(s.customerCount)} / সাপ্লায়ার ${toBn(s.supplierCount)}`,
    transactionCount: s.transactionCount,
  };
}

// ---- routes ---------------------------------------------------------------

router.get('/profile', asyncHandler(async (req, res) => res.json(await getProfile(req.user))));

router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    let doc = await Profile.findOne({ owner: req.user._id });
    if (!doc) {
      await getProfile(req.user); // self-heal
      doc = await Profile.findOne({ owner: req.user._id });
    }
    if (!doc) throw notFound('প্রোফাইল পাওয়া যায়নি');

    ['name', 'phone', 'initials', 'photoUrl', 'goldPlanName', 'goldTrialDays', 'inboxUnread', 'smsRemaining', 'appVersion'].forEach(
      (k) => {
        if (req.body && req.body[k] !== undefined) doc[k] = req.body[k];
      },
    );
    await doc.save();

    // Keep the account record in step with the shop profile.
    if (req.body && (req.body.name !== undefined || req.body.phone !== undefined || req.body.photoUrl !== undefined)) {
      if (req.body.name !== undefined) req.user.name = String(req.body.name).trim() || req.user.name;
      if (req.body.phone !== undefined) req.user.phone = String(req.body.phone).trim() || req.user.phone;
      if (req.body.photoUrl !== undefined) req.user.photoUrl = String(req.body.photoUrl || '').trim();
      await req.user.save();
    }

    res.json(await getProfile(req.user));
  }),
);

router.get('/summary', asyncHandler(async (req, res) => res.json(await getSummary(req.user._id))));

router.get('/wallet', asyncHandler(async (req, res) => res.json(await getWallet(req.user._id))));

/** টালিপে একাউন্ট খুলুন button. */
router.post(
  '/wallet/open-account',
  asyncHandler(async (req, res) => {
    let doc = await Wallet.findOne({ owner: req.user._id });
    if (!doc) {
      await getWallet(req.user._id); // self-heal
      doc = await Wallet.findOne({ owner: req.user._id });
    }
    if (!doc) throw notFound('ওয়ালেট পাওয়া যায়নি');
    doc.accountOpened = true;
    doc.services = doc.services.map((s) => ({ ...s.toObject(), enabled: true }));
    await doc.save();
    res.json({ ok: true, wallet: await getWallet(req.user._id) });
  }),
);

router.get('/menu', asyncHandler(async (req, res) => res.json(await getMenu(req.user))));

/** One call that fills the home tab on cold start. */
router.get(
  '/bootstrap',
  asyncHandler(async (req, res) => {
    const [profile, summaryOut, wallet, menu] = await Promise.all([
      getProfile(req.user),
      getSummary(req.user._id),
      getWallet(req.user._id),
      getMenu(req.user),
    ]);
    res.json({
      user: {
        id: String(req.user._id),
        name: req.user.name,
        phone: req.user.phone,
        photoUrl: req.user.photoUrl || '',
      },
      profile,
      summary: summaryOut,
      wallet,
      menu,
    });
  }),
);

/** The রিপোর্ট pill. */
router.get(
  '/reports/summary',
  asyncHandler(async (req, res) => {
    const owner = req.user._id;
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const from = new Date(Date.now() - days * 86400000);

    const [txAgg, cashAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { owner, date: { $gte: from } } },
        { $group: { _id: '$kind', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      CashboxEntry.aggregate([
        { $match: { owner, date: { $gte: from } } },
        { $group: { _id: '$kind', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const tx = Object.fromEntries(txAgg.map((r) => [r._id, r.total]));
    const cash = Object.fromEntries(cashAgg.map((r) => [r._id, r.total]));

    res.json({
      days,
      range: { from, to: new Date(), label: `${toBn(days)} দিন` },
      sales: money(tx.sale || 0),
      purchases: money(tx.purchase || 0),
      paymentsReceived: money(tx.payment_received || 0),
      paymentsMade: money(tx.payment_made || 0),
      cashSales: money(cash.cash_sale || 0),
      cashPurchases: money(cash.cash_purchase || 0),
      expenses: money(cash.expense || 0),
      ownerIn: money(cash.owner_in || 0),
      ownerOut: money(cash.owner_out || 0),
      generatedAt: new Date(),
      generatedLabel: dateBn(new Date()),
      monthLabel: MONTHS[new Date().getMonth()],
    });
  }),
);

module.exports = router;
module.exports.getProfile = getProfile;
module.exports.getWallet = getWallet;
module.exports.getMenu = getMenu;
module.exports.getSummary = getSummary;
