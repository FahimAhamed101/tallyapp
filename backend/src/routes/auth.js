const router = require('express').Router();
const User = require('../models/User');
const Profile = require('../models/Profile');
const Wallet = require('../models/Wallet');
const { asyncHandler, badRequest, httpError } = require('../lib/http');
const { requireAuth, unauthorized } = require('../lib/auth');

const MIN_PASSWORD = 6;

/** Initials for the avatar badge, matching the customer rule. */
function initialsFor(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  return /^[\x00-\x7F]+$/.test(raw) ? raw.toUpperCase() : raw;
}

/** Every account gets its own profile + wallet so the UI is never empty. */
async function provision(user) {
  const [profile, wallet] = await Promise.all([
    Profile.findOne({ owner: user._id }),
    Wallet.findOne({ owner: user._id }),
  ]);

  if (!profile) {
    await Profile.create({
      owner: user._id,
      name: user.name,
      phone: user.phone,
      initials: initialsFor(user.name),
    });
  }
  if (!wallet) {
    await Wallet.create({
      owner: user._id,
      balance: 0,
      accountOpened: false,
      services: Wallet.DEFAULT_SERVICES.map((s) => ({ ...s })),
      benefits: [...Wallet.DEFAULT_BENEFITS],
    });
  }
}

function validateRegistration({ name, phone, password }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw badRequest('নাম আবশ্যক');
  if (cleanName.length > 60) throw badRequest('নাম অনেক বড়');

  if (!User.isValidPhone(phone)) throw badRequest('সঠিক মোবাইল নম্বর দিন');

  const pw = String(password || '');
  if (pw.length < MIN_PASSWORD) throw badRequest(`পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD} অক্ষরের হতে হবে`);

  return { cleanName, cleanPhone: User.normalizePhone(phone), password: pw };
}

/** POST /api/auth/register  { name, phone, password } */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    // NB: validateRegistration returns `cleanName` (trimmed), not `name` — the
    // old destructuring of `name` silently produced undefined here.
    const { cleanName, cleanPhone, password } = validateRegistration(req.body || {});

    const existing = await User.findOne({ phone: cleanPhone });
    if (existing) throw httpError(409, 'এই নম্বর দিয়ে আগেই অ্যাকাউন্ট আছে, লগইন করুন');

    const user = new User({ name: cleanName, phone: cleanPhone });
    User.setPassword(user, password);
    const token = User.issueToken(user);
    await user.save();

    await provision(user);

    res.status(201).json({ token, user: User.publicView(user) });
  }),
);

/** POST /api/auth/login  { phone, password } */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body || {};
    if (!phone) throw badRequest('মোবাইল নম্বর দিন');

    const cleanPhone = User.normalizePhone(phone);
    const user = await User.findOne({ phone: cleanPhone });

    // Same message either way, so the endpoint cannot be used to enumerate accounts.
    if (!user || !User.verifyPassword(user, password)) {
      throw unauthorized('নম্বর বা পাসওয়ার্ড সঠিক নয়');
    }

    const token = User.issueToken(user);
    await user.save();
    await provision(user);

    res.json({ token, user: User.publicView(user) });
  }),
);

/** GET /api/auth/me — used on cold start to decide login vs main app. */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: User.publicView(req.user) });
  }),
);

/** POST /api/auth/logout — drops only the calling device's session. */
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    User.revokeToken(req.user, req.tokenHash);
    await req.user.save();
    res.json({ ok: true });
  }),
);

/** POST /api/auth/password — change password, keeping the caller logged in. */
router.post(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!User.verifyPassword(req.user, currentPassword)) {
      throw unauthorized('বর্তমান পাসওয়ার্ড সঠিক নয়');
    }
    const pw = String(newPassword || '');
    if (pw.length < MIN_PASSWORD) throw badRequest(`পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD} অক্ষরের হতে হবে`);

    User.setPassword(req.user, pw);
    // Keep this device signed in; drop every other session.
    req.user.sessions = (req.user.sessions || []).filter((s) => s.hash === req.tokenHash);
    await req.user.save();
    res.json({ ok: true });
  }),
);

module.exports = router;
