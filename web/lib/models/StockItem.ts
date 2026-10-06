import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

/**
 * One product (পণ্য) in a shopkeeper's stock book (স্টক হিসাব).
 *
 * Stock *levels* are not stored here. `openingStock` is the one number the user
 * types, and the live quantity is derived from it plus the item's movements —
 * the same rule the ledger follows for balances, and for the same reason: a
 * stored running total is a second source of truth that can drift, and the
 * drift is invisible until the numbers are already wrong.
 */
const StockItemSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    /**
     * Which book this item belongs to. Required, unlike `Customer.business`:
     * that field is nullable only so documents created before multi-business
     * support can be adopted on first read, and there is no such legacy data for
     * a collection that did not exist then.
     */
    business: { type: Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    /** পিস / কেজি / লিটার / বস্তা — free text, because the reference app does not
     *  constrain it and shopkeepers use a long tail of units. */
    unit: { type: String, default: 'পিস', trim: true },
    /** What the shopkeeper pays per unit. */
    purchasePrice: { type: Number, default: 0, min: 0 },
    /** What the shopkeeper sells per unit. */
    salePrice: { type: Number, default: 0, min: 0 },
    /** Counted stock on the day the item was added; movements adjust from here. */
    openingStock: { type: Number, default: 0 },
    /** Flag the row once the live quantity falls to this. 0 disables the flag. */
    lowStockThreshold: { type: Number, default: 0, min: 0 },
    note: { type: String, default: '', trim: true },
    photoUrl: { type: String, default: '' },
    photoPublicId: { type: String, default: '' },
  },
  { timestamps: true },
);

// The stock list is "everything in this book, by name".
StockItemSchema.index({ owner: 1, business: 1, name: 1 });
// The admin panel lists one account's whole footprint across books.
StockItemSchema.index({ owner: 1, createdAt: -1 });

export type StockItemDoc = InferSchemaType<typeof StockItemSchema>;

export type StockItemModel = Model<StockItemDoc>;

export const StockItem = (mongoose.models.StockItem as StockItemModel) ||
  (model('StockItem', StockItemSchema) as unknown as StockItemModel);

export default StockItem;
