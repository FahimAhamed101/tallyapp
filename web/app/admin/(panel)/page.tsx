'use client';

import Link from 'next/link';
import { useStatsQuery, useUsersQuery } from '@/store/adminApi';
import { Empty, ErrorNote, Loading, Who, fmtDateTime } from '@/components/ui';

/** Panel dashboard: platform-wide totals plus the busiest accounts. */

const TX_KINDS = ['sale', 'purchase', 'payment_received', 'payment_made', 'refund'];
const CASH_KINDS = ['cash_sale', 'cash_purchase', 'expense', 'owner_in', 'owner_out'];

const KIND_BN: Record<string, string> = {
  sale: 'বেচা',
  purchase: 'কেনা',
  payment_received: 'পেলাম',
  payment_made: 'দিলাম',
  refund: 'ফেরত',
  cash_sale: 'কাশ বেচা',
  cash_purchase: 'কাশ কেনা',
  expense: 'খরচ',
  owner_in: 'মালিক দিল',
  owner_out: 'মালিক নিল',
};

export default function DashboardPage() {
  const { data: stats, isLoading, error, refetch, isFetching } = useStatsQuery();
  const { data: users } = useUsersQuery({ page: 1, limit: 8 });

  if (isLoading) return <Loading label="ড্যাশবোর্ড লোড হচ্ছে…" />;
  if (error) return <ErrorNote error={error} />;
  if (!stats) return <Empty label="কোনো তথ্য পাওয়া যায়নি" />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ড্যাশবোর্ড</h1>
          <p>
            পুরো প্ল্যাটফর্মের সারসংক্ষেপ · সর্বশেষ হালনাগাদ {fmtDateTime(stats.generatedAt)}
          </p>
        </div>
        <span className="grow" />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <span className="spinner" /> : null}
          রিফ্রেশ
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat gold">
          <div className="k">ব্যবহারকারী</div>
          <div className="v">{stats.users.total}</div>
          <div className="s">
            {stats.users.admins} অ্যাডমিন · {stats.users.disabled} বন্ধ
          </div>
        </div>
        <div className="stat blue">
          <div className="k">কাস্টমার ও সাপ্লায়ার</div>
          <div className="v">{stats.customers.total}</div>
          <div className="s">
            {stats.customers.customers} কাস্টমার · {stats.customers.suppliers} সাপ্লায়ার
          </div>
        </div>
        <div className="stat gold">
          <div className="k">ব্যবসা (মাল্টি ব্যবসা)</div>
          <div className="v">{stats.businesses.total}</div>
          <div className="s">
            {stats.businesses.primaries} প্রাইমারি ·{' '}
            {stats.businesses.multiBookAccounts} অ্যাকাউন্টে একাধিক বই
          </div>
        </div>
        <div className="stat green">
          <div className="k">লেনদেন</div>
          <div className="v">{stats.transactions.total}</div>
          <div className="s">সব অ্যাকাউন্ট মিলিয়ে</div>
        </div>
        <div className="stat red">
          <div className="k">ক্যাশবক্স এন্ট্রি</div>
          <div className="v">{stats.cashbox.total}</div>
          <div className="s">সব অ্যাকাউন্ট মিলিয়ে</div>
        </div>
        <div className="stat">
          <div className="k">ছবিসহ কাস্টমার</div>
          <div className="v">{stats.photos.customersWithPhoto}</div>
          <div className="s">{stats.photos.entriesWithPhoto} টি এন্ট্রিতে ছবি</div>
        </div>
        <div className="stat">
          <div className="k">নতুন (৭ দিনে)</div>
          <div className="v">{stats.users.newLast7Days}</div>
          <div className="s">নতুন অ্যাকাউন্ট</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2>ধরন অনুযায়ী লেনদেন</h2>
          <span className="grow" />
          <Link href="/admin/transactions" className="btn-link">
            সব লেনদেন →
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ধরন</th>
                <th className="num">সংখ্যা</th>
                <th className="num">মোট পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              {TX_KINDS.map((k) => {
                const row = stats.transactions.byKind[k];
                return (
                  <tr key={k}>
                    <td>{KIND_BN[k] || k}</td>
                    <td className="num">{row?.count ?? 0}</td>
                    <td className="num">৳{(row?.total ?? 0).toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>ধরন অনুযায়ী ক্যাশবক্স</h2>
          <span className="grow" />
          <Link href="/admin/cashbox" className="btn-link">
            সব এন্ট্রি →
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ধরন</th>
                <th className="num">সংখ্যা</th>
                <th className="num">মোট পরিমাণ</th>
              </tr>
            </thead>
            <tbody>
              {CASH_KINDS.map((k) => {
                const row = stats.cashbox.byKind[k];
                return (
                  <tr key={k}>
                    <td>{KIND_BN[k] || k}</td>
                    <td className="num">{row?.count ?? 0}</td>
                    <td className="num">৳{(row?.total ?? 0).toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>সর্বশেষ অ্যাকাউন্ট</h2>
          <span className="grow" />
          <Link href="/admin/users" className="btn-link">
            সব ব্যবহারকারী →
          </Link>
        </div>
        {users && users.items.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>অ্যাকাউন্ট</th>
                  <th>ভূমিকা</th>
                  <th className="num">কাস্টমার</th>
                  <th className="num">লেনদেন</th>
                  <th className="num">ক্যাশ এন্ট্রি</th>
                  <th>যোগদান</th>
                </tr>
              </thead>
              <tbody>
                {users.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/users/${u.id}`}>
                        <Who name={u.name} sub={u.phone} photoUrl={u.photoUrl} />
                      </Link>
                    </td>
                    <td>
                      {u.role === 'admin' ? (
                        <span className="chip gold">অ্যাডমিন</span>
                      ) : (
                        <span className="chip gray">ব্যবহারকারী</span>
                      )}
                      {u.disabled ? <span className="chip red">বন্ধ</span> : null}
                    </td>
                    <td className="num">{u.customerCount}</td>
                    <td className="num">{u.transactionCount}</td>
                    <td className="num">{u.cashboxCount}</td>
                    <td className="muted">{fmtDateTime(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty label="এখনো কোনো অ্যাকাউন্ট নেই" />
        )}
      </div>
    </>
  );
}
