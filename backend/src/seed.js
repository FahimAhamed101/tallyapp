const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connect, mongoose } = require('./db');

const User = require('./models/User');
const Profile = require('./models/Profile');
const Customer = require('./models/Customer');
const Transaction = require('./models/Transaction');
const CashboxEntry = require('./models/CashboxEntry');
const Wallet = require('./models/Wallet');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

const ago = (ms) => new Date(Date.now() - ms);
const startOfToday = () => {
  const d = new Date();
  d.setHours(9, 30, 0, 0); // a plausible opening time, still "today"
  return d;
};

/** Demo logins — phone number + password, exactly what the app's login form takes. */
const ACCOUNTS = [
  { name: 'fahim', phone: '+8801706617723', password: '123456' },
  { name: 'করিম', phone: '+8801811223344', password: '123456' },
];

/**
 * The full book for the first account.
 */
const FAHIM_PEOPLE = [
  {
    name: 'vbv',
    type: 'customer',
    phone: '',
    avatarColor: '#D1FAD1',
    avatarTextColor: '#1A1A1A',
    lastActivityAt: ago(80 * MIN),
    ledger: [],
  },
  {
    name: 'রহিম স্টোর',
    type: 'customer',
    phone: '+8801712345678',
    avatarColor: '#FFE0B2',
    avatarTextColor: '#8A4B00',
    lastActivityAt: ago(2 * HOUR),
    ledger: [
      { kind: 'payment_received', amount: 1750, description: 'পেমেন্ট গ্রহণ', date: ago(5 * DAY) },
      { kind: 'sale', amount: 3000, description: 'বাকি বিক্রয়', date: ago(2 * HOUR) },
    ],
  },
  {
    name: 'করিম ট্রেডার্স',
    type: 'supplier',
    phone: '+8801811223344',
    avatarColor: '#D6E4FF',
    avatarTextColor: '#1B4E9B',
    lastActivityAt: ago(1 * DAY),
    ledger: [
      { kind: 'purchase', amount: 5000, description: 'মাল ক্রয়', date: ago(1 * DAY) },
      { kind: 'payment_made', amount: 4159.5, description: 'সাপ্লায়ারকে পেমেন্ট', date: ago(3 * DAY) },
    ],
  },
  {
    name: 'আবুল ভাই',
    type: 'customer',
    phone: '+8801912001122',
    avatarColor: '#E6DDFF',
    avatarTextColor: '#4A2FA8',
    lastActivityAt: ago(2 * DAY),
    ledger: [
      { kind: 'sale', amount: 1000, description: 'নগদ বিক্রয়', date: ago(5 * DAY) },
      { kind: 'payment_received', amount: 1000, description: 'পেমেন্ট গ্রহণ', date: ago(2 * DAY) },
    ],
  },
  {
    name: 'নাজমা এন্টারপ্রাইজ',
    type: 'customer',
    phone: '+8801677889900',
    avatarColor: '#FFD9D9',
    avatarTextColor: '#9B1C1C',
    lastActivityAt: ago(3 * DAY),
    ledger: [
      { kind: 'payment_received', amount: 1000, description: 'পেমেন্ট গ্রহণ', date: ago(6 * DAY) },
      { kind: 'sale', amount: 4200, description: 'বাকি বিক্রয়', date: ago(3 * DAY) },
    ],
  },
  {
    name: 'মেসার্স হাসান ট্রেডার্স',
    type: 'supplier',
    phone: '+8801533221100',
    avatarColor: '#D9F2F7',
    avatarTextColor: '#0E5C6B',
    lastActivityAt: ago(6 * DAY),
    ledger: [
      { kind: 'purchase', amount: 12500, description: 'পাইকারি মাল ক্রয়', date: ago(7 * DAY) },
      { kind: 'payment_made', amount: 12500, description: 'সাপ্লায়ারকে পেমেন্ট', date: ago(6 * DAY) },
    ],
  },
];

const FAHIM_CASH = [
  // today
  { kind: 'cash_sale', amount: 2500, description: 'নগদ বিক্রয়', date: new Date(startOfToday().getTime() + 20 * MIN) },
  { kind: 'cash_purchase', amount: 1800, description: 'মাল কেনা', date: new Date(startOfToday().getTime() + 95 * MIN) },
  { kind: 'cash_sale', amount: 1200, description: 'নগদ বিক্রয়', date: new Date(startOfToday().getTime() + 150 * MIN) },
  { kind: 'expense', amount: 350, description: 'দোকান ভাড়া', category: 'ভাড়া', date: new Date(startOfToday().getTime() + 190 * MIN) },
  { kind: 'owner_in', amount: 5000, description: 'মালিকের বিনিয়োগ', date: new Date(startOfToday().getTime() + 30 * MIN) },
  { kind: 'owner_out', amount: 1000, description: 'ব্যক্তিগত খরচ', date: new Date(startOfToday().getTime() + 220 * MIN) },
  // earlier days
  { kind: 'cash_sale', amount: 3200, description: 'নগদ বিক্রয়', date: ago(1 * DAY) },
  { kind: 'cash_sale', amount: 2750, description: 'নগদ বিক্রয়', date: ago(1 * DAY + 3 * HOUR) },
  { kind: 'cash_purchase', amount: 2100, description: 'মাল কেনা', date: ago(2 * DAY) },
  { kind: 'expense', amount: 500, description: 'বিদ্যুৎ বিল', category: 'বিদ্যুৎ', date: ago(2 * DAY) },
  { kind: 'cash_sale', amount: 4100, description: 'নগদ বিক্রয়', date: ago(3 * DAY) },
  { kind: 'expense', amount: 200, description: 'যাতায়াত', category: 'যাতায়াত', date: ago(3 * DAY) },
];

/**
 * A deliberately different second book, so per-user isolation is visible:
 * logging in as করিম must show none of fahim's customers.
 */
const KARIM_PEOPLE = [
  {
    name: 'সুমন জেনারেল স্টোর',
    type: 'customer',
    phone: '+8801755001100',
    avatarColor: '#D1FAD1',
    avatarTextColor: '#1A1A1A',
    lastActivityAt: ago(4 * HOUR),
    ledger: [
      { kind: 'sale', amount: 900, description: 'বাকি বিক্রয়', date: ago(4 * HOUR) },
      { kind: 'payment_received', amount: 400, description: 'পেমেন্ট গ্রহণ', date: ago(1 * HOUR) },
    ],
  },
  {
    name: 'রফিক সাপ্লাই',
    type: 'supplier',
    phone: '+8801966002200',
    avatarColor: '#D6E4FF',
    avatarTextColor: '#1B4E9B',
    lastActivityAt: ago(2 * DAY),
    ledger: [{ kind: 'purchase', amount: 2200, description: 'মাল ক্রয়', date: ago(2 * DAY) }],
  },
];

const KARIM_CASH = [
  { kind: 'cash_sale', amount: 700, description: 'নগদ বিক্রয়', date: new Date(startOfToday().getTime() + 60 * MIN) },
  { kind: 'expense', amount: 120, description: 'চা-নাস্তা', category: 'আপ্যায়ন', date: new Date(startOfToday().getTime() + 120 * MIN) },
  { kind: 'owner_in', amount: 1500, description: 'মালিকের বিনিয়োগ', date: ago(1 * DAY) },
];

/** Creates (or resets) one account and its whole book. */
async function seedAccount({ name, phone, password }, people, cash) {
  let user = await User.findOne({ phone });
  if (!user) user = new User({ name, phone });
  user.name = name;
  User.setPassword(user, password);
  user.sessions = [];
  await user.save();

  await Profile.findOneAndUpdate(
    { owner: user._id },
    {
      owner: user._id,
      name,
      phone,
      initials: Customer.makeInitials(name),
      goldPlanName: 'টালিখাতা গোল্ড (ট্রায়াল)',
      goldTrialDays: 30,
      inboxUnread: 1,
      smsRemaining: 10,
      appVersion: '৭.১৭.০',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await Wallet.findOneAndUpdate(
    { owner: user._id },
    {
      owner: user._id,
      balance: 0,
      accountOpened: false,
      services: Wallet.DEFAULT_SERVICES.map((s) => ({ ...s })),
      benefits: [...Wallet.DEFAULT_BENEFITS],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Wipe this user's book so re-seeding is idempotent.
  await Transaction.deleteMany({ owner: user._id });
  await Customer.deleteMany({ owner: user._id });
  await CashboxEntry.deleteMany({ owner: user._id });

  for (const p of people) {
    const [bg, fg] = Customer.pickAvatar(p.name);
    const doc = await Customer.create({
      owner: user._id,
      name: p.name,
      phone: p.phone,
      type: p.type,
      initials: Customer.makeInitials(p.name),
      avatarColor: p.avatarColor || bg,
      avatarTextColor: p.avatarTextColor || fg,
      lastActivityAt: p.lastActivityAt,
    });
    if (p.ledger.length) {
      await Transaction.insertMany(
        p.ledger.map((t) => ({ ...t, owner: user._id, customer: doc._id })),
      );
    }
    console.log(`  customer : ${doc.name.padEnd(24)} ${doc.type.padEnd(9)} ${p.ledger.length} txns`);
  }

  if (cash.length) {
    await CashboxEntry.insertMany(cash.map((c) => ({ ...c, owner: user._id })));
  }
  console.log(`  cashbox  : ${cash.length} entries`);
  return user;
}

async function seed({ fresh }) {
  await connect();

  if (fresh) {
    await Promise.all([
      User.deleteMany({}),
      Profile.deleteMany({}),
      Customer.deleteMany({}),
      Transaction.deleteMany({}),
      CashboxEntry.deleteMany({}),
      Wallet.deleteMany({}),
    ]);
    console.log('cleared existing data');
  }

  console.log('\naccount 1');
  await seedAccount(ACCOUNTS[0], FAHIM_PEOPLE, FAHIM_CASH);
  console.log('account 2');
  await seedAccount(ACCOUNTS[1], KARIM_PEOPLE, KARIM_CASH);

  const counts = {
    users: await User.countDocuments(),
    profiles: await Profile.countDocuments(),
    customers: await Customer.countDocuments(),
    transactions: await Transaction.countDocuments(),
    cashboxEntries: await CashboxEntry.countDocuments(),
    wallets: await Wallet.countDocuments(),
  };
  console.log('\nseeded:', JSON.stringify(counts));

  console.log('\nlogins (phone / password):');
  ACCOUNTS.forEach((a) => console.log(`  ${a.phone.padEnd(16)} ${a.password}   (${a.name})`));
}

const fresh = process.argv.includes('--fresh');

seed({ fresh })
  .then(async () => {
    console.log('\nSEED OK');
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('SEED FAILED:', err.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
