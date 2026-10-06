import type { OwnerId } from './ledger';
import { asObjectId } from './object-id';

/**
 * Which slice of the data a request is about.
 *
 * `business: null` widens the query to the whole account. That is what the
 * admin panel wants — it deliberately sees across every book — while every
 * Android-facing route resolves to exactly one business.
 *
 * Kept in its own module so `business.ts`, `summary.ts` and `app-data.ts` can
 * all use it without any cycle risk. The only value import is `object-id.ts`,
 * itself a leaf, so the module graph stays acyclic.
 */
export interface Scope {
  owner: OwnerId;
  business: OwnerId | null;
}

/**
 * Builds the mongo filter for one book (or the whole account).
 *
 * The ids are coerced through `asObjectId` because this filter is spread into
 * aggregation `$match` stages (see `reports/summary`) where mongoose does *not*
 * cast — a bare 24-hex string there matches nothing and yields a silent zero.
 * Normalising at this single choke point means no caller has to remember.
 */
export function scopeFilter(scope: Scope): Record<string, unknown> {
  return scope.business
    ? { owner: asObjectId(scope.owner), business: asObjectId(scope.business) }
    : { owner: asObjectId(scope.owner) };
}
