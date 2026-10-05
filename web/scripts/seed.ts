import './env';
import mongoose from 'mongoose';
import { dbConnect } from '../lib/mongodb';
import User from '../lib/models/User';

/**
 * Admin provisioning.
 *
 *   tsx scripts/seed.ts                     -> promote the known account, or create it
 *   tsx scripts/seed.ts +8801700000000 pw   -> use a different phone / password
 *
 * The panel needs at least one account with `role: 'admin'`. Accounts created
 * by the Android app always land as `role: 'user'`, and the documents already
 * in the shared Atlas database predate the `role` field entirely — so this
 * script is what opens the door the first time.
 *
 * It never touches the shopkeeper data: it only sets `role` on the account it
 * is pointed at.
 */

const DEFAULT_PHONE = '+8801706617723';
const DEFAULT_PASSWORD = '123456';

async function main() {
  const phoneArg = process.argv[2];
  const passwordArg = process.argv[3];

  await dbConnect();
  console.log(`[seed] connected to ${mongoose.connection.name} @ ${mongoose.connection.host}`);

  const phone = User.normalizePhone(phoneArg || DEFAULT_PHONE);
  if (!User.isValidPhone(phone)) {
    throw new Error(`Invalid phone number: ${phoneArg || DEFAULT_PHONE}`);
  }

  let user = await User.findOne({ phone });

  if (!user) {
    const password = passwordArg || DEFAULT_PASSWORD;
    user = new User({ name: 'সুপার অ্যাডমিন', phone, role: 'admin', disabled: false });
    User.setPassword(user, password);
    await user.save();
    console.log(`[seed] created admin ${user.name} <${phone}> with password "${password}"`);
  } else {
    user.role = 'admin';
    user.disabled = false;
    if (passwordArg) {
      User.setPassword(user, passwordArg);
      console.log(`[seed] password reset for <${phone}>`);
    }
    await user.save();
    console.log(`[seed] promoted existing account "${user.name}" <${phone}> to admin`);
  }

  // A quick census so it is obvious which database was just touched.
  const [total, admins, disabled] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ disabled: true }),
  ]);

  console.log('');
  console.log('[seed] ── accounts ─────────────────────────');
  console.log(`[seed]   total       : ${total}`);
  console.log(`[seed]   admins      : ${admins}`);
  console.log(`[seed]   disabled    : ${disabled}`);
  console.log('');
  console.log('[seed] Panel sign-in:');
  console.log(`[seed]   phone    ${phone}`);
  console.log(`[seed]   password ${passwordArg || (phone === DEFAULT_PHONE ? DEFAULT_PASSWORD : '(unchanged)')}`);
  console.log('[seed]   url      http://127.0.0.1:4000/admin/login');

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
