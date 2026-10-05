const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const { balancesFor } = require('./ledger');

/**
 * The two headline totals on the home tab plus the list-header counters, for
 * one user's own book. Only net-positive customers count toward পাবো, only
 * net-negative toward দেবো.
 */
async function summary(owner) {
  const customers = await Customer.find({ owner }, '_id type');
  const balances = await balancesFor(owner, customers.map((c) => c._id));

  let receivable = 0;
  let payable = 0;
  let customerCount = 0;
  let supplierCount = 0;

  customers.forEach((c) => {
    const b = balances.get(String(c._id)) || { receivable: 0, payable: 0 };
    const n = b.receivable - b.payable;
    if (n > 0.004) receivable += n;
    else if (n < -0.004) payable += -n;
    if (c.type === 'supplier') supplierCount += 1;
    else customerCount += 1;
  });

  return {
    receivable,
    payable,
    customerCount,
    supplierCount,
    transactionCount: await Transaction.countDocuments({ owner }),
  };
}

module.exports = { summary };
