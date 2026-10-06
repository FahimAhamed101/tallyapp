import mongoose, { Schema, model, Types, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

/**
 * A business (ব্যবসা) belonging to one user.
 *
 * A shopkeeper can keep up to five separate books — each with its own
 * customers, ledger and cashbox — and switch between them from the
 * মাল্টি ব্যবসা sheet on the home tab.
 *
 * `owner` is stored here *as well as* on every document the business scopes.
 * That redundancy is deliberate: the admin panel works per-user, so it can
 * count a shopkeeper's whole footprint (across all their books) without first
 * walking the business list.
 */
const BusinessSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    /**
     * The book the account started with. Exactly one per user. It cannot be
     * deleted, and it is what `resolveBusiness` falls back to when the client
     * sends no `X-Business-Id` — which is what keeps the pre-multi-business
     * APK working untouched.
     */
    isPrimary: { type: Boolean, default: false },
    category: { type: String, default: 'মুদি বা জেনারেল স্টোর' },
    isPersonal: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// List order for the switcher sheet: oldest first, so the primary stays on top.
BusinessSchema.index({ owner: 1, createdAt: 1 });

/**
 * Hydrated, so `_id` and `save()` are on the type. The raw `InferSchemaType`
 * omits both, and callers here do need them: `resolveBusiness` hands back a
 * document, and `ensurePrimaryBusiness` promotes one in place.
 */
export type BusinessDoc = HydratedDocument<InferSchemaType<typeof BusinessSchema>>;

/** The reference app caps a shopkeeper at five businesses. */
const MAX_BUSINESSES = 5;

export interface BusinessStatics {
  MAX: typeof MAX_BUSINESSES;
}

const statics = BusinessSchema.statics as unknown as BusinessStatics;
statics.MAX = MAX_BUSINESSES;

export type BusinessModel = Model<InferSchemaType<typeof BusinessSchema>> & BusinessStatics;

export const Business = (mongoose.models.Business as BusinessModel) ||
  (model('Business', BusinessSchema) as unknown as BusinessModel);

export default Business;
