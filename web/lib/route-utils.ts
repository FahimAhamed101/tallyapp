import type { NextRequest } from 'next/server';

/**
 * Helpers for the App Router route handlers.
 *
 * Express could rewrite `req.method` before dispatch, which is how the old
 * backend let the Android client send PATCH. Next.js dispatches on the real
 * HTTP verb and hands the request to a fixed export, so the override has to be
 * resolved inside the handler instead: `POST` handlers that the app uses as a
 * PATCH alias call `effectiveMethod()` and delegate.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * The verb the caller *meant*.
 *
 * `java.net.HttpURLConnection` — which is what the Android client uses —
 * refuses to send PATCH, so the app posts with `X-HTTP-Method-Override: PATCH`.
 * Honour that header so one handler can serve both shapes.
 */
export function effectiveMethod(req: NextRequest): HttpMethod {
  const raw = req.method.toUpperCase() as HttpMethod;
  if (raw !== 'POST') return raw;

  const override = (req.headers.get('x-http-method-override') || '').toUpperCase();
  if (override === 'PATCH' || override === 'PUT' || override === 'DELETE') {
    return override as HttpMethod;
  }
  return 'POST';
}

/** Route params for a dynamic segment, e.g. `[id]`. */
export type RouteContext<T extends Record<string, string>> = { params: T };

/** `NextRequest.nextUrl.searchParams` as a plain URLSearchParams. */
export function searchParams(req: NextRequest): URLSearchParams {
  return req.nextUrl.searchParams;
}
