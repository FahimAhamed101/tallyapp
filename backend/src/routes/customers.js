const router = require('express').Router();
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { asyncHandler, badRequest, notFound, parseAmount } = require('../lib/http');
const { balancesFor, balanceFor, customerView, ledgerHeadline } = require('../lib/ledger');
const { amount, dateBn, relativeBn } = require('../lib/bengali');
const { destroyImage } = require('../lib/cloudinary');

const KIND_TITLE = {
  sale: 'বেচা',
  purchase: 'কেনা',
  payment_received: 'পেলাম',
  payment_made: 'দিলাম',
  refund: 'ফেরত',
};

/** Money moving toward the shop reads green, away reads red. */
const KIND_TONE = {
  sale: 'in',
  payment_received: 'in',
  purchase: 'out',
  payment_made: 'out',
  refund: 'out',
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function entryView(t) {
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

/** Loads a customer belonging to the caller, or throws 404. */
async function ownCustomer(req) {
  const doc = await Customer.findOne({ _id: req.params.id, owner: req.user._id }).catch(() => null);
  if (!doc) throw notFound('কাস্টমার পাওয়া যায়নি');
  return doc;
}

/** Replaces a customer's photo, cleaning up the asset it supersedes. */
async function applyPhoto(doc, body) {
  if (body.photoUrl === undefined && body.photoPublicId === undefined) return;

  const previous = doc.photoPublicId;
  const nextPublicId =
    body.photoPublicId === undefined ? doc.photoPublicId : String(body.photoPublicId || '').trim();
  const nextUrl = body.photoUrl === undefined ? doc.photoUrl : String(body.photoUrl || '').trim();

  // The old asset is orphaned when it is swapped out, or when the photo is cleared.
  const orphaned = previous && (previous !== nextPublicId || !nextUrl);

  doc.photoUrl = nextUrl;
  doc.photoPublicId = nextUrl ? nextPublicId : '';

  if (orphaned) await destroyImage(previous);
}

// GET /api/customers?q=&type=  -> home list
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, type } = req.query;
    const filter = { owner: req.user._id };
    if (type === 'customer' || type === 'supplier') filter.type = type;
    if (q) filter.name = new RegExp(escapeRegex(q), 'i');

    const customers = await Customer.find(filter).sort({ createdAt: 1, _id: 1 });
    const balances = await balancesFor(req.user._id, customers.map((c) => c._id));

    res.json({
      items: customers.map((c) => customerView(c, balances.get(String(c._id)))),
    });
  }),
);

// POST /api/customers  -> নতুন কাস্টমার/সাপ্লায়ার form
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, phone, type, note, photoUrl, photoPublicId } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) throw badRequest('নাম আবশ্যক');

    const cleanPhone = String(phone || '').trim();
    if (cleanPhone && !/^[+0-9০-৯\s-]{6,20}$/.test(cleanPhone)) {
      throw badRequest('মোবাইল নম্বর সঠিক নয়');
    }

    const [bg, fg] = Customer.pickAvatar(cleanName);
    const doc = await Customer.create({
      owner: req.user._id,
      name: cleanName,
      phone: cleanPhone,
      type: type === 'supplier' ? 'supplier' : 'customer',
      note: String(note || '').trim(),
      initials: Customer.makeInitials(cleanName),
      avatarColor: bg,
      avatarTextColor: fg,
      photoUrl: String(photoUrl || '').trim(),
      photoPublicId: String(photoPublicId || '').trim(),
      lastActivityAt: new Date(),
    });

    res.status(201).json({ customer: customerView(doc, null) });
  }),
);

// GET /api/customers/:id  -> ledger screen
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await ownCustomer(req);

    const balance = await balanceFor(req.user._id, doc._id);
    const view = customerView(doc, balance);
    const entries = await Transaction.find({ customer: doc._id, owner: req.user._id }).sort({ date: -1 });

    res.json({
      customer: view,
      headline: ledgerHeadline(view),
      entries: entries.map(entryView),
    });
  }),
);

// PATCH /api/customers/:id  -> edit screen (name / phone / type / photo)
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await ownCustomer(req);

    const { name, phone, type, note } = req.body || {};
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) throw badRequest('নাম আবশ্যক');
      doc.name = cleanName;
      doc.initials = Customer.makeInitials(cleanName);
    }
    if (phone !== undefined) {
      const cleanPhone = String(phone).trim();
      if (cleanPhone && !/^[+0-9০-৯\s-]{6,20}$/.test(cleanPhone)) {
        throw badRequest('মোবাইল নম্বর সঠিক নয়');
      }
      doc.phone = cleanPhone;
    }
    if (type !== undefined) doc.type = type === 'supplier' ? 'supplier' : 'customer';
    if (note !== undefined) doc.note = String(note || '').trim();

    await applyPhoto(doc, req.body || {});
    await doc.save();

    const balance = await balanceFor(req.user._id, doc._id);
    res.json({ customer: customerView(doc, balance) });
  }),
);

// DELETE /api/customers/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await ownCustomer(req);

    await Transaction.deleteMany({ customer: doc._id, owner: req.user._id });
    if (doc.photoPublicId) await destroyImage(doc.photoPublicId);
    await doc.deleteOne();

    res.json({ ok: true, deletedId: req.params.id });
  }),
);

// GET /api/customers/:id/transactions
router.get(
  '/:id/transactions',
  asyncHandler(async (req, res) => {
    const doc = await ownCustomer(req);
    const entries = await Transaction.find({ customer: doc._id, owner: req.user._id }).sort({ date: -1 });
    res.json({ items: entries.map(entryView) });
  }),
);

/**
 * POST /api/customers/:id/transactions  -> the দিলাম/বেচা + পেলাম form
 * body: { box: 'gave'|'got', amount, description, date, hasPhoto }
 *   or: { kind: 'sale'|'purchase'|'payment_received'|'payment_made'|'refund', ... }
 */
router.post(
  '/:id/transactions',
  asyncHandler(async (req, res) => {
    const doc = await ownCustomer(req);

    const { box, kind, description, date, hasPhoto } = req.body || {};
    let resolvedKind = kind;
    if (!resolvedKind && box) resolvedKind = Transaction.kindFor(box, doc.type);
    if (!resolvedKind || !Transaction.SIGN[resolvedKind]) {
      throw badRequest('লেনদেনের ধরন সঠিক নয়');
    }

    const amt = parseAmount(req.body && req.body.amount);
    if (!Number.isFinite(amt) || amt <= 0) throw badRequest('সঠিক পরিমাণ দিন');

    const created = await Transaction.create({
      owner: req.user._id,
      customer: doc._id,
      kind: resolvedKind,
      amount: amt,
      description: String(description || '').trim(),
      hasPhoto: !!hasPhoto,
      date: date ? new Date(date) : new Date(),
    });

    doc.lastActivityAt = new Date();
    await doc.save();

    const balance = await balanceFor(req.user._id, doc._id);
    const view = customerView(doc, balance);

    res.status(201).json({
      ok: true,
      entry: entryView(created),
      customer: view,
      headline: ledgerHeadline(view),
    });
  }),
);

module.exports = router;
