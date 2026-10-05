'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from '@/store/adminApi';
import type { AdminCustomer } from '@/store/api';
import {
  Avatar,
  Balance,
  Empty,
  ErrorNote,
  Loading,
  Modal,
  Pager,
  useDebounced,
} from '@/components/ui';

/** Every customer/supplier across all accounts. */

function CustomersInner() {
  const sp = useSearchParams();
  const owner = sp.get('owner') || '';

  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | 'customer' | 'supplier'>('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const { data, isLoading, error, isFetching } = useCustomersQuery({
    q: search,
    type,
    owner,
    page,
    limit: 25,
  });

  const [updateCustomer] = useUpdateCustomerMutation();
  const [deleteCustomer] = useDeleteCustomerMutation();

  const [edit, setEdit] = useState<AdminCustomer | null>(null);
  const [confirm, setConfirm] = useState<AdminCustomer | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const doDelete = async (c: AdminCustomer) => {
    setNote(null);
    try {
      const res = await deleteCustomer(c.id).unwrap();
      setNote(`${c.name} মুছে ফেলা হয়েছে — ${res.removedTransactions} টি লেনদেনও সরানো হয়েছে`);
    } catch (e) {
      setNote((e as { data?: { message?: string } })?.data?.message || 'মোছা যায়নি');
    }
    setConfirm(null);
  };

  const toggleType = async (c: AdminCustomer) => {
    setNote(null);
    try {
      await updateCustomer({
        id: c.id,
        patch: { type: c.type === 'supplier' ? 'customer' : 'supplier' },
      }).unwrap();
      setNote(`${c.name} — ধরন পরিবর্তন করা হয়েছে`);
    } catch (e) {
      setNote((e as { data?: { message?: string } })?.data?.message || 'পরিবর্তন করা যায়নি');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>কাস্টমার ও সাপ্লায়ার</h1>
          <p>সব অ্যাকাউন্টের কাস্টমার, সাপ্লায়ার ও তাদের বাকি</p>
        </div>
      </div>

      {note && <div className="notice info">{note}</div>}
      <ErrorNote error={error} />

      {owner ? (
        <div className="notice warn">
          শুধু একটি অ্যাকাউন্টের কাস্টমার দেখানো হচ্ছে।{' '}
          <Link href="/admin/customers" className="btn-link">
            ফিল্টার সরান
          </Link>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <div className="toolbar">
            <input
              className="search"
              placeholder="নাম বা নম্বর খুঁজুন…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as '' | 'customer' | 'supplier');
                setPage(1);
              }}
            >
              <option value="">সব ধরন</option>
              <option value="customer">কাস্টমার</option>
              <option value="supplier">সাপ্লায়ার</option>
            </select>
          </div>
          <span className="grow" />
          {isFetching ? <span className="spinner" /> : null}
          {data ? <span className="muted">মোট {data.total}</span> : null}
        </div>

        {isLoading ? (
          <Loading />
        ) : !data || !data.items.length ? (
          <Empty label="কোনো কাস্টমার পাওয়া যায়নি" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>নাম</th>
                    <th>মালিক</th>
                    <th>ধরন</th>
                    <th>বিবরণ</th>
                    <th className="num">বাকি</th>
                    <th className="num">লেনদেন</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="who">
                          <Avatar
                            name={c.name}
                            color={c.avatarColor}
                            textColor={c.avatarTextColor}
                            photoUrl={c.photoUrl}
                          />
                          <span className="txt">
                            <b>{c.name}</b>
                            <span>{c.phone || c.subtitle}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <Link href={`/admin/users/${c.ownerId}`} className="btn-link">
                          {c.ownerName}
                        </Link>
                        <div className="muted mono" style={{ fontSize: 11 }}>
                          {c.ownerPhone}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`chip ${c.type === 'supplier' ? 'purple' : 'blue'}`}
                          onClick={() => toggleType(c)}
                          style={{ border: 'none', cursor: 'pointer' }}
                          title="ধরন পরিবর্তন করুন"
                        >
                          {c.type === 'supplier' ? 'সাপ্লায়ার' : 'কাস্টমার'}
                        </button>
                      </td>
                      <td className="muted" style={{ maxWidth: 220 }}>
                        {c.note || '—'}
                      </td>
                      <td className="num">
                        <Balance display={c.amountDisplay} tone={c.amountTone} />
                      </td>
                      <td className="num">{c.transactionCount}</td>
                      <td>
                        <div className="toolbar">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEdit(c)}
                          >
                            সম্পাদনা
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirm(c)}
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
        <EditCustomerModal
          customer={edit}
          onClose={() => setEdit(null)}
          onDone={(m) => setNote(m)}
        />
      ) : null}

      {confirm ? (
        <Modal
          title="কাস্টমার মুছে ফেলবেন?"
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
            <b>{confirm.name}</b> এবং তার {confirm.transactionCount} টি লেনদেন স্থায়ীভাবে মুছে
            যাবে। মালিক: {confirm.ownerName}
          </p>
          <div className="notice warn" style={{ marginBottom: 0 }}>
            এই কাজটি ফিরিয়ে আনা যাবে না।
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function EditCustomerModal({
  customer,
  onClose,
  onDone,
}: {
  customer: AdminCustomer;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [note, setNote] = useState(customer.note);
  const [type, setType] = useState(customer.type);
  const [updateCustomer, { isLoading }] = useUpdateCustomerMutation();
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    try {
      await updateCustomer({ id: customer.id, patch: { name, phone, note, type } }).unwrap();
      onDone(`${name} সংরক্ষণ করা হয়েছে`);
      onClose();
    } catch (e) {
      setErr((e as { data?: { message?: string } })?.data?.message || 'সংরক্ষণ করা যায়নি');
    }
  };

  return (
    <Modal
      title="কাস্টমার সম্পাদনা"
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
        <label>নাম</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>মোবাইল নম্বর</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="field">
        <label>ধরন</label>
        <select value={type} onChange={(e) => setType(e.target.value as 'customer' | 'supplier')}>
          <option value="customer">কাস্টমার</option>
          <option value="supplier">সাপ্লায়ার</option>
        </select>
      </div>
      <div className="field">
        <label>বিবরণ</label>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CustomersInner />
    </Suspense>
  );
}
