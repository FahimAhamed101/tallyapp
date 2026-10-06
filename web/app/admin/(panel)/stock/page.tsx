'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  useDeleteStockMutation,
  useStockQuery,
  useUpdateStockMutation,
} from '@/store/adminApi';
import type { AdminStockItem } from '@/store/api';
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
 * Every stock item (স্টক হিসাব) across all accounts.
 *
 * The quantity column is derived from the movements by the server — the same
 * aggregation the Android app reads — so the panel and the phone cannot disagree
 * about how many are left. A stored field would be a second source of truth.
 */

function StockInner() {
  const sp = useSearchParams();
  const owner = sp.get('owner') || '';

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);

  const { data, isLoading, error, isFetching } = useStockQuery({
    q: search,
    owner,
    page,
    limit: 25,
  });

  const [updateStock] = useUpdateStockMutation();
  const [deleteStock] = useDeleteStockMutation();

  const [edit, setEdit] = useState<AdminStockItem | null>(null);
  const [confirm, setConfirm] = useState<AdminStockItem | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const doDelete = async (item: AdminStockItem) => {
    setNote(null);
    try {
      const res = await deleteStock(item.id).unwrap();
      setNote(
        `${item.name} মুছে ফেলা হয়েছে — ${res.removed.movements} স্টক মুভমেন্ট সরানো হয়েছে`,
      );
    } catch (e) {
      setNote((e as { data?: { message?: string } })?.data?.message || 'মোছা যায়নি');
    }
    setConfirm(null);
  };

  // Counted across the page, not the whole table — the header says so.
  const lowStockOnPage = data?.items.filter((i) => i.lowStock).length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>স্টক হিসাব</h1>
          <p>সব অ্যাকাউন্টের পণ্য — পরিমাণ মুভমেন্ট থেকে হিসাব করা</p>
        </div>
      </div>

      {note && <div className="notice info">{note}</div>}
      <ErrorNote error={error} />

      {owner ? (
        <div className="notice warn">
          শুধু একটি অ্যাকাউন্টের স্টক দেখানো হচ্ছে।{' '}
          <Link href="/admin/stock" className="btn-link">
            ফিল্টার সরান
          </Link>
        </div>
      ) : null}

      {lowStockOnPage > 0 ? (
        <div className="notice warn">
          এই পাতায় {lowStockOnPage}টি পণ্যের স্টক কম।
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <div className="toolbar">
            <input
              className="search"
              placeholder="পণ্যের নাম খুঁজুন…"
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
          <Empty label="কোনো পণ্য পাওয়া যায়নি" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>পণ্য</th>
                    <th>মালিক</th>
                    <th className="num">পরিমাণ</th>
                    <th className="num">ক্রয়</th>
                    <th className="num">বিক্রয়</th>
                    <th className="num">স্টকের মূল্য</th>
                    <th className="num">মুভমেন্ট</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.name}</b>
                        {s.lowStock ? (
                          <>
                            {' '}
                            <span className="chip gold">{s.lowStockLabel || 'স্টক কম'}</span>
                          </>
                        ) : null}
                        {s.note ? (
                          <div className="muted" style={{ fontSize: 11 }}>
                            {s.note}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <Link href={`/admin/users/${s.ownerId}`} className="btn-link">
                          {s.ownerName}
                        </Link>
                        <div className="muted mono" style={{ fontSize: 11 }}>
                          {s.ownerPhone}
                        </div>
                      </td>
                      <td className="num">
                        {s.quantityLabel}
                        {s.lowStockThreshold > 0 ? (
                          <div className="muted" style={{ fontSize: 11 }}>
                            সীমা {s.lowStockThreshold}
                          </div>
                        ) : null}
                      </td>
                      <td className="num">
                        <Balance display={s.purchasePrice.display} tone="zero" />
                      </td>
                      <td className="num">
                        <Balance display={s.salePrice.display} tone="zero" />
                      </td>
                      <td className="num">
                        <Balance display={s.costValue.display} tone="zero" />
                      </td>
                      <td className="num">{s.movementCount}</td>
                      <td>
                        <div className="toolbar">
                          <Link
                            href={`/admin/users/${s.ownerId}`}
                            className="btn btn-ghost btn-sm"
                          >
                            মালিক
                          </Link>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEdit(s)}
                          >
                            সম্পাদনা
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirm(s)}
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
        <EditStockModal item={edit} onClose={() => setEdit(null)} onDone={setNote} />
      ) : null}

      {confirm ? (
        <Modal
          title="পণ্য মুছে ফেলবেন?"
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
            <b>{confirm.name}</b> এবং তার {confirm.movementCount}টি স্টক মুভমেন্ট স্থায়ীভাবে মুছে
            যাবে। মালিক: {confirm.ownerName}
          </p>
          <div className="notice warn" style={{ marginBottom: 0 }}>
            পণ্যের ছবি থাকলে সেটিও Cloudinary থেকে মুছে যাবে। এই কাজটি ফিরিয়ে আনা যাবে না।
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function EditStockModal({
  item,
  onClose,
  onDone,
}: {
  item: AdminStockItem;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [purchasePrice, setPurchasePrice] = useState(String(item.purchasePrice.raw));
  const [salePrice, setSalePrice] = useState(String(item.salePrice.raw));
  const [openingStock, setOpeningStock] = useState(String(item.openingStock));
  const [threshold, setThreshold] = useState(String(item.lowStockThreshold));
  const [note, setNote] = useState(item.note);

  const [updateStock, { isLoading }] = useUpdateStockMutation();
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    try {
      await updateStock({
        id: item.id,
        patch: {
          name,
          unit,
          purchasePrice: Number(purchasePrice) || 0,
          salePrice: Number(salePrice) || 0,
          openingStock: Number(openingStock) || 0,
          lowStockThreshold: Number(threshold) || 0,
          note,
        },
      }).unwrap();
      onDone(`${name} সংরক্ষণ করা হয়েছে`);
      onClose();
    } catch (e) {
      setErr((e as { data?: { message?: string } })?.data?.message || 'সংরক্ষণ করা যায়নি');
    }
  };

  return (
    <Modal
      title="পণ্য সম্পাদনা"
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
        <label>পণ্যের নাম</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>একক</label>
        <input value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <div className="field">
        <label>ক্রয় মূল্য</label>
        <input
          type="number"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
        />
      </div>
      <div className="field">
        <label>বিক্রয় মূল্য</label>
        <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
      </div>
      <div className="field">
        <label>প্রারম্ভিক স্টক</label>
        <input
          type="number"
          value={openingStock}
          onChange={(e) => setOpeningStock(e.target.value)}
        />
      </div>
      <div className="field">
        <label>স্টক কম সীমা</label>
        <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </div>
      <div className="field">
        <label>বিবরণ</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="muted" style={{ fontSize: 12 }}>
        মালিক: {item.ownerName} · এখন স্টকে {item.quantityLabel} ({item.movementCount} মুভমেন্ট)
      </div>
    </Modal>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StockInner />
    </Suspense>
  );
}
