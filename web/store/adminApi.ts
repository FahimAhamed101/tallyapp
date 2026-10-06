import {
  api,
  type AdminBusiness,
  type AdminCashboxEntry,
  type AdminCustomer,
  type AdminStockItem,
  type AdminTransaction,
  type AdminUser,
  type Paginated,
  type PlatformStats,
} from './api';

/** Cross-account CRUD for the panel. Every endpoint here is admin-only. */

export interface UserListArgs {
  q?: string;
  role?: 'user' | 'admin' | '';
  page?: number;
  limit?: number;
}

export interface BusinessListArgs {
  q?: string;
  owner?: string;
  page?: number;
  limit?: number;
}

export interface CustomerListArgs {
  q?: string;
  type?: 'customer' | 'supplier' | '';
  owner?: string;
  page?: number;
  limit?: number;
}

export interface TransactionListArgs {
  q?: string;
  kind?: string;
  owner?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface CashboxListArgs {
  q?: string;
  kind?: string;
  owner?: string;
  page?: number;
  limit?: number;
}

export interface StockListArgs {
  q?: string;
  owner?: string;
  page?: number;
  limit?: number;
}

/** Drops empty values so the query string stays clean. */
const qs = (args: Record<string, unknown>): string => {
  const sp = new URLSearchParams();
  Object.entries(args).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 0) sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    stats: build.query<PlatformStats, void>({
      query: () => '/admin/stats',
      providesTags: ['Stats'],
    }),

    // ---- users ----------------------------------------------------------
    users: build.query<Paginated<AdminUser>, UserListArgs | void>({
      query: (args) => `/admin/users${qs((args || {}) as Record<string, unknown>)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((u) => ({ type: 'User' as const, id: u.id })),
              { type: 'User' as const, id: 'LIST' },
            ]
          : [{ type: 'User' as const, id: 'LIST' }],
    }),

    user: build.query<AdminUserDetail, string>({
      query: (id) => `/admin/users/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'User', id }],
    }),

    updateUser: build.mutation<
      { ok: boolean; user: AdminUser },
      { id: string; patch: Partial<Pick<AdminUser, 'name' | 'phone' | 'role' | 'disabled' | 'photoUrl'>> }
    >({
      query: ({ id, patch }) => ({ url: `/admin/users/${id}`, method: 'PATCH', body: patch }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
        'Stats',
      ],
    }),

    deleteUser: build.mutation<
      {
        ok: boolean;
        deletedId: string;
        removed: { customers: number; transactions: number; cashbox: number };
      },
      string
    >({
      query: (id) => ({ url: `/admin/users/${id}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'User', id: 'LIST' },
        { type: 'Customer', id: 'LIST' },
        { type: 'Transaction', id: 'LIST' },
        { type: 'Cashbox', id: 'LIST' },
        'Stats',
      ],
    }),

    // ---- businesses (মাল্টি ব্যবসা) --------------------------------------
    businesses: build.query<Paginated<AdminBusiness>, BusinessListArgs | void>({
      query: (args) => `/admin/businesses${qs((args || {}) as Record<string, unknown>)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((b) => ({ type: 'Business' as const, id: b.id })),
              { type: 'Business' as const, id: 'LIST' },
            ]
          : [{ type: 'Business' as const, id: 'LIST' }],
    }),

    updateBusiness: build.mutation<
      { ok: boolean; business: AdminBusiness },
      { id: string; patch: { name?: string; isPrimary?: boolean } }
    >({
      query: ({ id, patch }) => ({ url: `/admin/businesses/${id}`, method: 'PATCH', body: patch }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Business', id },
        { type: 'Business', id: 'LIST' },
        // Promoting one book demotes another, so the whole list is stale.
        'Stats',
      ],
    }),

    deleteBusiness: build.mutation<
      {
        ok: boolean;
        deletedId: string;
        removed: { customers: number; transactions: number; cashboxEntries: number };
      },
      string
    >({
      query: (id) => ({ url: `/admin/businesses/${id}`, method: 'DELETE' }),
      // Deleting a book takes its customers, ledger and cash box with it, so
      // every one of those lists is stale afterwards — not just this one.
      invalidatesTags: [
        { type: 'Business', id: 'LIST' },
        { type: 'Customer', id: 'LIST' },
        { type: 'Transaction', id: 'LIST' },
        { type: 'Cashbox', id: 'LIST' },
        'Stats',
      ],
    }),

    // ---- stock (স্টক হিসাব) ----------------------------------------------
    stock: build.query<Paginated<AdminStockItem>, StockListArgs | void>({
      query: (args) => `/admin/stock${qs((args || {}) as Record<string, unknown>)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((s) => ({ type: 'Stock' as const, id: s.id })),
              { type: 'Stock' as const, id: 'LIST' },
            ]
          : [{ type: 'Stock' as const, id: 'LIST' }],
    }),

    updateStock: build.mutation<
      { item: AdminStockItem },
      {
        id: string;
        patch: {
          name?: string;
          unit?: string;
          purchasePrice?: number;
          salePrice?: number;
          openingStock?: number;
          lowStockThreshold?: number;
          note?: string;
        };
      }
    >({
      query: ({ id, patch }) => ({ url: `/admin/stock/${id}`, method: 'PATCH', body: patch }),
      // Opening stock and the threshold both feed the derived quantity, so the
      // row has to be refetched rather than patched in place.
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Stock', id },
        { type: 'Stock', id: 'LIST' },
      ],
    }),

    deleteStock: build.mutation<
      { ok: boolean; deletedId: string; removed: { movements: number } },
      string
    >({
      query: (id) => ({ url: `/admin/stock/${id}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Stock', id: 'LIST' },
        'Stats',
      ],
    }),

    // ---- customers ------------------------------------------------------
    customers: build.query<Paginated<AdminCustomer>, CustomerListArgs | void>({
      query: (args) => `/admin/customers${qs((args || {}) as Record<string, unknown>)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((c) => ({ type: 'Customer' as const, id: c.id })),
              { type: 'Customer' as const, id: 'LIST' },
            ]
          : [{ type: 'Customer' as const, id: 'LIST' }],
    }),

    customer: build.query<AdminCustomerDetail, string>({
      query: (id) => `/admin/customers/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Customer', id }],
    }),

    updateCustomer: build.mutation<
      { customer: AdminCustomer },
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/admin/customers/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Customer', id },
        { type: 'Customer', id: 'LIST' },
        'Stats',
      ],
    }),

    deleteCustomer: build.mutation<
      { ok: boolean; deletedId: string; removedTransactions: number },
      string
    >({
      query: (id) => ({ url: `/admin/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Customer', id },
        { type: 'Customer', id: 'LIST' },
        { type: 'Transaction', id: 'LIST' },
        'Stats',
      ],
    }),

    // ---- transactions ---------------------------------------------------
    transactions: build.query<Paginated<AdminTransaction>, TransactionListArgs | void>({
      query: (args) => `/admin/transactions${qs((args || {}) as Record<string, unknown>)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((t) => ({ type: 'Transaction' as const, id: t.id })),
              { type: 'Transaction' as const, id: 'LIST' },
            ]
          : [{ type: 'Transaction' as const, id: 'LIST' }],
    }),

    updateTransaction: build.mutation<
      { ok: boolean; entry: AdminTransaction },
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({
        url: `/admin/transactions/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Transaction', id },
        { type: 'Transaction', id: 'LIST' },
        { type: 'Customer', id: 'LIST' },
        'Stats',
      ],
    }),

    deleteTransaction: build.mutation<{ ok: boolean; deletedId: string }, string>({
      query: (id) => ({ url: `/admin/transactions/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Transaction', id },
        { type: 'Transaction', id: 'LIST' },
        { type: 'Customer', id: 'LIST' },
        'Stats',
      ],
    }),

    // ---- cashbox --------------------------------------------------------
    cashbox: build.query<Paginated<AdminCashboxEntry>, CashboxListArgs | void>({
      query: (args) => `/admin/cashbox${qs((args || {}) as Record<string, unknown>)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map((c) => ({ type: 'Cashbox' as const, id: c.id })),
              { type: 'Cashbox' as const, id: 'LIST' },
            ]
          : [{ type: 'Cashbox' as const, id: 'LIST' }],
    }),

    updateCashbox: build.mutation<
      { ok: boolean; entry: AdminCashboxEntry },
      { id: string; patch: Record<string, unknown> }
    >({
      query: ({ id, patch }) => ({ url: `/admin/cashbox/${id}`, method: 'PATCH', body: patch }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Cashbox', id },
        { type: 'Cashbox', id: 'LIST' },
        'Stats',
      ],
    }),

    deleteCashbox: build.mutation<{ ok: boolean; deletedId: string }, string>({
      query: (id) => ({ url: `/admin/cashbox/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Cashbox', id },
        { type: 'Cashbox', id: 'LIST' },
        'Stats',
      ],
    }),
  }),
});

export interface AdminUserDetail {
  user: AdminUser;
  profile: {
    id: string;
    name: string;
    phone: string;
    initials: string;
    photoUrl: string;
    goldPlanName: string;
    goldTrialDays: number;
    goldTrialLabel: string;
    inboxUnread: number;
    smsRemaining: number;
    smsLabel: string;
    appVersion: string;
  };
  wallet: {
    id: string;
    balance: { raw: number; display: string };
    accountOpened: boolean;
    services: { key: string; label: string; icon: string; enabled: boolean }[];
    benefits: string[];
  };
  summary: {
    receivable: { raw: number; display: string };
    payable: { raw: number; display: string };
    customerCount: number;
    supplierCount: number;
    customerLabel: string;
    transactionCount: number;
  };
  counts: { businesses: number; customers: number; transactions: number; cashbox: number };
  recentTransactions: {
    id: string;
    kind: string;
    amount: number;
    amountDisplay: string;
    date: string;
    description: string;
    customerName: string;
  }[];
}

export interface AdminCustomerDetail {
  customer: AdminCustomer;
  headline: { label: string; tone: string; amountDisplay: string };
  entries: {
    id: string;
    kind: string;
    title: string;
    tone: string;
    description: string;
    amountRaw: number;
    amountDisplay: string;
    dateDisplay: string;
    relative: string;
    hasPhoto: boolean;
    date: string;
  }[];
}

export const {
  useStatsQuery,
  useUsersQuery,
  useUserQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useBusinessesQuery,
  useUpdateBusinessMutation,
  useDeleteBusinessMutation,
  useStockQuery,
  useUpdateStockMutation,
  useDeleteStockMutation,
  useCustomersQuery,
  useCustomerQuery,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useTransactionsQuery,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useCashboxQuery,
  useUpdateCashboxMutation,
  useDeleteCashboxMutation,
} = adminApi;
