const User = require('../models/User');
const { httpError } = require('./http');

const unauthorized = (msg) => httpError(401, msg);
const forbidden = (msg) => httpError(403, msg);

/** Pulls a raw token out of `Authorization: Bearer <token>`. */
function bearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(\S+)$/i.exec(String(header).trim());
  return match ? match[1] : null;
}

/**
 * Resolves the caller from their bearer token and hangs the user off the
 * request. Every data route sits behind this, which is what makes each
 * account see only its own customers and ledger.
 */
async function resolveUser(req) {
  const token = bearerToken(req);
  if (!token) throw unauthorized('লগইন প্রয়োজন');

  const hash = User.hashToken(token);
  const user = await User.findOne({ 'sessions.hash': hash });
  if (!user) throw unauthorized('সেশন শেষ হয়ে গেছে, আবার লগইন করুন');

  req.user = user;
  req.tokenHash = hash;
  return user;
}

/** Express middleware form. */
const requireAuth = (req, res, next) => {
  resolveUser(req).then(() => next()).catch(next);
};

module.exports = { requireAuth, resolveUser, bearerToken, unauthorized, forbidden };
