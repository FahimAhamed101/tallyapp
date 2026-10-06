import Customer from './models/Customer';
import Transaction from './models/Transaction';
import { balancesFor } from './ledger';
import { type Scope, scopeFilter } from './scope';

/**
 * The two headline totals on the home tab plus the list-header counters, for
 * one business's book. Only net-positive customers count toward পাবো, only
 * net-negative toward দেবো.
 *
 * Takes a `Scope` rather than a bare owner so the numbers follow the book the
 * client is looking at; passing `business: null` widens it to the whole account,
 * which is what the admin panel does.
 */
export interface Summary {
  receivable: number;
  payable: number;
  customerCount: number;
  supplierCount: number;
  transactionCount: number;
}

export async function summary(scope: Scope): Promise<Summary> {
  const filter = scopeFilter(scope);
  const customers = await Customer.find(filter, '_id type');
  const balances = await balancesFor(scope.owner, customers.map((c) => c._id));

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
    transactionCount: await Transaction.countDocuments(filter),
  };
}
