import './env';
import mongoose from 'mongoose';
import { dbConnect } from '../lib/mongodb';
import User from '../lib/models/User';
import StockItem from '../lib/models/StockItem';
import StockMovement from '../lib/models/StockMovement';
import { ensurePrimaryBusiness, scopeOf } from '../lib/business';
import { listStockItems, summarise } from '../lib/stock';

/**
 * Demo stock data (স্টক হিসাব).
 *
 *   tsx scripts/seed-stock.ts                    -> the default admin account
 *   tsx scripts/seed-stock.ts +8801700000000     -> a different account
 *   tsx scripts/seed-stock.ts --purge            -> remove exactly what it added
 *
 * Deliberately *not* part of `seed.ts`: that script provisions the admin
 * account and states outright that it never touches shopkeeper data. Mixing
 * demo rows into it would make "run the seed" mean two different things.
 *
 * Idempotent — an item whose name already exists in the book is skipped, and a
 * movement is only added the first time that item is created. Running it twice
 * is a no-op, so it is safe to re-run after a partial failure. `--purge` only
 * removes the names listed in [ITEMS], so it cannot take real data with it.
 */

const DEFAULT_PHONE = '+8801706617723';

/** name, unit, purchase price, sale price, opening stock, low-stock threshold */
const ITEMS: [string, string, number, number, number, number][] = [
  ['মিনিকেট চাল', 'কেজি', 62, 72, 120, 30],
  ['সয়াবিন তেল', 'লিটার', 168, 185, 40, 10],
  ['চিনি', 'কেজি', 118, 130, 25, 8],
  ['মসুর ডাল', 'কেজি', 135, 150, 18, 25], // deliberately below its threshold
  ['আটা', 'কেজি', 48, 56, 60, 15],
  ['লবণ', 'প্যাকেট', 35, 42, 80, 20],
];

/** item name -> the movements to record the first time it is created. */
const MOVEMENTS: Record<string, { direction: 'in' | 'out'; quantity: number; note: string }[]> = {
  'মিনিকেট চাল': [
    { direction: 'in', quantity: 30, note: 'নতুন মাল' },
    { direction: 'out', quantity: 45, note: 'বিক্রয়' },
  ],
  'সয়াবিন তেল': [{ direction: 'out', quantity: 12, note: 'বিক্রয়' }],
  'চিনি': [{ direction: 'in', quantity: 20, note: 'নতুন মাল' }],
  'মসুর ডাল': [{ direction: 'out', quantity: 2, note: 'বিক্রয়' }],
};

async function main() {
  const args = process.argv.slice(2);
  const purge = args.includes('--purge');
  const phone = User.normalizePhone(args.find((a) => !a.startsWith('--')) || DEFAULT_PHONE);

  await dbConnect();
  console.log(`[seed-stock] connected to ${mongoose.connection.name} @ ${mongoose.connection.host}`);

  const user = await User.findOne({ phone });
  if (!user) throw new Error(`No account for ${phone} — run \`npm run seed\` first`);

  const business = await ensurePrimaryBusiness(user);
  const scope = scopeOf(user, business);
  console.log(`[seed-stock] book "${business.name}" (${String(business._id)})`);

  if (purge) {
    const doomed = await StockItem.find({ ...scope, name: { $in: ITEMS.map((i) => i[0]) } });
    const ids = doomed.map((d) => d._id);
    const movements = await StockMovement.deleteMany({ ...scope, item: { $in: ids } });
    const items = await StockItem.deleteMany({ ...scope, name: { $in: ITEMS.map((i) => i[0]) } });
    console.log(
      `[seed-stock] purged ${items.deletedCount} demo items and ` +
        `${movements.deletedCount} movements`,
    );
    await mongoose.disconnect();
    return;
  }

  let created = 0;
  let skipped = 0;
  let movements = 0;

  for (const [name, unit, purchasePrice, salePrice, openingStock, lowStockThreshold] of ITEMS) {
    const existing = await StockItem.findOne({ ...scope, name });
    if (existing) {
      skipped += 1;
      continue;
    }

    const item = await StockItem.create({
      owner: user._id,
      business: business._id,
      name,
      unit,
      purchasePrice,
      salePrice,
      openingStock,
      lowStockThreshold,
    });
    created += 1;

    for (const m of MOVEMENTS[name] || []) {
      await StockMovement.create({
        owner: user._id,
        business: business._id,
        item: item._id,
        direction: m.direction,
        quantity: m.quantity,
        unitCost: purchasePrice,
        note: m.note,
      });
      movements += 1;
    }
  }

  console.log(
    `[seed-stock] items: ${created} created, ${skipped} already present; movements: ${movements}`,
  );

  // Read it back through the same code the API uses, so the printed numbers are
  // the ones the app will show rather than a second calculation that could differ.
  const view = await listStockItems(scope);
  const summary = summarise(view);
  console.log(`[seed-stock] ${summary.countLabel} · ${summary.costValueLabel}`);
  if (summary.lowStockLabel) console.log(`[seed-stock] ${summary.lowStockLabel}`);
  view.forEach((i) => {
    const flag = i.lowStock ? '  ⚠ স্টক কম' : '';
    console.log(`  · ${i.name.padEnd(14)} ${i.quantityLabel.padEnd(16)} ${i.valueLabel}${flag}`);
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed-stock] failed:', err);
  process.exit(1);
});
