import { NextResponse, type NextRequest } from 'next/server';
import Deposit from '@/lib/models/Deposit';
import Wallet from '@/lib/models/Wallet';
import { badRequest, conflict, handler, isObjectId, notFound, readJson } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { depositView, getWallet } from '@/lib/app-data';

/**
 * POST /api/admin/deposits/:id  { action: 'approve' | 'reject', note?, amount? }
 *
 * Approving is the only thing in the product that adds to a wallet balance
 * without a payment gateway. It has to be exactly-once:
 *
 *   1. claim the row with a conditional update (`status: 'pending'` in the
 *      filter), so of two admins clicking at the same time only one wins;
 *   2. credit the wallet;
 *   3. if the credit throws, put the row back to pending.
 *
 * Crediting first and claiming second would double-credit on a double click,
 * which is money out of the door and needs a manual correction. Claiming first
 * can at worst leave an approved row uncredited — visible in the queue, and
 * fixable with the balance setter — so that is the failure we choose.
 *
 * Admin only.
 */

export const dynamic = 'force-dynamic';

export const POST = handler(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { user: admin } = await requireAdmin(req);
    const id = ctx.params.id;
    if (!isObjectId(id)) throw notFound('রিকোয়েস্ট পাওয়া যায়নি');

    const body = await readJson(req);
    const action = String(body.action ?? '');
    const note = String(body.note ?? '').trim();

    if (action === 'reject') {
      const rejected = await Deposit.findOneAndUpdate(
        { _id: id, status: 'pending' },
        { $set: { status: 'rejected', note, reviewedBy: admin._id, reviewedAt: new Date() } },
        { new: true },
      );
      if (!rejected) {
        throw conflict('এই রিকোয়েস্ট আগেই নিষ্পত্তি হয়ে গেছে');
      }
      return NextResponse.json({
        ok: true,
        deposit: depositView(rejected as never),
        message: 'রিকোয়েস্ট বাতিল করা হয়েছে',
      });
    }

    if (action !== 'approve') {
      throw badRequest('action হবে approve অথবা reject');
    }

    // A typo in the amount is the most likely admin mistake, so the corrected
    // figure is validated the same way the user's was.
    const override = body.amount === undefined || body.amount === null || body.amount === ''
      ? null
      : Number(body.amount);
    if (override !== null && (!Number.isFinite(override) || override < 1 || override > 500000)) {
      throw badRequest('সঠিক টাকার পরিমাণ দিন (সর্বোচ্চ ৫,০০,০০০)');
    }

    const claimed = await Deposit.findOneAndUpdate(
      { _id: id, status: 'pending' },
      {
        $set: {
          status: 'approved',
          note,
          reviewedBy: admin._id,
          reviewedAt: new Date(),
          creditedAt: new Date(),
          ...(override !== null ? { amount: override } : {}),
        },
      },
      { new: true },
    );

    if (!claimed) {
      // Either it never existed or somebody already dealt with it. Both mean
      // "do not credit again".
      throw conflict('এই রিকোয়েস্ট আগেই নিষ্পত্তি হয়ে গেছে');
    }

    try {
      let wallet = await Wallet.findOne({ owner: claimed.owner });
      if (!wallet) {
        wallet = await Wallet.create({
          owner: claimed.owner,
          balance: 0,
          accountOpened: false,
          services: Wallet.DEFAULT_SERVICES.map((s) => ({ ...s })),
          benefits: [...Wallet.DEFAULT_BENEFITS],
        });
      }

      // `$inc` rather than read-modify-write: an admin approving a deposit at
      // the same moment the owner's own screen saves should not lose an update.
      await Wallet.updateOne({ _id: wallet._id }, { $inc: { balance: claimed.amount } });
    } catch (err) {
      await Deposit.updateOne(
        { _id: claimed._id },
        { $set: { status: 'pending', reviewedBy: null, reviewedAt: null, creditedAt: null } },
      );
      throw err;
    }

    return NextResponse.json({
      ok: true,
      deposit: depositView(claimed as never),
      wallet: await getWallet(claimed.owner as never),
      message: 'ব্যালেন্স যোগ করা হয়েছে',
    });
  },
);