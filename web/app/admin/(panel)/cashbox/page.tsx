'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useCashboxQuery,
  useDeleteCashboxMutation,
  useUpdateCashboxMutation,
} from '@/store/adminApi';
import type { AdminCashboxEntry } from '@/store/api';
import {
  Empty,
  ErrorNote,
  KindChip,
  Loading,
  Modal,
  Pager,
  fmtDate,
  useDebounced,
} from '@/components/ui';

/** Every cash-box movement across all accounts. */

const KINDS = [
  { value: '', label: 'সব ধরন' },
  { value: 'cash_sale', label: 'কাশ বেচা' },
  { value: 'cash_purchase', label: 'কাশ কেনা' },
  { value: 'expense', label: 'খরচ' },
  { value: 'owner_in', label: 'মালিক দিল' },
  { value: 'owner_out', label: 'মালিক নিল' },
];

function CashboxInner() {
  const sp = useSearchParams();
  const owner = sp.get('owner') || '';

  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const { data, isLoading, error, isFetching } = useCashboxQuery({
    q: search,
    kind,
    owner,
    page,
    limit: 50,
  });

  const [updateCashbox] = useUpdateCashboxMutation();
  const [deleteCashbox] = useDeleteCashboxMutation();

  const [edit, setEdit] = useState<AdminCashboxEntry | null>(null);
  const [confirm, setConfirm] = useState<AdminCashboxEntry | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const doDelete = async (e0: AdminCashboxEntry) => {
    setNote(null);
    try {
      await deleteCashbox(e0.id).unwrap();
      setNote('এন্ট্রি মুছে ফেলা হয়েছে');
    } catch (e) {
      setNote((e as { data?: { message?: string } })?.data?.message || 'মোছা যায়নি');
    }
    setConfirm(null);
  };

  // Net cash across the page, so the admin can sanity-check the totals.
  const net = (data?.items || []).reduce(
    (acc, e) => acc + (e.direction === 'in' ? e.amount : -e.amount),
    0,
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ক্যাশবক্স</h1>
          <p>সব অ্যাকাউন্টের ক্যাশ বেচা, খরচ ও মালিকের লেনদেন</p>
        </div>
      </div>

      {note && <div className="notice info">{note}</div>}
      <ErrorNote error={error} />

      {owner ? (
        <div className="notice warn">
          শুধু একটি অ্যাকাউন্টের এন্ট্রি দেখানো হচ্ছে।{' '}
          <Link href="/admin/cashbox" className="btn-link">
            ফিল্টার সরান
          </Link>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <div className="toolbar">
            <input
              className="search"
              placeholder="বিবরণ বা ক্যাটাগরি খুঁজুন…"
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
            {(q || kind || owner) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setQ('');
                  setKind('');
                  setPage(1);
                }}
              >
                ফিল্টার মুছুন
              </button>
            )}
          </div>
          <span className="grow" />
          {isFetching ? <span className="spinner" /> : null}
          {data ? (
            <span className="muted">
              {data.label} · এই পৃষ্ঠার নিট ৳{net.toLocaleString('en-IN')}
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <Loading />
        ) : !data || !data.items.length ? (
          <Empty label="কোনো এন্ট্রি পাওয়া যায়নি" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ধরন</th>
                    <th>মালিক</th>
                    <th>বিবরণ</th>
                    <th>ক্যাটাগরি</th>
                    <th className="num">পরিমাণ</th>
                    <th>তারিখ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <KindChip kind={e.kind} title={e.title} />
                        {e.direction === 'in' ? (
                          <span className="chip green">আয়</span>
                        ) : (
                          <span className="chip red">ব্যয়</span>
                        )}
                      </td>
                      <td>
                        <Link href={`/admin/users/${e.ownerId}`} className="btn-link">
                          {e.ownerName}
                        </Link>
                        <div className="muted mono" style={{ fontSize: 11 }}>
                          {e.ownerPhone}
                        </div>
                      </td>
                      <td className="muted" style={{ maxWidth: 240 }}>
                        {e.description || '—'}
                      </td>
                      <td className="muted">{e.category || '—'}</td>
                      <td className="num">
                        <span className={e.direction === 'in' ? 'pill-pabo' : 'pill-debo'}>
                          {e.direction === 'in' ? '+' : '−'}৳{e.amountDisplay}
                        </span>
                      </td>
                      <td className="muted">{fmtDate(e.date)}</td>
                      <td>
                        <div className="toolbar">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEdit(e)}
                          >
                            সংশোধন
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirm(e)}
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
        <EditCashboxModal
          entry={edit}
          onClose={() => setEdit(null)}
          onDone={(m) => setNote(m)}
          onSave={updateCashbox}
        />
      ) : null}

      {confirm ? (
        <Modal
          title="এন্ট্রি মুছে ফেলবেন?"
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
            <b>{confirm.title}</b> ৳{confirm.amountDisplay} — {confirm.ownerName}
          </p>
          <div className="notice warn" style={{ marginBottom: 0 }}>
            মালিকের ক্যাশবক্স ড্যাশবোর্ড নতুন করে হিসাব করা হবে।
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function EditCashboxModal({
  entry,
  onClose,
  onDone,
  onSave,
}: {
  entry: AdminCashboxEntry;
  onClose: () => void;
  onDone: (msg: string) => void;
  onSave: ReturnType<typeof useUpdateCashboxMutation>[0];
}) {
  const [kind, setKind] = useState(entry.kind);
  const [amount, setAmount] = useState(String(entry.amount));
  const [description, setDescription] = useState(entry.description);
  const [category, setCategory] = useState(entry.category);
  const [date, setDate] = useState(entry.date.slice(0, 10));
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      await onSave({
        id: entry.id,
        patch: { kind, amount, description, category, date: new Date(date).toISOString() },
      }).unwrap();
      onDone('এন্ট্রি সংশোধন করা হয়েছে');
      onClose();
    } catch (e) {
      setErr((e as { data?: { message?: string } })?.data?.message || 'সংরক্ষণ করা যায়নি');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="ক্যাশবক্স এন্ট্রি সংশোধন"
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
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <label>তারিখ</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>ক্যাটাগরি</label>
        <input value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div className="field">
        <label>বিবরণ</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
        মালিক: {entry.ownerName} ({entry.ownerPhone})
      </p>
    </Modal>
  );
}

export default function CashboxPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CashboxInner />
    </Suspense>
  );
}
