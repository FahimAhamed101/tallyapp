import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

/**
 * One shop profile per user — shown in the gold toolbar and the menu drawer
 * header. Created at registration, so a new account always has one.
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
  },
  { timestamps: true },
);

export type ProfileDoc = InferSchemaType<typeof ProfileSchema>;

export const Profile = (mongoose.models.Profile as Model<ProfileDoc>) ||
  model('Profile', ProfileSchema);

export default Profile;
