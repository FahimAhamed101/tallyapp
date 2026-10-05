import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';

// Importing the feature slices is what registers their injected endpoints on
// the shared `api` instance. Without these imports the hooks exist but the
// reducer map would not know about them.
import './authApi';
import './adminApi';
import './endpointsApi';

export const makeStore = () =>
  configureStore({
    reducer: {
      [api.reducerPath]: api.reducer,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(api.middleware),
    devTools: process.env.NODE_ENV !== 'production',
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

/** Enables refetchOnFocus / refetchOnReconnect for the query hooks. */
export const attachListeners = (store: AppStore) => setupListeners(store.dispatch);

export { api };
