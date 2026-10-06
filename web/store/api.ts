import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * The single RTK Query API slice for the admin panel.
 *
 * Endpoints are injected per feature (`adminApi`, `authApi`, `endpointsApi`)
 * so each file owns one concern while sharing the cache and the tag graph —
 * a PATCH on a user invalidates `User` and `Stats` in one place, and every
 * screen watching those tags refetches automatically.
 *
 * `credentials: 'include'` matters: the panel authenticates with the httpOnly
 * `tally_session` cookie, not a bearer token.
 */

import type { EndpointDef } from '@/lib/endpoints';

// Re-exported from the catalogue rather than re-declared: these two types used
// to be duplicated here, and the copies silently drifted the moment a new route
// group was added. The catalogue in `lib/endpoints.ts` is the only definition.
export type { AuthLevel, EndpointDef } from '@/lib/endpoints';

export interface OwnerInfo {
  id: string;
  name: string;
  phone: string;
  role: string;
  disabled: boolean;
}

export interface Money {
  raw: number;
  display: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  label?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  photoUrl: string;
  role: 'user' | 'admin';
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;
  customerCount: number;
  transactionCount: number;
  transactionTotal: number;
  transactionTotalDisplay: string;
  cashboxCount: number;
}

export interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  type: 'customer' | 'supplier';
  note: string;
  initials: string;
  avatarColor: string;
  avatarTextColor: string;
  photoUrl: string;
  subtitle: string;
  lastActivityAt: string;
  amountRaw: number;
  amountDisplay: string;
  amountTone: 'pabo' | 'debo' | 'zero';
  receivable: number;
  payable: number;
  net: number;
  transactionCount: number;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  hasPhoto: boolean;
  createdAt: string;
}

export interface AdminTransaction {
  id: string;
  kind: string;
  title: string;
  tone: string;
  amount: number;
  amountDisplay: string;
  description: string;
  hasPhoto: boolean;
  date: string;
  dateDisplay: string;
  relative: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  customerId: string;
  customerName: string;
  customerType: string;
}

export interface AdminCashboxEntry {
  id: string;
  kind: string;
  title: string;
  direction: 'in' | 'out';
  amount: number;
  amountDisplay: string;
  description: string;
  category: string;
  hasPhoto: boolean;
  date: string;
  dateDisplay: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
}

export interface PlatformStats {
  users: { total: number; admins: number; disabled: number; newLast7Days: number };
  businesses: { total: number; primaries: number; multiBookAccounts: number };
  customers: { total: number; customers: number; suppliers: number };
  transactions: { total: number; byKind: Record<string, { count: number; total: number }> };
  cashbox: { total: number; byKind: Record<string, { count: number; total: number }> };
  photos: { customersWithPhoto: number; entriesWithPhoto: number };
  generatedAt: string;
}

/** One book (ব্যবসা), as the panel's cross-account list renders it. */
export interface AdminBusiness {
  id: string;
  name: string;
  isPrimary: boolean;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  customerCount: number;
  supplierCount: number;
  customerLabel: string;
  transactionCount: number;
  receivable: { raw: number; display: string };
  createdAt: string;
}

/** One stock item (স্টক হিসাব), as the panel's cross-account list renders it. */
export interface AdminStockItem {
  id: string;
  name: string;
  unit: string;
  businessId: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  purchasePrice: { raw: number; display: string };
  salePrice: { raw: number; display: string };
  openingStock: number;
  lowStockThreshold: number;
  /** Derived from the movements, never stored — the same figure the app shows. */
  quantity: number;
  quantityLabel: string;
  costValue: { raw: number; display: string };
  movementCount: number;
  lowStock: boolean;
  lowStockLabel: string;
  note: string;
  createdAt: string;
}

export interface EndpointsResponse {
  count: number;
  groups: { key: string; label: string; count: number }[];
  endpoints: EndpointDef[];
}

export interface AdminSession {
  id: string;
  name: string;
  phone: string;
  photoUrl?: string;
  role: string;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    credentials: 'include',
  }),
  tagTypes: [
    'Session',
    'Stats',
    'User',
    'Business',
    'Stock',
    'Customer',
    'Transaction',
    'Cashbox',
    'Endpoint',
  ],
  // The panel is a live admin tool; a short window avoids stale totals without
  // hammering the database on every tab switch.
  keepUnusedDataFor: 30,
  refetchOnMountOrArgChange: false,
  endpoints: () => ({}),
});

export default api;
