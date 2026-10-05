import mongoose, { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

/**
 * One wallet per user for the ওয়ালেট tab: a Talipay balance plus the service
 * grid and the marketing bullets, so the whole screen is server-driven.
 */
const WalletSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    balance: { type: Number, default: 0 },
    accountOpened: { type: Boolean, default: false },
    services: [
      {
        _id: false,
        key: String,
        label: String,
        enabled: { type: Boolean, default: false },
      },
    ],
    benefits: [{ type: String }],
  },
  { timestamps: true },
);

export type WalletDoc = InferSchemaType<typeof WalletSchema>;
export type WalletService = { key: string; label: string; enabled: boolean };

const DEFAULT_SERVICES: WalletService[] = [
  { key: 'add_money', label: 'অ্যাড মানি', enabled: true },
  { key: 'send_money', label: 'সেন্ড মানি', enabled: false },
  { key: 'bank_transfer', label: 'ব্যাংক ট্রান্সফার', enabled: false },
  { key: 'wallet_transfer', label: 'ওয়ালেট ট্রান্সফার', enabled: false },
  { key: 'mobile_recharge', label: 'মোবাইল রিচার্জ', enabled: false },
  { key: 'tally_transfer', label: 'টালি ট্রান্সফার', enabled: false },
  { key: 'qr_code', label: 'QR কোড', enabled: false },
  { key: 'bill_payment', label: 'বিল পেমেন্ট', enabled: false },
];

const DEFAULT_BENEFITS: string[] = [
  'বিকাশ, রকেট বা ব্যাংক অ্যাপ থেকে আপনার টালিপে লিংকড ব্যাংক একাউন্টের মাধ্যমে অ্যাড মানি করুন',
  'যেকোনো বাংলা QR-এ পেমেন্ট করুন',
];

export interface WalletStatics {
  DEFAULT_SERVICES: WalletService[];
  DEFAULT_BENEFITS: string[];
}

const statics = WalletSchema.statics as unknown as WalletStatics;
statics.DEFAULT_SERVICES = DEFAULT_SERVICES;
statics.DEFAULT_BENEFITS = DEFAULT_BENEFITS;

export type WalletModel = Model<WalletDoc> & WalletStatics;

export const Wallet = (mongoose.models.Wallet as WalletModel) ||
  (model('Wallet', WalletSchema) as unknown as WalletModel);

export default Wallet;
