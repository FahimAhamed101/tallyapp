import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

/**
 * One shop profile per user — shown in the gold toolbar and the menu drawer
 * header. Created at registration, so a new account always has one.
 *
 * It also carries the account's app preferences (সেটিংস) and its optional
 * অ্যাপ সিকিউরিটি PIN. Both live here rather than on `User` because they are
 * *presentation* state, like `goldPlanName` and `appVersion` above, and because
 * every account already has exactly one Profile — so a preference has a home
 * from the moment the account exists, with no migration and no null check.
 *
 * `settings` is a nested path, not a sub-schema: mongoose applies the defaults
 * on hydration, so an account seeded before this field existed still reads back
 * `{ decimalAmount: true, notificationSound: true }` rather than `undefined`.
 *
 * The PIN is stored exactly like a password — a per-user random salt plus a
 * scrypt hash — and both fields are deliberately *outside* `settings` so no
 * future "return the settings object" shortcut can leak them by accident.
 * `pinSetAt` records when it was last changed; the PIN itself never leaves the
 * database and there is no route that reads it back.
 */
const ProfileSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    initials: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    goldPlanName: { type: String, default: 'টালিখাতা গোল্ড (ট্রায়াল)' },
    goldTrialDays: { type: Number, default: 30 },
    inboxUnread: { type: Number, default: 1 },
    smsRemaining: { type: Number, default: 10 },
    appVersion: { type: String, default: '৭.১৭.০' },

    /** সাধারণ সেটিংস — the two toggles on the সেটিংস screen. */
    settings: {
      /** টাকার অঙ্কে দশমিক: show paisa, e.g. ১২,০০০.০০ rather than ১২,০০০. */
      decimalAmount: { type: Boolean, default: true },
      /** নোটিফিকেশন সাউন্ড: play an alert for a টালিখাতা notification. */
      notificationSound: { type: Boolean, default: true },
    },

    /** অ্যাপ সিকিউরিটি. Never serialised — only `pinSet` is reported. */
    pinSalt: { type: String, default: '' },
    pinHash: { type: String, default: '' },
    pinSetAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type ProfileDoc = InferSchemaType<typeof ProfileSchema>;

export const Profile = (mongoose.models.Profile as Model<ProfileDoc>) ||
  model('Profile', ProfileSchema);

export default Profile;
