import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

/**
 * One line in a customer's ledger (the দিলাম/বেচা + পেলাম form writes here).
 *
 * Sign convention, from the shop's point of view:
 *   sale             বেচা      -> customer owes us more    (পাবো ↑)
 *   payment_received পেলাম     -> customer owes us less    (পাবো ↓)
 *   purchase         কেনা      -> we owe the supplier      (দেবো ↑)
 *   payment_made     দিলাম     -> we owe the supplier less (দেবো ↓)
 *   refund           ফেরত      -> reduces what they owe    (পাবো ↓)
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

export type TransactionDoc = InferSchemaType<typeof TransactionSchema>;

export type TransactionKind =
  | 'sale'
  | 'purchase'
  | 'payment_received'
  | 'payment_made'
  | 'refund';

export type LedgerBox = 'gave' | 'got';

/** +1 increases a balance, -1 decreases it. */
const SIGN: Record<TransactionKind, { receivable: number; payable: number }> = {
  sale: { receivable: 1, payable: 0 },
  refund: { receivable: -1, payable: 0 },
  payment_received: { receivable: -1, payable: 0 },
  purchase: { receivable: 0, payable: 1 },
  payment_made: { receivable: 0, payable: -1 },
};

/** Maps the form's two boxes onto ledger kinds. */
function kindFor(box: LedgerBox | string, customerType?: string): TransactionKind {
  const isSupplier = customerType === 'supplier';
  if (box === 'gave') return isSupplier ? 'payment_made' : 'sale';
  return isSupplier ? 'purchase' : 'payment_received';
}

export interface TransactionStatics {
  SIGN: typeof SIGN;
  kindFor: typeof kindFor;
}

const statics = TransactionSchema.statics as unknown as TransactionStatics;
statics.SIGN = SIGN;
statics.kindFor = kindFor;

export type TransactionModel = Model<TransactionDoc> & TransactionStatics;

export const Transaction = (mongoose.models.Transaction as TransactionModel) ||
  (model('Transaction', TransactionSchema) as unknown as TransactionModel);

export default Transaction;
