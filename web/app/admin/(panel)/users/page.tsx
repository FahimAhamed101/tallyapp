'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  useDeleteUserMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from '@/store/adminApi';
import type { AdminUser } from '@/store/api';
import {
  Empty,
  ErrorNote,
  Loading,
  Modal,
  Pager,
  Who,
  fmtDateTime,
  useDebounced,
} from '@/components/ui';

/** All accounts on the platform, with promote / disable / delete. */

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | 'user' | 'admin'>('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const { data, isLoading, error, isFetching } = useUsersQuery({
    q: search,
    role,
    page,
    limit: 25,
  });

  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  const [edit, setEdit] = useState<AdminUser | null>(null);
  const [confirm, setConfirm] = useState<AdminUser | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const toggleDisabled = async (u: AdminUser) => {
    setNote(null);
    try {
      await updateUser({ id: u.id, patch: { disabled: !u.disabled } }).unwrap();
      setNote(`${u.name} — ${!u.disabled ? 'বন্ধ করা হয়েছে' : 'চালু করা হয়েছে'}`);
    } catch (err) {
      setNote((err as { data?: { message?: string } })?.data?.message || 'পরিবর্তন করা যায়নি');
    }
  };

  const toggleRole = async (u: AdminUser) => {
    setNote(null);
    try {
      await updateUser({
        id: u.id,
        patch: { role: u.role === 'admin' ? 'user' : 'admin' },
      }).unwrap();
      setNote(`${u.name} — ভূমিকা পরিবর্তন করা হয়েছে`);
    } catch (err) {
      setNote((err as { data?: { message?: string } })?.data?.message || 'পরিবর্তন করা যায়নি');
    }
  };

  const doDelete = async (u: AdminUser) => {
    setNote(null);
    try {
      const res = await deleteUser(u.id).unwrap();
      setNote(
        `${u.name} মুছে ফেলা হয়েছে — ${res.removed?.customers ?? 0} কাস্টমার, ` +
          `${res.removed?.transactions ?? 0} লেনদেন সরানো হয়েছে`,
      );
      setConfirm(null);
    } catch (err) {
      setNote((err as { data?: { message?: string } })?.data?.message || 'মোছা যায়নি');
      setConfirm(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ব্যবহারকারী</h1>
          <p>প্ল্যাটফর্মের সব অ্যাকাউন্ট — ভূমিকা বদলান, বন্ধ করুন বা মুছে ফেলুন</p>
        </div>
      </div>

      {note && <div className="notice info">{note}</div>}
      <ErrorNote error={error} />

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
              value={role}
              onChange={(e) => {
                setRole(e.target.value as '' | 'user' | 'admin');
                setPage(1);
              }}
            >
              <option value="">সব ভূমিকা</option>
              <option value="user">ব্যবহারকারী</option>
              <option value="admin">অ্যাডমিন</option>
            </select>
          </div>
          <span className="grow" />
          {isFetching ? <span className="spinner" /> : null}
          {data ? <span className="muted">{data.label}</span> : null}
        </div>

        {isLoading ? (
          <Loading />
        ) : !data || !data.items.length ? (
          <Empty label="কোনো অ্যাকাউন্ট পাওয়া যায়নি" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>অ্যাকাউন্ট</th>
                    <th>ভূমিকা</th>
                    <th className="num">কাস্টমার</th>
                    <th className="num">লেনদেন</th>
                    <th className="num">মোট</th>
                    <th className="num">ক্যাশ</th>
                    <th>সর্বশেষ লগইন</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <Link href={`/admin/users/${u.id}`}>
                          <Who name={u.name} sub={u.phone} photoUrl={u.photoUrl} />
                        </Link>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`chip ${u.role === 'admin' ? 'gold' : 'gray'}`}
                          onClick={() => toggleRole(u)}
                          title="ভূমিকা পরিবর্তন করুন"
                          style={{ border: 'none', cursor: 'pointer' }}
                        >
                          {u.role === 'admin' ? 'অ্যাডমিন' : 'ব্যবহারকারী'}
                        </button>
                        {u.disabled ? <span className="chip red">বন্ধ</span> : null}
                      </td>
                      <td className="num">{u.customerCount}</td>
                      <td className="num">{u.transactionCount}</td>
                      <td className="num">৳{u.transactionTotalDisplay}</td>
                      <td className="num">{u.cashboxCount}</td>
                      <td className="muted">{fmtDateTime(u.lastLoginAt)}</td>
                      <td>
                        <div className="toolbar">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEdit(u)}
                          >
                            সম্পাদনা
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => toggleDisabled(u)}
                          >
                            {u.disabled ? 'চালু' : 'বন্ধ'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirm(u)}
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

      {edit ? <EditUserModal user={edit} onClose={() => setEdit(null)} onDone={setNote} /> : null}

      {confirm ? (
        <Modal
          title="অ্যাকাউন্ট মুছে ফেলবেন?"
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
            <b>{confirm.name}</b> ({confirm.phone}) এবং তার সব কাস্টমার, লেনদেন ও ক্যাশবক্স এন্ট্রি
            স্থায়ীভাবে মুছে যাবে।
          </p>
          <div className="notice warn" style={{ marginBottom: 0 }}>
            এই কাজটি ফিরিয়ে আনা যাবে না। {confirm.customerCount} কাস্টমার ও{' '}
            {confirm.transactionCount} লেনদেন মুছে যাবে।
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function EditUserModal({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [updateUser, { isLoading }] = useUpdateUserMutation();
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    try {
      await updateUser({ id: user.id, patch: { name, phone } }).unwrap();
      onDone(`${name} সংরক্ষণ করা হয়েছে`);
      onClose();
    } catch (e) {
      setErr((e as { data?: { message?: string } })?.data?.message || 'সংরক্ষণ করা যায়নি');
    }
  };

  return (
    <Modal
      title="অ্যাকাউন্ট সম্পাদনা"
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
    </Modal>
  );
}
