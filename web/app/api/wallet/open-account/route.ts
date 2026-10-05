import { NextResponse, type NextRequest } from 'next/server';
import Wallet from '@/lib/models/Wallet';
import { handler, notFound } from '@/lib/api-helpers';
import { requireAuth } from '@/lib/auth';
import { getWallet } from '@/lib/app-data';

/** POST /api/wallet/open-account — the টালিপে একাউন্ট খুলুন button. */

export const dynamic = 'force-dynamic';

export const POST = handler(async (req: NextRequest) => {
  const { user } = await requireAuth(req);

  let doc = await Wallet.findOne({ owner: user._id });
  if (!doc) {
    await getWallet(user._id); // self-heal
    doc = await Wallet.findOne({ owner: user._id });
  }
  if (!doc) throw notFound('ওয়ালেট পাওয়া যায়নি');

  doc.accountOpened = true;
  // `set()` because the inferred `services` type is a mongoose DocumentArray.
  doc.set(
    'services',
    doc.services.map((s) => ({ key: s.key, label: s.label, enabled: true })),
  );
  await doc.save();

  return NextResponse.json({ ok: true, wallet: await getWallet(user._id) });
});
