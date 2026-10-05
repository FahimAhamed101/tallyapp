'use client';

import { useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { attachListeners, makeStore, type AppStore } from './index';

/**
 * One store per browser session.
 *
 * The ref guard matters: `makeStore()` must run once, not on every render, or
 * React 18's double-invoke in dev would build two stores and the RTK Query
 * cache would silently diverge from the one the hooks read.
 */
export default function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = makeStore();
    attachListeners(storeRef.current);
  }

  return <Provider store={storeRef.current}>{children}</Provider>;
}
