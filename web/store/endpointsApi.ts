import { api, type EndpointsResponse } from './api';

/** The API explorer's data source: GET /api/admin/endpoints. */
export const endpointsApi = api.injectEndpoints({
  endpoints: (build) => ({
    endpoints: build.query<EndpointsResponse, void>({
      query: () => '/admin/endpoints',
      providesTags: ['Endpoint'],
    }),
  }),
});

export const { useEndpointsQuery } = endpointsApi;
