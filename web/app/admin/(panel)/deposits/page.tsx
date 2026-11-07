'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  useDepositsQuery,
  useReviewDepositMutation,
} from '@/store/adminApi';
import type { AdminDeposit } from '@/store/api';
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

/**
 * The manual deposit queue for সুদমুক্ত সঞ্চয়.
 *
 * A user sends money to the receiving number outside the app and submits the
 * amount, their sender number and the transaction id. This screen is where that
 * claim is matched against the statement and approved — and approving is the
 * only thing that credits a wallet balance.
 */

export default function DepositsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | 'pending' | 'approved' | 'rejected'>('pending');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const { data, isLoading, error, isFetching } = useDepositsQuery({
    q: search,
    status,
    page,
    limit: 25,
  });

  const [reviewDeposit] = useReviewDepositMutation();
  const [approve, setApprove] = useState<AdminDeposit | null>(null);
  const [reject, setReject] = useState<AdminDeposit | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const doReview = async (
    d: AdminDeposit,
    action: 'approve' | 'reject',
    extra: { note?: string; amount?: number } = {},
  ) => {
    setNote(null);
    try {
      const res = await reviewDeposit({ id: d.id, action, ...extra }).unwrap();
      setNote(
        action === 'approve'
          ? `${d.userName} — ৳${d.amountDisplay} যোগ করা হয়েছে`
          : `${d.userName} — রিকোয়েস্ট বাতিল করা হয়েছে`,
      );
      void res;
      setApprove(null);
      setReject(null);
    } catch (err) {
      setNote((err as { data?: { message?: string } })?.data?.message || 'সম্পন্ন করা যায়নি');
      setApprove(null);
      setReject(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ডিপোজিট</h1>
          <p>সুদমুক্ত সঞ্চয় — ব্যবহারকারীর পাঠানো টাকার রিকোয়েস্ট যাচাই করে ব্যালেন্স যোগ করুন</p>
        </div>
      </div>

      {note && <div className="notice info">{note}</div>}
      <ErrorNote error={error} />

      <div className="card">
        <div className="card-head">
          <div className="toolbar">
            <input
              className="search"
              placeholder="নাম, নম্বর বা ট্রানজেকশন আইডি..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as '' | 'pending' | 'approved' | 'rejected');
                setPage(1);
              }}
            >
              <option value="pending">অপেক্ষমাণ</option>
              <option value="approved">যোগ হয়েছে</option>
              <option value="rejected">বাতিল</option>
              <option value="">সব</option>
            </select>
          </div>
          <span className="grow" />
          {isFetching ? <span className="spinner" /> : null}
          {data ? <span className="muted">{data.label}</span> : null}
        </div>

        {isLoading ? (
          <Loading />
        ) : !data || !data.items.length ? (
          <Empty
            label={
              status === 'pending'
                ? 'অপেক্ষমাণ কোনো রিকোয়েস্ট নেই'
                : 'কোনো রিকোয়েস্ট পাওয়া যায়নি'
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ব্যবহারকারী</th>
                    <th className="num">টাকা</th>
                    <th>পাঠানোর নম্বর</th>
                    <th>ট্রানজেকশন আইডি</th>
                    <th>জমা</th>
                    <th>অবস্থা</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.userId ? (
                          <Link href={`/admin/users/${d.userId}`}>
                            <Who name={d.userName} sub={d.userPhone} />
                          </Link>
                        ) : (
                          <Who name={d.userName} sub={d.userPhone} />
                        )}
                      </td>
                      <td className="num">
                        <b>৳{d.amountDisplay}</b>
                      </td>
                      <td className="muted">{d.senderNumberDisplay}</td>
                      <td>
                        <code>{d.trxId}</code>
                      </td>
                      <td className="muted">{fmtDateTime(d.createdAt)}</td>
                      <td>
                        <span
                          className={`chip ${
                            d.status === 'approved'
                              ? 'green'
                              : d.status === 'rejected'
                                ? 'red'
                                : 'gray'
                          }`}
                        >
                          {d.statusLabel}
                        </span>
                        {d.reviewedByName ? (
                          <div className="muted" style={{ fontSize: 11 }}>
                            {d.reviewedByName}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {d.status === 'pending' ? (
                          <div className="toolbar">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => setApprove(d)}
                            >
                              যোগ করুন
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => setReject(d)}
                            >
                              বাতিল
                            </button>
                          </div>
                        ) : (
                          <span className="muted">{d.reviewedAt ? fmtDateTime(d.reviewedAt) : ''}</span>
                        )}
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

      {approve ? (
        <ApproveModal
          deposit={approve}
          onClose={() => setApprove(null)}
          onDone={(amount) => doReview(approve, 'approve', { amount })}
        />
      ) : null}

      {reject ? (
        <RejectModal
          deposit={reject}
          onClose={() => setReject(null)}
          onDone={(reason) => doReview(reject, 'reject', { note: reason })}
        />
      ) : null}
    </>
  );
}

/**
 * Approving is the irreversible half — it moves money — so it asks for the
 * amount one more time with the claim's figures in view, which is where a
 * transposed digit gets caught.
 */
function ApproveModal({
  deposit,
  onClose,
  onDone,
}: {
  deposit: AdminDeposit;
  onClose: () => void;
  onDone: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(String(deposit.amount));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    await onDone(Number(amount));
    setBusy(false);
  };

  const changed = Number(amount) !== deposit.amount;

  return (
    <Modal
      title="ব্যালেন্স যোগ করবেন?"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            বাতিল
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            হ্যাঁ, যোগ করুন
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>
        <b>{deposit.userName}</b> ({deposit.userPhone}) — পাঠানোর নম্বর{' '}
        <b>{deposit.senderNumberDisplay}</b>, ট্রানজেকশন আইডি <code>{deposit.trxId}</code>।
      </p>
      <div className="field">
        <label>যোগ করার পরিমাণ</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </div>
      {changed ? (
        <div className="notice warn">
          ব্যবহারকারী ৳{deposit.amountDisplay} লিখেছেন, আপনি ৳{amount} যোগ করছেন।
        </div>
      ) : null}
      <div className="notice info" style={{ marginBottom: 0 }}>
        যোগ করলে এই রিকোয়েস্টটি নিষ্পত্তি হয়ে যাবে। একই রিকোয়েস্ট আবার যোগ করা যাবে না।
      </div>
    </Modal>
  );
}

function RejectModal({
  deposit,
  onClose,
  onDone,
}: {
  deposit: AdminDeposit;
  onClose: () => void;
  onDone: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    await onDone(reason);
    setBusy(false);
  };

  return (
    <Modal
      title="রিকোয়েস্ট বাতিল করবেন?"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            বাতিল
          </button>
          <button className="btn btn-danger" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            হ্যাঁ, বাতিল করুন
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>
        <b>{deposit.userName}</b> — ৳{deposit.amountDisplay} ({deposit.trxId}) বাতিল হবে। কোনো
        ব্যালেন্স যোগ হবে না।
      </p>
      <div className="field">
        <label>কারণ (ব্যবহারকারী দেখতে পাবেন)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="যেমন: ট্রানজেকশন আইডি মেলেনি"
        />
      </div>
    </Modal>
  );
}