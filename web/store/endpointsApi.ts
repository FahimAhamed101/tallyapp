import { api, type EndpointDef } from './api';

/** The API explorer's data source: GET /api/admin/endpoints. */
export const endpointsApi = api.injectEndpoints({
  endpoints: (build) => ({
    endpoints: build.query<
      { count: number; groups: { key: string; label: string; count: number }[]; endpoints: EndpointDef[] },
      void
    >({
      query: () => '/admin/endpoints',
      providesTags: ['Endpoint'],
    }),
  }),
});

export const { useEndpointsQuery } = endpointsApi;
