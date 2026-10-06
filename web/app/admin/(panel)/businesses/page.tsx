'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useBusinessesQuery,
  useDeleteBusinessMutation,
  useUpdateBusinessMutation,
} from '@/store/adminApi';
import type { AdminBusiness } from '@/store/api';
import {
  Balance,
  Empty,
  ErrorNote,
  Loading,
  Modal,
  Pager,
  useDebounced,
} from '@/components/ui';

/**
 * Every book (ব্যবসা) across all accounts.
 *
 * This is the screen that makes মাল্টি ব্যবসা visible to an operator: without
 * it the panel could see a shopkeeper's combined totals but not that they were
 * spread over four books, nor which one was primary.
 */

function BusinessesInner() {
  const sp = useSearchParams();
  const owner = sp.get('owner') || '';

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const { data, isLoading, error, isFetching } = useBusinessesQuery({
    q: search,
    owner,
    page,
    limit: 25,
  });

  const [updateBusiness] = useUpdateBusinessMutation();
  const [deleteBusiness] = useDeleteBusinessMutation();

  const [edit, setEdit] = useState<AdminBusiness | null>(null);
  const [confirm, setConfirm] = useState<AdminBusiness | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const promote = async (b: AdminBusiness) => {
    setNote(null);
    try {
      await updateBusiness({ id: b.id, patch: { isPrimary: true } }).unwrap();
      setNote(`${b.name} — এখন প্রাইমারি ব্যবসা`);
    } catch (e) {
      setNote((e as { data?: { message?: string } })?.data?.message || 'পরিবর্তন করা যায়নি');
    }
  };

  const doDelete = async (b: AdminBusiness) => {
    setNote(null);
    try {
      const res = await deleteBusiness(b.id).unwrap();
      const r = res.removed;
      setNote(
        `${b.name} মুছে ফেলা হয়েছে — ${r.customers} কাস্টমার, ${r.transactions} লেনদেন, ` +
          `${r.cashboxEntries} ক্যাশ এন্ট্রি সরানো হয়েছে`,
      );
    } catch (e) {
      setNote((e as { data?: { message?: string } })?.data?.message || 'মোছা যায়নি');
    }
    setConfirm(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ব্যবসা সমূহ</h1>
          <p>সব অ্যাকাউন্টের ব্যবসা — কোনটির কত কাস্টমার ও কত পাওনা</p>
        </div>
      </div>

      {note && <div className="notice info">{note}</div>}
      <ErrorNote error={error} />

      {owner ? (
        <div className="notice warn">
          শুধু একটি অ্যাকাউন্টের ব্যবসা দেখানো হচ্ছে।{' '}
          <Link href="/admin/businesses" className="btn-link">
            ফিল্টার সরান
          </Link>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <div className="toolbar">
            <input
              className="search"
              placeholder="ব্যবসার নাম খুঁজুন…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <span className="grow" />
          {isFetching ? <span className="spinner" /> : null}
          {data ? <span className="muted">মোট {data.total}</span> : null}
        </div>

        {isLoading ? (
          <Loading />
        ) : !data || !data.items.length ? (
          <Empty label="কোনো ব্যবসা পাওয়া যায়নি" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ব্যবসা</th>
                    <th>মালিক</th>
                    <th className="num">কাস্টমার</th>
                    <th className="num">সাপ্লায়ার</th>
                    <th className="num">মোট পাওয়া</th>
                    <th className="num">লেনদেন</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <b>{b.name}</b>
                        {b.isPrimary ? (
                          <>
                            {' '}
                            <span className="chip gold">প্রাইমারি</span>
                          </>
                        ) : null}
                      </td>
                      <td>
                        <Link href={`/admin/users/${b.ownerId}`} className="btn-link">
                          {b.ownerName}
                        </Link>
                        <div className="muted mono" style={{ fontSize: 11 }}>
                          {b.ownerPhone}
                        </div>
                      </td>
                      <td className="num">{b.customerCount}</td>
                      <td className="num">{b.supplierCount}</td>
                      <td className="num">
                        <Balance
                          display={b.receivable.display}
                          tone={b.receivable.raw > 0 ? 'pabo' : 'zero'}
                        />
                      </td>
                      <td className="num">{b.transactionCount}</td>
                      <td>
                        <div className="toolbar">
                          <Link
                            href={`/admin/customers?owner=${b.ownerId}`}
                            className="btn btn-ghost btn-sm"
                          >
                            কাস্টমার
                          </Link>
                          {!b.isPrimary ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => promote(b)}
                              title="এই ব্যবসাটিকে প্রাইমারি করুন"
                            >
                              প্রাইমারি করুন
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEdit(b)}
                          >
                            সম্পাদনা
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirm(b)}
                          >
                            মুছুন
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          </>
        )}
      </div>

      {edit ? (
        <EditBusinessModal business={edit} onClose={() => setEdit(null)} onDone={setNote} />
      ) : null}

      {confirm ? (
        <Modal
          title="ব্যবসা মুছে ফেলবেন?"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
                বাতিল
              </button>
              <button className="btn btn-primary" onClick={() => doDelete(confirm)}>
                হ্যাঁ, মুছে ফেলুন
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            <b>{confirm.name}</b> এবং তার ভিতরের সব কিছু — {confirm.customerCount} কাস্টমার,{' '}
            {confirm.transactionCount} লেনদেন — স্থায়ীভাবে মুছে যাবে। মালিক:{' '}
            {confirm.ownerName}
          </p>
          <div className="notice warn" style={{ marginBottom: 0 }}>
            কাস্টমারদের ছবিগুলোও Cloudinary থেকে মুছে যাবে। এই কাজটি ফিরিয়ে আনা যাবে না।
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function EditBusinessModal({
  business,
  onClose,
  onDone,
}: {
  business: AdminBusiness;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState(business.name);
  const [updateBusiness, { isLoading }] = useUpdateBusinessMutation();
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    try {
      await updateBusiness({ id: business.id, patch: { name } }).unwrap();
      onDone(`${name} সংরক্ষণ করা হয়েছে`);
      onClose();
    } catch (e) {
      setErr((e as { data?: { message?: string } })?.data?.message || 'সংরক্ষণ করা যায়নি');
    }
  };

  return (
    <Modal
      title="ব্যবসা সম্পাদনা"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            বাতিল
          </button>
          <button className="btn btn-primary" onClick={save} disabled={isLoading}>
            {isLoading ? <span className="spinner" /> : null}
            সংরক্ষণ
          </button>
        </>
      }
    >
      {err && <div className="notice error">{err}</div>}
      <div className="field">
        <label>ব্যবসার নাম</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        মালিক: {business.ownerName} · {business.customerLabel}
      </div>
    </Modal>
  );
}

export default function BusinessesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BusinessesInner />
    </Suspense>
  );
}
