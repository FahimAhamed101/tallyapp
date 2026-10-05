import { NextResponse } from 'next/server';

/**
 * Shared HTTP helpers for the route handlers — the Next.js equivalent of
 * backend/src/lib/http.js.
 *
 * Every failure keeps the Express envelope the Android client already parses:
 *   { error: 'REQUEST_ERROR' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'INTERNAL_ERROR',
 *     message: '<Bengali text>', details? }
 */

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg: string) => new HttpError(401, msg);
export const forbidden = (msg: string) => new HttpError(403, msg);
export const notFound = (msg: string) => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
export const unprocessable = (msg: string, details?: unknown) => new HttpError(422, msg, details);

const ERROR_CODE: Record<number, string> = {
  400: 'REQUEST_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
};

export function errorBody(err: unknown) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error('[api]', err);

  const message =
    err instanceof Error && err.message ? err.message : 'কিছু একটা ভুল হয়েছে';

  return {
    status,
    body: {
      error: ERROR_CODE[status] || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message,
      ...(err instanceof HttpError && err.details !== undefined
        ? { details: err.details }
        : {}),
    },
  };
}

export const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: ERROR_CODE[status] || 'REQUEST_ERROR', message }, { status });

/**
 * Wraps a handler so a thrown HttpError becomes the right envelope and any
 * unexpected throw becomes a 500 instead of a stack trace in the response.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      const { status, body } = errorBody(err);
      return NextResponse.json(body, { status });
    }
  };
}

/** Parses a positive money amount, tolerating Bengali digits and ৳ / commas. */
export function parseAmount(input: unknown): number {
  if (input === null || input === undefined || input === '') return 0;
  const bn: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  const normalized = String(input)
    .replace(/[০-৯]/g, (d) => bn[d])
    .replace(/[৳,\s]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export type Pagination = { page: number; limit: number; skip: number };

/** Clamped page/limit for the admin list screens. */
export function getPagination(searchParams: URLSearchParams, defaultLimit = 25): Pagination {
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit')) || defaultLimit), 200);
  return { page, limit, skip: (page - 1) * limit };
}

export function paginated<T>(items: T[], total: number, { page, limit }: Pagination) {
  return {
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** `_id`-or-slug style lookup: a 24-hex string is an id, anything else a slug. */
export const isObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

/** Reads a JSON body without throwing on an empty one. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
