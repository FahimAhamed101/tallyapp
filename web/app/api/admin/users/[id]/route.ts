import { NextResponse, type NextRequest } from 'next/server';
import User from '@/lib/models/User';
import Profile from '@/lib/models/Profile';
import Wallet from '@/lib/models/Wallet';
import Customer from '@/lib/models/Customer';
import Transaction from '@/lib/models/Transaction';
import CashboxEntry from '@/lib/models/CashboxEntry';
import { badRequest, handler, isObjectId, notFound, readJson } from '@/lib/api-helpers';
import { requireAdmin } from '@/lib/auth';
import { adminUserUpdateSchema, formatZodError } from '@/lib/validators';
import { getProfile, getSummary, getWallet } from '@/lib/app-data';
import { amount } from '@/lib/bengali';

/**
 * GET    /api/admin/users/:id  -> one account, its totals and recent activity
 * PATCH  /api/admin/users/:id  -> rename, change phone, promote/demote, disable
 * DELETE /api/admin/users/:id  -> remove the account and everything it owns
 *
 * Admin only. A PATCH that disables or demotes the caller's own account is
 * refused, so an admin cannot lock themselves out by accident.
 */

export const dynamic = 'force-dynamic';

async function loadUser(id: string) {
  if (!isObjectId(id)) throw notFound('ব্যবহারকারী পাওয়া যায়নি');
  const user = await User.findById(id);
  if (!user) throw notFound('ব্যবহারকারী পাওয়া যায়নি');
  return user;
}

export const GET = handler(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    await requireAdmin(req);
    const user = await loadUser(ctx.params.id);

    const [profile, wallet, summaryOut, customers, transactions, cashbox] = await Promise.all([
      getProfile(user),
      getWallet(user._id),
      getSummary(user._id),
      Customer.countDocuments({ owner: user._id }),
      Transaction.countDocuments({ owner: user._id }),
      CashboxEntry.countDocuments({ owner: user._id }),
    ]);

    const recentTx = await Transaction.find({ owner: user._id })
      .sort({ date: -1 })
      .limit(10)
      .populate('customer', 'name')
      .lean();

    return NextResponse.json({
      user: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        photoUrl: user.photoUrl || '',
        role: user.role || 'user',
        disabled: !!user.disabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        sessionCount: (user.sessions || []).length,
      },
      profile,
      wallet,
      summary: summaryOut,
      counts: { customers, transactions, cashbox },
      recentTransactions: recentTx.map((t) => ({
        id: String(t._id),
        kind: t.kind,
        amount: t.amount,
        amountDisplay: amount(t.amount),
        date: t.date,
        description: t.description || '',
        customerName:
          (t.customer as unknown as { name?: string } | null)?.name || '(মুছে ফেলা)',
      })),
    });
  },
);

export const PATCH = handler(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { user: admin } = await requireAdmin(req);
    const user = await loadUser(ctx.params.id);

    const body = await readJson(req);
    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest('ইনপুট সঠিক নয়', formatZodError(parsed.error));
    }

    const isSelf = String(admin._id) === String(user._id);
    const { name, phone, role, disabled, photoUrl } = parsed.data;

    // Guard rails: an admin must not be able to lock themselves out.
    if (isSelf && disabled === true) throw badRequest('নিজের অ্যাকাউন্ট বন্ধ করা যাবে না');
    if (isSelf && role === 'user') throw badRequest('নিজের অ্যাডমিন অনুমতি সরানো যাবে না');

    if (name !== undefined) user.name = name;
    if (phone !== undefined) {
      const cleanPhone = User.normalizePhone(phone);
      if (!User.isValidPhone(cleanPhone)) throw badRequest('সঠিক মোবাইল নম্বর দিন');
      const clash = await User.findOne({ phone: cleanPhone, _id: { $ne: user._id } });
      if (clash) throw badRequest('এই নম্বর দিয়ে অন্য অ্যাকাউন্ট আছে');
      user.phone = cleanPhone;
    }
    if (role !== undefined) user.role = role;
    if (disabled !== undefined) user.disabled = disabled;
    if (photoUrl !== undefined) user.photoUrl = String(photoUrl || '').trim();

    await user.save();

    // Keep the denormalised profile row in step with the account.
    if (name !== undefined || phone !== undefined || photoUrl !== undefined) {
      await Profile.updateOne(
        { owner: user._id },
        {
          ...(name !== undefined ? { name: user.name } : {}),
          ...(phone !== undefined ? { phone: user.phone } : {}),
          ...(photoUrl !== undefined ? { photoUrl: user.photoUrl || '' } : {}),
        },
      );
    }

    // Disabling or demoting should not leave live sessions behind.
    if (disabled === true || role === 'user') {
      await User.updateOne({ _id: user._id }, { $set: { sessions: [] } });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        role: user.role,
        disabled: !!user.disabled,
        photoUrl: user.photoUrl || '',
      },
    });
  },
);

export const DELETE = handler(
  async (req: NextRequest, ctx: { params: { id: string } }) => {
    const { user: admin } = await requireAdmin(req);
    const user = await loadUser(ctx.params.id);

    if (String(admin._id) === String(user._id)) {
      throw badRequest('নিজের অ্যাকাউন্ট মোছে ফেলা যাবে না');
    }

    // Cascade: everything the account owns goes with it.
    const [customers, transactions, cashbox] = await Promise.all([
      Customer.deleteMany({ owner: user._id }),
      Transaction.deleteMany({ owner: user._id }),
      CashboxEntry.deleteMany({ owner: user._id }),
    ]);
    await Promise.all([
      Profile.deleteMany({ owner: user._id }),
      Wallet.deleteMany({ owner: user._id }),
    ]);
    await user.deleteOne();

    return NextResponse.json({
      ok: true,
      deletedId: ctx.params.id,
      removed: {
        customers: customers.deletedCount || 0,
        transactions: transactions.deletedCount || 0,
        cashbox: cashbox.deletedCount || 0,
      },
    });
  },
);
