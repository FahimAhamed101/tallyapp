import { Types } from 'mongoose';

/**
 * Coerces a reference to an ObjectId for use in an **aggregation**.
 *
 * `Model.find({ owner: '6ac4…' })` works because mongoose casts *query* filters.
 * **Aggregation `$match` is not cast** — the pipeline is handed to the server
 * verbatim, so a 24-hex string never equals an ObjectId and the match silently
 * returns nothing. No error, no warning, just an empty result that reads as a
 * legitimate zero.
 *
 * That is exactly how every balance in the admin panel came back ৳০.০০ while the
 * owner-scoped screens showed the real figures: the admin routes key their maps
 * by `String(c.owner)`, while the user routes pass a real `user._id`.
 *
 * The check is a strict 24-hex test, not `Types.ObjectId.isValid` — `isValid`
 * returns true for *any* 12-character string, which would mangle a legitimate
 * short id into an unrelated ObjectId.
 *
 * This lives in its own leaf module (no internal imports) so both `ledger.ts`
 * and `scope.ts` can use it without the module graph acquiring a cycle.
 */
const HEX24 = /^[0-9a-fA-F]{24}$/;

export function asObjectId(value: unknown): unknown {
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && HEX24.test(value)) return new Types.ObjectId(value);
  return value;
}
