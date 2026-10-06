import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

/**
 * A single stock movement (স্টক ইন / স্টক আউট) against one [StockItem].
 *
 * Movements are append-only: the live quantity is `openingStock + Σ(in) − Σ(out)`,
 * so a correction is a new movement, not an edit. That keeps the item's history
 * auditable, which is the whole point of keeping a stock book — and it means the
 * quantity can always be recomputed from scratch if a number is ever disputed.
 */
const StockMovementSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    business: { type: Types.ObjectId, ref: 'Business', required: true, index: true },
    item: { type: Types.ObjectId, ref: 'StockItem', required: true, index: true },
    /** `in` = মাল এসেছে, `out` = মাল গেছে. */
    direction: { type: String, enum: ['in', 'out'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    /** Per-unit cost at the time of the movement, for weighted-cost reporting. */
    unitCost: { type: Number, default: 0, min: 0 },
    note: { type: String, default: '', trim: true },
    /** When the movement happened — user-settable, so it is not `createdAt`. */
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// The item detail screen reads newest-first.
StockMovementSchema.index({ owner: 1, business: 1, item: 1, date: -1 });

export type StockMovementDoc = InferSchemaType<typeof StockMovementSchema>;

export type StockMovementModel = Model<StockMovementDoc>;

export const StockMovement = (mongoose.models.StockMovement as StockMovementModel) ||
  (model('StockMovement', StockMovementSchema) as unknown as StockMovementModel);

export default StockMovement;
