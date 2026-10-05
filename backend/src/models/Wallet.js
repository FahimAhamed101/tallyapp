const { Schema, model, Types } = require('mongoose');

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

WalletSchema.statics.DEFAULT_SERVICES = [
  { key: 'add_money', label: 'অ্যাড মানি', enabled: true },
  { key: 'send_money', label: 'সেন্ড মানি', enabled: false },
  { key: 'bank_transfer', label: 'ব্যাংক ট্রান্সফার', enabled: false },
  { key: 'wallet_transfer', label: 'ওয়ালেট ট্রান্সফার', enabled: false },
  { key: 'mobile_recharge', label: 'মোবাইল রিচার্জ', enabled: false },
  { key: 'tally_transfer', label: 'টালি ট্রান্সফার', enabled: false },
  { key: 'qr_code', label: 'QR কোড', enabled: false },
  { key: 'bill_payment', label: 'বিল পেমেন্ট', enabled: false },
];

WalletSchema.statics.DEFAULT_BENEFITS = [
  'বিকাশ, রকেট বা ব্যাংক অ্যাপ থেকে আপনার টালিপে লিংকড ব্যাংক একাউন্টের মাধ্যমে অ্যাড মানি করুন',
  'যেকোনো বাংলা QR-এ পেমেন্ট করুন',
];

module.exports = model('Wallet', WalletSchema);
