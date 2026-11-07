import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

/**
 * A manual deposit into the সুদমুক্ত সঞ্চয় wallet.
 *
 * There is no payment gateway here on purpose. The user sends money to
 * [DEPOSIT_PAYMENT.number], submits the amount, the number they sent from and
 * the transaction id, and an admin matches that against the SMS/statement and
 * approves it — which is the only thing that ever moves `Wallet.balance`.
 *
 * The request row is therefore an audit trail, not a ledger entry: approving it
 * flips one row from pending to approved and credits the wallet exactly once.
 * Re-approving is refused rather than silently adding the amount again.
 */
const DepositSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 1, max: 500000 },
    /** The number the money was sent *from*, not the receiving one. */
    senderNumber: { type: String, required: true, trim: true },
    /** bKash/Nagad transaction id, upper-cased on write for matching. */
    trxId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    /** Admin's note — the rejection reason, or a reference for a manual match. */
    note: { type: String, default: '', trim: true },
    reviewedBy: { type: Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    /** When the balance was actually credited (approved rows only). */
    creditedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

DepositSchema.index({ owner: 1, createdAt: -1 });
DepositSchema.index({ status: 1, createdAt: -1 });

/**
 * `timestamps: true` adds createdAt/updatedAt at runtime, but `InferSchemaType`
 * only reflects fields declared in the schema object — so they are intersected
 * back in here. Without this `depositView` cannot read `doc.createdAt`.
 */
export type DepositDoc = InferSchemaType<typeof DepositSchema> & {
  createdAt: Date;
  updatedAt: Date;
};

export type DepositStatus = 'pending' | 'approved' | 'rejected';

/**
 * Where the money goes, and how long the user should expect to wait.
 *
 * Lives here rather than in the app so changing the receiving number is a
 * server change, not a Play release. The app renders whatever `/api/wallet`
 * returns and never hardcodes the digits.
 */
export const DEPOSIT_PAYMENT = {
  number: '01706617723',
  waitHours: 24,
  title: 'সুদমুক্ত সঞ্চয়',
} as const;

export const DEPOSIT_STATUS_LABEL: Record<DepositStatus, string> = {
  pending: 'যাচাই চলছে',
  approved: 'যোগ হয়েছে',
  rejected: 'বাতিল',
};

/** Normalises a BD mobile number to 11 digits, or returns '' if it is not one. */
export function normalisePhone(input: unknown): string {
  const digits = String(input ?? '').replace(/[^0-9]/g, '');
  if (digits.length === 13 && digits.startsWith('880')) return `0${digits.slice(3)}`;
  if (digits.length === 11 && digits.startsWith('0')) return digits;
  if (digits.length === 10 && digits.startsWith('1')) return `0${digits}`;
  return '';
}

export type DepositModel = Model<DepositDoc>;

export const Deposit = (mongoose.models.Deposit as DepositModel) ||
  (model('Deposit', DepositSchema) as unknown as DepositModel);

export default Deposit;