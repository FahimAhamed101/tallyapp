import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

/**
 * A movement in the cash box. Powers the ক্যাশবক্স dashboard and the
 * ক্যাশ বেচা form.
 */
const CashboxEntrySchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    kind: {
      type: String,
      required: true,
      enum: ['cash_sale', 'cash_purchase', 'expense', 'owner_in', 'owner_out'],
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true },
    hasPhoto: { type: Boolean, default: false },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export type CashboxEntryDoc = InferSchemaType<typeof CashboxEntrySchema>;

export type CashboxKind =
  | 'cash_sale'
  | 'cash_purchase'
  | 'expense'
  | 'owner_in'
  | 'owner_out';

/** +1 money in, -1 money out. Drives বর্তমান কাশ. */
const FLOW: Record<CashboxKind, number> = {
  cash_sale: 1,
  owner_in: 1,
  cash_purchase: -1,
  expense: -1,
  owner_out: -1,
};

/** The five rows the ক্যাশবক্স screen renders, in the reference app's order. */
const ROWS: { key: CashboxKind; label: string; income: boolean }[] = [
  { key: 'cash_sale', label: 'কাশ বেচা', income: true },
  { key: 'cash_purchase', label: 'কাশ কেনা', income: false },
  { key: 'expense', label: 'খরচ', income: false },
  { key: 'owner_in', label: 'মালিক দিল', income: true },
  { key: 'owner_out', label: 'মালিক নিল', income: false },
];

export interface CashboxStatics {
  FLOW: typeof FLOW;
  ROWS: typeof ROWS;
}

const statics = CashboxEntrySchema.statics as unknown as CashboxStatics;
statics.FLOW = FLOW;
statics.ROWS = ROWS;

export type CashboxModel = Model<CashboxEntryDoc> & CashboxStatics;

export const CashboxEntry = (mongoose.models.CashboxEntry as CashboxModel) ||
  (model('CashboxEntry', CashboxEntrySchema) as unknown as CashboxModel);

export default CashboxEntry;
