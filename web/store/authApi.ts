import { api, type AdminSession } from './api';

/** Panel sign-in / sign-out and the current session. */
export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    adminLogin: build.mutation<
      { ok: boolean; user: AdminSession },
      { phone: string; password: string }
    >({
      query: (body) => ({ url: '/admin/login', method: 'POST', body }),
      invalidatesTags: ['Session', 'Stats', 'User', 'Customer', 'Transaction', 'Cashbox'],
    }),

    adminLogout: build.mutation<{ ok: boolean }, void>({
      query: () => ({ url: '/admin/logout', method: 'POST' }),
      invalidatesTags: ['Session'],
    }),

    adminMe: build.query<{ user: AdminSession }, void>({
      query: () => '/admin/me',
      providesTags: ['Session'],
    }),
  }),
});

export const {
  useAdminLoginMutation,
  useAdminLogoutMutation,
  useAdminMeQuery,
} = authApi;
