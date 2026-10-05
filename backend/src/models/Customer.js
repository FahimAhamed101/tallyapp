const { Schema, model, Types } = require('mongoose');

/**
 * A customer or supplier, owned by exactly one user. Balances are NOT stored
 * here — they are derived from the transaction ledger so the numbers can never
 * drift out of sync.
 */
const CustomerSchema = new Schema(
  {
    owner: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    type: { type: String, enum: ['customer', 'supplier'], default: 'customer' },
    /** Free-text বিবরণ typed on the add/edit form. */
    note: { type: String, default: '', trim: true },
    initials: { type: String, default: '' },
    avatarColor: { type: String, default: '#D1FAD1' },
    avatarTextColor: { type: String, default: '#1A1A1A' },
    /** Cloudinary secure URL, set when the user picks a photo. */
    photoUrl: { type: String, default: '' },
    photoPublicId: { type: String, default: '' },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

CustomerSchema.index({ owner: 1, name: 1 });
CustomerSchema.index({ owner: 1, phone: 1 });

/** First two visible characters, matching the reference app's avatar badge. */
CustomerSchema.statics.makeInitials = function makeInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  // Latin initials read better uppercase ("vbv" -> "VB"); Bengali has no case.
  return /^[\x00-\x7F]+$/.test(raw) ? raw.toUpperCase() : raw;
};

const AVATAR_PALETTE = [
  ['#D1FAD1', '#1A1A1A'],
  ['#FFE0B2', '#8A4B00'],
  ['#D6E4FF', '#1B4E9B'],
  ['#E6DDFF', '#4A2FA8'],
  ['#FFD9D9', '#9B1C1C'],
  ['#D9F2F7', '#0E5C6B'],
];

CustomerSchema.statics.pickAvatar = function pickAvatar(seed) {
  const s = String(seed || 'x');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

module.exports = model('Customer', CustomerSchema);
