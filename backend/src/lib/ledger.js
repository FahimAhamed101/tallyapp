const Transaction = require('../models/Transaction');
const { amount, relativeBn } = require('./bengali');

/**
 * Balances are always derived from the ledger, never stored, so a form write
 * can never leave a stale total behind.
 *
 *   receivable (পাবো) = sale - refund - payment_received
 *   payable    (দেবো) = purchase - payment_made
 */
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
};

function shape(row) {
  if (!row) return { receivable: 0, payable: 0, lastDate: null, count: 0 };
  return {
    receivable: (row.sale || 0) - (row.refund || 0) - (row.received || 0),
    payable: (row.purchase || 0) - (row.made || 0),
    lastDate: row.lastDate || null,
    count: row.count || 0,
  };
}

/** Map of customerId(string) -> balance, scoped to one user's ledger. */
async function balancesFor(owner, ids) {
  const match = { owner };
  if (ids && ids.length) match.customer = { $in: ids };
  const rows = await Transaction.aggregate([{ $match: match }, GROUP_STAGE]);
  const map = new Map();
  rows.forEach((r) => map.set(String(r._id), shape(r)));
  return map;
}

async function balanceFor(owner, id) {
  const rows = await Transaction.aggregate([
    { $match: { owner, customer: id } },
    GROUP_STAGE,
  ]);
  return shape(rows[0]);
}

/** Net position of a customer: positive = they owe us, negative = we owe them. */
function net(balance) {
  return (balance.receivable || 0) - (balance.payable || 0);
}

/**
 * The JSON shape every customer row/header in the app consumes. The Android
 * side only picks a colour from `amountTone`; all text is pre-formatted.
 */
function customerView(customer, balance) {
  const b = balance || { receivable: 0, payable: 0, lastDate: null, count: 0 };
  const n = net(b);

  let amountRaw = Math.abs(n);
  let amountTone = 'zero'; // 'pabo' | 'debo' | 'zero'
  if (n > 0.004) amountTone = 'pabo';
  else if (n < -0.004) amountTone = 'debo';

  const lastActivity = b.lastDate || customer.lastActivityAt || customer.createdAt;

  return {
    id: String(customer._id),
    name: customer.name,
    phone: customer.phone || '',
    type: customer.type,
    /** Free-text বিবরণ typed on the add/edit form. */
    note: customer.note || '',
    initials: customer.initials || '?',
    avatarColor: customer.avatarColor || '#D1FAD1',
    avatarTextColor: customer.avatarTextColor || '#1A1A1A',
    /** Cloudinary URL when the user attached a photo, otherwise ''. */
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

/** Label shown on the ledger form: পাবো / দেবো / পরিশোধিত. */
function ledgerHeadline(customerView) {
  if (customerView.amountTone === 'pabo') {
    return { label: 'পাবো', tone: 'pabo', amountDisplay: customerView.amountDisplay };
  }
  if (customerView.amountTone === 'debo') {
    return { label: 'দেবো', tone: 'debo', amountDisplay: customerView.amountDisplay };
  }
  return { label: 'পাবো', tone: 'zero', amountDisplay: amount(0) };
}

module.exports = { balancesFor, balanceFor, customerView, ledgerHeadline, net, shape };
