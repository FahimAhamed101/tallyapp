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

export type AuthLevel = 'public' | 'bearer' | 'session' | 'admin';

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
  customers: { total: number; customers: number; suppliers: number };
  transactions: { total: number; byKind: Record<string, { count: number; total: number }> };
  cashbox: { total: number; byKind: Record<string, { count: number; total: number }> };
  photos: { customersWithPhoto: number; entriesWithPhoto: number };
  generatedAt: string;
}

export interface EndpointDef {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  auth: AuthLevel;
  group: 'system' | 'auth' | 'uploads' | 'app' | 'customers' | 'cashbox' | 'admin';
  summary: string;
  alias?: boolean;
  params?: string;
  body?: string;
  returns?: string;
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
