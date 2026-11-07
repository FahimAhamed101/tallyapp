import { NextResponse, type NextRequest } from 'next/server';
import Wallet from '@/lib/models/Wallet';
import User from '@/lib/models/User';
import { badRequest, handler, isObjectId, notFound, readJson } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { getWallet } from '@/lib/app-data';

/**
 * POST /api/admin/wallet/:userId  { balance }  or  { delta }
 *
 * Sets a wallet balance outright, or nudges it. The deposit queue covers the
 * normal path; this exists for the abnormal ones — money that arrived with no
 * request row, a request that was approved but never credited, or a correction
 * after a wrong amount.
 *
 * Absolute (`balance`) is what the admin usually wants, because they are
 * reading the figure off a statement; `delta` is there for an adjustment.
 *
 * Admin only.
 */

export const dynamic = 'force-dynamic';

export const POST = handler(
  async (req: NextRequest, ctx: { params: { userId: string } }) => {
    await requireAdmin(req);
    const userId = ctx.params.userId;
    if (!isObjectId(userId)) throw notFound('ব্যবহারকারী পাওয়া যায়নি');

    const user = await User.findById(userId).select('_id').lean();
    if (!user) throw notFound('ব্যবহারকারী পাওয়া যায়নি');

    const body = await readJson(req);
    const hasBalance = body.balance !== undefined && body.balance !== null && body.balance !== '';
    const hasDelta = body.delta !== undefined && body.delta !== null && body.delta !== '';

    if (!hasBalance && !hasDelta) {
      throw badRequest('balance অথবা delta দিন');
    }

    const balance = hasBalance ? Number(body.balance) : NaN;
    const delta = hasDelta ? Number(body.delta) : NaN;

    if (hasBalance && (!Number.isFinite(balance) || balance < 0 || balance > 10_000_000)) {
      throw badRequest('ব্যালেন্স ০ থেকে ১ কোটি টাকার মধ্যে দিন');
    }
    if (hasDelta && !Number.isFinite(delta)) {
      throw badRequest('সঠিক অঙ্ক দিন');
    }

    let wallet = await Wallet.findOne({ owner: user._id });
    if (!wallet) {
      wallet = await Wallet.create({
        owner: user._id,
        balance: 0,
        accountOpened: false,
        services: Wallet.DEFAULT_SERVICES.map((s) => ({ ...s })),
        benefits: [...Wallet.DEFAULT_BENEFITS],
      });
    }

    if (hasBalance) {
      wallet.balance = balance;
    } else {
      wallet.balance = Math.max(0, (wallet.balance || 0) + delta);
    }
    await wallet.save();

    return NextResponse.json({
      ok: true,
      wallet: await getWallet(user._id as never),
      message: 'ব্যালেন্স হালনাগাদ করা হয়েছে',
    });
  },
);