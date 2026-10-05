import { useDispatch, useSelector, useStore } from 'react-redux';
import type { AppDispatch, AppStore, RootState } from './index';

/**
 * Typed versions of the react-redux hooks.
 *
 * RTK Query's generated hooks (useUsersQuery, …) are already typed; these are
 * for reading `state.api.queries[...]` or dispatching directly.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
