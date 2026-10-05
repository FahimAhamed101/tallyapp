'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useDeleteTransactionMutation,
  useTransactionsQuery,
  useUpdateTransactionMutation,
} from '@/store/adminApi';
import type { AdminTransaction } from '@/store/api';
import {
  Empty,
  ErrorNote,
  KindChip,
  Loading,
  Modal,
  Pager,
  Who,
  fmtDate,
  useDebounced,
} from '@/components/ui';

/** The full cross-account ledger, with inline correction of mis-keyed rows. */

const KINDS = [
  { value: '', label: 'সব ধরন' },
  { value: 'sale', label: 'বেচা' },
  { value: 'purchase', label: 'কেনা' },
  { value: 'payment_received', label: 'পেলাম' },
  { value: 'payment_made', label: 'দিলাম' },
  { value: 'refund', label: 'ফেরত' },
];

function TransactionsInner() {
  const sp = useSearchParams();
  const owner = sp.get('owner') || '';

  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const { data, isLoading, error, isFetching } = useTransactionsQuery({
    q: search,
    kind,
    owner,
    from,
    to,
    page,
    limit: 50,
  });

  const [updateTransaction] = useUpdateTransactionMutation();
  const [deleteTransaction] = useDeleteTransactionMutation();

  const [edit, setEdit] = useState<AdminTransaction | null>(null);
  const [confirm, setConfirm] = useState<AdminTransaction | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const doDelete = async (t: AdminTransaction) => {
    setNote(null);
    try {
      await deleteTransaction(t.id).unwrap();
      setNote('লেনদেন মুছে ফেলা হয়েছে এবং ব্যালেন্স নতুন করে হিসাব করা হয়েছে');
    } catch (e) {
      setNote((e as { data?: { message?: string } })?.data?.message || 'মোছা যায়নি');
    }
    setConfirm(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>লেনদেন</h1>
          <p>সব অ্যাকাউন্টের বেচা-কেনা ও লেনদেনের পূর্ণ তালিকা</p>
        </div>
      </div>

      {note && <div className="notice info">{note}</div>}
      <ErrorNote error={error} />

      {owner ? (
        <div className="notice warn">
          শুধু একটি অ্যাকাউন্টের লেনদেন দেখানো হচ্ছে।{' '}
          <Link href="/admin/transactions" className="btn-link">
            ফিল্টার সরান
          </Link>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <div className="toolbar">
            <input
              className="search"
              placeholder="বিবরণ খুঁজুন…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
              }}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              title="শুরুর তারিখ"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              title="শেষ তারিখ"
            />
            {(from || to || kind || q || owner) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setQ('');
                  setKind('');
                  setFrom('');
                  setTo('');
                  setPage(1);
                }}
              >
                ফিল্টার মুছুন
              </button>
            )}
          </div>
          <span className="grow" />
          {isFetching ? <span className="spinner" /> : null}
          {data ? <span className="muted">{data.label}</span> : null}
        </div>

        {isLoading ? (
          <Loading />
        ) : !data || !data.items.length ? (
          <Empty label="কোনো লেনদেন পাওয়া যায়নি" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ধরন</th>
                    <th>কাস্টমার</th>
                    <th>মালিক</th>
                    <th>বিবরণ</th>
                    <th className="num">পরিমাণ</th>
                    <th>তারিখ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <KindChip kind={t.kind} title={t.title} />
                      </td>
                      <td>
                        <Who name={t.customerName} sub={t.customerType === 'supplier' ? 'সাপ্লায়ার' : 'কাস্টমার'} />
                      </td>
                      <td>
                        <Link href={`/admin/users/${t.ownerId}`} className="btn-link">
                          {t.ownerName}
                        </Link>
                      </td>
                      <td className="muted" style={{ maxWidth: 240 }}>
                        {t.description || '—'}
                        {t.hasPhoto ? <span className="chip gray">ছবি</span> : null}
                      </td>
                      <td className="num">৳{t.amountDisplay}</td>
                      <td className="muted" title={t.relative}>
                        {fmtDate(t.date)}
                      </td>
                      <td>
                        <div className="toolbar">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEdit(t)}
                          >
                            সংশোধন
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirm(t)}
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
        <EditTransactionModal
          tx={edit}
          onClose={() => setEdit(null)}
          onDone={(m) => setNote(m)}
          onSave={updateTransaction}
        />
      ) : null}

      {confirm ? (
        <Modal
          title="লেনদেন মুছে ফেলবেন?"
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
            <b>{confirm.title}</b> ৳{confirm.amountDisplay} — {confirm.customerName} ({confirm.ownerName})
          </p>
          <div className="notice warn" style={{ marginBottom: 0 }}>
            মুছে ফেললে কাস্টমারের বাকি আবার হিসাব করা হবে।
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function EditTransactionModal({
  tx,
  onClose,
  onDone,
  onSave,
}: {
  tx: AdminTransaction;
  onClose: () => void;
  onDone: (msg: string) => void;
  onSave: ReturnType<typeof useUpdateTransactionMutation>[0];
}) {
  const [kind, setKind] = useState(tx.kind);
  const [amount, setAmount] = useState(String(tx.amount));
  const [description, setDescription] = useState(tx.description);
  const [date, setDate] = useState(tx.date.slice(0, 10));
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      await onSave({
        id: tx.id,
        patch: { kind, amount, description, date: new Date(date).toISOString() },
      }).unwrap();
      onDone('লেনদেন সংশোধন করা হয়েছে');
      onClose();
    } catch (e) {
      setErr((e as { data?: { message?: string } })?.data?.message || 'সংরক্ষণ করা যায়নি');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="লেনদেন সংশোধন"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
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
        <label>ধরন</label>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.filter((k) => k.value).map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>পরিমাণ</label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="field">
        <label>তারিখ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>বিবরণ</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
        কাস্টমার: {tx.customerName} · মালিক: {tx.ownerName}
      </p>
    </Modal>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TransactionsInner />
    </Suspense>
  );
}
