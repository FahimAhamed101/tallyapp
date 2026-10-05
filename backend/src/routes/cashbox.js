const router = require('express').Router();
const CashboxEntry = require('../models/CashboxEntry');
const { asyncHandler, badRequest, notFound, parseAmount } = require('../lib/http');
const { amount, dateBn } = require('../lib/bengali');
const { summary } = require('../lib/summary');

const KIND_TITLE = {
  cash_sale: 'কাশ বেচা',
  cash_purchase: 'কাশ কেনা',
  expense: 'খরচ',
  owner_in: 'মালিক দিল',
  owner_out: 'মালিক নিল',
};

const money = (n) => ({ raw: Number(n || 0), display: amount(n) });

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Everything the ক্যাশবক্স dashboard needs, derived from one user's entries. */
async function dashboard(owner) {
  const entries = await CashboxEntry.find({ owner }).lean();
  const flow = CashboxEntry.FLOW;
  const today = startOfToday();

  let currentCash = 0;
  let todayIn = 0;
  let todayOut = 0;
  let todaySale = 0;
  const totals = {};

  entries.forEach((e) => {
    const dir = flow[e.kind] || 0;
    currentCash += dir * e.amount;
    totals[e.kind] = (totals[e.kind] || 0) + e.amount;

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

function entryView(e) {
  return {
    id: String(e._id),
    kind: e.kind,
    title: KIND_TITLE[e.kind] || e.kind,
    amountRaw: e.amount,
    amountDisplay: amount(e.amount),
    description: e.description || '',
    category: e.category || '',
    dateDisplay: dateBn(e.date),
    date: e.date,
  };
}

// GET /api/cashbox  -> ক্যাশবক্স dashboard
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await dashboard(req.user._id));
  }),
);

// GET /api/cashbox/entries?kind=&limit=
router.get(
  '/entries',
  asyncHandler(async (req, res) => {
    const { kind } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const filter = { owner: req.user._id };
    if (kind) filter.kind = kind;
    const entries = await CashboxEntry.find(filter).sort({ date: -1 }).limit(limit);
    res.json({ items: entries.map(entryView) });
  }),
);

/**
 * POST /api/cashbox/entries -> ক্যাশ বেচা / খরচ / মালিক দিল / মালিক নিল forms
 * body: { kind, amount, description, category, date, hasPhoto }
 */
router.post(
  '/entries',
  asyncHandler(async (req, res) => {
    const { kind, description, category, date, hasPhoto } = req.body || {};
    if (!kind || !CashboxEntry.FLOW[kind]) throw badRequest('খরচের ধরন সঠিক নয়');

    const amt = parseAmount(req.body && req.body.amount);
    if (!Number.isFinite(amt) || amt <= 0) throw badRequest('সঠিক পরিমাণ দিন');

    const created = await CashboxEntry.create({
      owner: req.user._id,
      kind,
      amount: amt,
      description: String(description || '').trim(),
      category: String(category || '').trim(),
      hasPhoto: !!hasPhoto,
      date: date ? new Date(date) : new Date(),
    });

    res.status(201).json({
      ok: true,
      entry: entryView(created),
      dashboard: await dashboard(req.user._id),
    });
  }),
);

// DELETE /api/cashbox/entries/:id
router.delete(
  '/entries/:id',
  asyncHandler(async (req, res) => {
    const doc = await CashboxEntry.findOne({ _id: req.params.id, owner: req.user._id }).catch(() => null);
    if (!doc) throw notFound('এন্ট্রি পাওয়া যায়নি');
    await doc.deleteOne();
    res.json({ ok: true, deletedId: req.params.id, dashboard: await dashboard(req.user._id) });
  }),
);

module.exports = router;
module.exports.dashboard = dashboard;
