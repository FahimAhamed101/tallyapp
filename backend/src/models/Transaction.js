const { Schema, model, Types } = require('mongoose');

/**
 * One line in a customer's ledger (the দিলাম/বেচা + পেলাম form writes here).
 *
 * Sign convention, from the shop's point of view:
 *   sale             বেচা      -> customer owes us more   (পাবো ↑)
 *   payment_received পেলাম     -> customer owes us less   (পাবো ↓)
 *   purchase         কেনা      -> we owe the supplier     (দেবো ↑)
 *   payment_made     দিলাম     -> we owe the supplier less(দেবো ↓)
 *   refund           ফেরত      -> reduces what they owe   (পাবো ↓)
 */
const TransactionSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    customer: { type: Types.ObjectId, ref: 'Customer', required: true, index: true },
    kind: {
      type: String,
      required: true,
      enum: ['sale', 'purchase', 'payment_received', 'payment_made', 'refund'],
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', trim: true },
    hasPhoto: { type: Boolean, default: false },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

/** +1 increases a balance, -1 decreases it. */
TransactionSchema.statics.SIGN = {
  sale: { receivable: 1, payable: 0 },
  refund: { receivable: -1, payable: 0 },
  payment_received: { receivable: -1, payable: 0 },
  purchase: { receivable: 0, payable: 1 },
  payment_made: { receivable: 0, payable: -1 },
};

/** Maps the form's two boxes onto ledger kinds. */
TransactionSchema.statics.kindFor = function kindFor(box, customerType) {
  const isSupplier = customerType === 'supplier';
  if (box === 'gave') return isSupplier ? 'payment_made' : 'sale';
  return isSupplier ? 'purchase' : 'payment_received';
};

module.exports = model('Transaction', TransactionSchema);
