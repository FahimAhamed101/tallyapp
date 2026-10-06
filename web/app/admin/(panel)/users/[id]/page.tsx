'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useUpdateUserMutation, useUserQuery } from '@/store/adminApi';
import {
  Empty,
  ErrorNote,
  KindChip,
  Loading,
  Modal,
  Who,
  fmtDate,
  fmtDateTime,
} from '@/components/ui';

/** One account in full: profile, wallet, totals and recent ledger activity. */

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const { data, isLoading, error } = useUserQuery(id, { skip: !id });
  const [updateUser, { isLoading: saving }] = useUpdateUserMutation();

  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (isLoading) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Empty label="ব্যবহারকারী পাওয়া যায়নি" />;

  const { user, profile, wallet, summary, counts, recentTransactions } = data;

  const openEdit = () => {
    setName(user.name);
    setPhone(user.phone);
    setErr(null);
    setEdit(true);
  };

  const save = async () => {
    setErr(null);
    try {
      await updateUser({ id: user.id, patch: { name, phone } }).unwrap();
      setNote('সংরক্ষণ করা হয়েছে');
      setEdit(false);
    } catch (e) {
      setErr((e as { data?: { message?: string } })?.data?.message || 'সংরক্ষণ করা যায়নি');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{user.name}</h1>
          <p>
            <Link href="/admin/users" className="btn-link">
              ← ব্যবহারকারী তালিকা
            </Link>
          </p>
        </div>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={openEdit}>
          সম্পাদনা
        </button>
        <Link href={`/admin/customers?owner=${user.id}`} className="btn btn-ghost btn-sm">
          কাস্টমার দেখুন
        </Link>
        <Link href={`/admin/transactions?owner=${user.id}`} className="btn btn-ghost btn-sm">
          লেনদেন দেখুন
        </Link>
      </div>

      {note && <div className="notice ok">{note}</div>}

      <div className="stat-grid">
        <div className="stat green">
          <div className="k">পাবো</div>
          <div className="v">৳{summary.receivable.display}</div>
        </div>
        <div className="stat red">
          <div className="k">দেবো</div>
          <div className="v">৳{summary.payable.display}</div>
        </div>
        <div className="stat">
          <div className="k">কাস্টমার / সাপ্লায়ার</div>
          <div className="v">
            {summary.customerCount} / {summary.supplierCount}
          </div>
        </div>
        <div className="stat blue">
          <div className="k">লেনদেন</div>
          <div className="v">{summary.transactionCount}</div>
        </div>
        <div className="stat gold">
          <div className="k">ওয়ালেট ব্যালেন্স</div>
          <div className="v">৳{wallet.balance.display}</div>
          <div className="s">{wallet.accountOpened ? 'একাউন্ট খোলা' : 'একাউন্ট খোলা হয়নি'}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2>অ্যাকাউন্টের তথ্য</h2>
        </div>
        <div className="card-body">
          <dl className="kv">
            <dt>নাম</dt>
            <dd>{user.name}</dd>
            <dt>মোবাইল</dt>
            <dd className="mono">{user.phone}</dd>
            <dt>ভূমিকা</dt>
            <dd>
              {user.role === 'admin' ? (
                <span className="chip gold">অ্যাডমিন</span>
              ) : (
                <span className="chip gray">ব্যবহারকারী</span>
              )}
              {user.disabled ? <span className="chip red">বন্ধ</span> : null}
            </dd>
            <dt>অ্যাকাউন্ট আইডি</dt>
            <dd className="mono">{user.id}</dd>
            <dt>যোগদান</dt>
            <dd>{fmtDateTime(user.createdAt)}</dd>
            <dt>সর্বশেষ লগইন</dt>
            <dd>{fmtDateTime(user.lastLoginAt)}</dd>
            <dt>সক্রিয় সেশন</dt>
            <dd>{user.sessionCount}</dd>
            <dt>দোকানের নাম</dt>
            <dd>{profile.name || '—'}</dd>
            <dt>গোল্ড প্ল্যান</dt>
            <dd>
              {profile.goldPlanName} · {profile.goldTrialLabel}
            </dd>
            <dt>SMS</dt>
            <dd>{profile.smsLabel}</dd>
            <dt>অ্যাপ ভার্সন</dt>
            <dd>{profile.appVersion}</dd>
            <dt>মোট এন্ট্রি</dt>
            <dd>
              {counts.customers} কাস্টমার · {counts.transactions} লেনদেন · {counts.cashbox}{' '}
              ক্যাশ এন্ট্রি
            </dd>
            <dt>ব্যবসা</dt>
            <dd>
              <Link href={`/admin/businesses?owner=${user.id}`} className="btn-link">
                {counts.businesses} টি ব্যবসা
              </Link>
            </dd>
          </dl>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>ওয়ালেট সেবা</h2>
        </div>
        <div className="card-body">
          <div className="toolbar">
            {wallet.services.map((s) => (
              <span key={s.key} className={`chip ${s.enabled ? 'green' : 'gray'}`}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>সাম্প্রতিক লেনদেন</h2>
          <span className="grow" />
          <Link href={`/admin/transactions?owner=${user.id}`} className="btn-link">
            সব দেখুন →
          </Link>
        </div>
        {recentTransactions.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ধরন</th>
                  <th>কাস্টমার</th>
                  <th>বিবরণ</th>
                  <th className="num">পরিমাণ</th>
                  <th>তারিখ</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <KindChip kind={t.kind} />
                    </td>
                    <td>
                      <Who name={t.customerName} />
                    </td>
                    <td className="muted">{t.description || '—'}</td>
                    <td className="num">৳{t.amountDisplay}</td>
                    <td className="muted">{fmtDate(t.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty label="এখনো কোনো লেনদেন নেই" />
        )}
      </div>

      {edit ? (
        <Modal
          title="অ্যাকাউন্ট সম্পাদনা"
          onClose={() => setEdit(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEdit(false)}>
                বাতিল
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : null}
                সংরক্ষণ
              </button>
            </>
          }
        >
          {err && <div className="notice error">{err}</div>}
          <div className="field">
            <label>নাম</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>মোবাইল নম্বর</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
