'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** Small shared bits used by every panel screen. */

export function Avatar({
  name,
  color,
  textColor,
  photoUrl,
  size = 30,
}: {
  name: string;
  color?: string;
  textColor?: string;
  photoUrl?: string;
  size?: number;
}) {
  const initials = (() => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const raw = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
    return /^[\x00-\x7F]+$/.test(raw) ? raw.toUpperCase() : raw;
  })();

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="avatar"
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size, flex: `0 0 ${size}px` }}
      />
    );
  }

  return (
    <span
      className="avatar"
      style={{
        background: color || '#D1FAD1',
        color: textColor || '#1A1A1A',
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
      }}
    >
      {initials}
    </span>
  );
}

export function Who({
  name,
  sub,
  color,
  textColor,
  photoUrl,
}: {
  name: string;
  sub?: string;
  color?: string;
  textColor?: string;
  photoUrl?: string;
}) {
  return (
    <div className="who">
      <Avatar name={name} color={color} textColor={textColor} photoUrl={photoUrl} />
      <span className="txt">
        <b>{name}</b>
        {sub ? <span>{sub}</span> : null}
      </span>
    </div>
  );
}

export function Pager({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        পৃষ্ঠা <b>{page}</b> / {pages} · মোট <b>{total}</b>
      </span>
      <span className="grow" />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
      >
        ← আগের
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
      >
        পরের →
      </button>
    </div>
  );
}

/** Debounces a search box so typing does not fire a request per keystroke. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="modal-head">{title}</div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Renders an RTK Query error's Bengali message, if there is one. */
export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = (error as { data?: { message?: string } })?.data?.message;
  return <div className="notice error">{msg || 'কিছু একটা ভুল হয়েছে'}</div>;
}

export function Loading({ label = 'লোড হচ্ছে…' }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" /> {label}
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return <div className="empty">{label}</div>;
}

export function Ok({ children }: { children: ReactNode }) {
  return <div className="notice ok">{children}</div>;
}

/** Bengali-formatted money with the পাবো/দেবো colouring the app uses. */
export function Balance({ display, tone }: { display: string; tone: string }) {
  const cls = tone === 'pabo' ? 'pill-pabo' : tone === 'debo' ? 'pill-debo' : 'pill-zero';
  const suffix = tone === 'pabo' ? ' পাবো' : tone === 'debo' ? ' দেবো' : '';
  return (
    <span className={cls}>
      ৳{display}
      {suffix}
    </span>
  );
}

export const KIND_LABEL: Record<string, string> = {
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

export function KindChip({ kind, title }: { kind: string; title?: string }) {
  const cls =
    kind === 'sale' || kind === 'payment_received' || kind === 'cash_sale' || kind === 'owner_in'
      ? 'green'
      : kind === 'refund'
        ? 'purple'
        : 'red';
  return <span className={`chip ${cls}`}>{title || KIND_LABEL[kind] || kind}</span>;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${fmtDate(iso)} ${hh}:${mm}`;
}
