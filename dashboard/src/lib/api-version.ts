/**
 * API versioning utilities for Mission Control.
 *
 * Strategy: URL-based versioning (/api/v1/...)
 *   - /api/v1/*  — current stable version (reference implementation)
 *   - /api/*     — legacy, returns Deprecation header
 *
 * Versioning headers added automatically by middleware:
 *   - Non-v1 routes get Deprecation + Sunset headers
 *   - v1 routes get X-API-Version: 1 header via withVersionHeaders()
 *
 * For a breaking-change release:
 *   1. Copy /api/v1 to /api/v2
 *   2. Update v2 with breaking changes
 *   3. v1 routes get Deprecation header (existing clients know to migrate)
 *   4. v2 is the new stable
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Version header ─────────────────────────────────────────────────────────────

const API_VERSION = 'X-API-Version';
const API_VERSION_VALUE = '1';

/**
 * Adds standard API versioning headers to a NextResponse.
 * Call this on every v1 route response.
 *
 * Usage in a route:
 *   const response = NextResponse.json(data);
 *   return withVersionHeaders(response);
 */
export function withVersionHeaders(response: NextResponse): NextResponse {
  response.headers.set(API_VERSION, API_VERSION_VALUE);
  return response;
}

/**
 * Factory: wraps a Next.js route handler and adds X-API-Version: 1 header
 * to every response it produces.
 *
 * Usage:
 *   export const GET = versionedHandler(async (request) => {
 *     return withVersion(NextResponse.json(tasks));
 *   });
 *
 * (This is equivalent to adding the header manually on every response.)
 */
export function versionedHandler(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const response = await fn(request, ...args);
    response.headers.set(API_VERSION, API_VERSION_VALUE);
    return response;
  };
}

// ── V1 route handler factory ────────────────────────────────────────────────

/**
 * v1 API route handler.
 * Adds X-API-Version: 1 to every response.
 *
 * Usage:
 *   export const GET = v1Handler(async (request) => {
 *     const tasks = listTasks();
 *     return NextResponse.json(tasks);
 *   });
 */
export function v1Handler(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return versionedHandler(fn);
}

// ── Deprecated route handler factory ─────────────────────────────────────────

/**
 * Creates a route handler that runs the v1 handler but patches the response
 * with Deprecation headers.
 *
 * Usage (in /api/legacy/tasks/route.ts):
 *   export const GET = deprecatedHandler(
 *     (request) => v1TasksHandler.GET(request),
 *     '/api/tasks',
 *     '/api/v1/tasks'
 *   );
 *
 * Note: The legacy handler must call the v1 handler directly (not through
 * this wrapper) to avoid double-wrapping.
 */
export function deprecatedHandler(
  /**
   * The v1 handler function to proxy to. Must return a NextResponse.
   * In practice this is the v1 route's exported handler.
   */
  v1HandlerFn: (request: NextRequest) => Promise<NextResponse>,
  deprecatedPath: string,
  replacementPath: string
) {
  const DEPRECATION_HEADERS: Record<string, string> = {
    'X-API-Version':      'deprecated',
    'Deprecation':        'true',
    'Sunset':             'Sat, 31 Dec 2027 23:59:59 GMT',
    'Link':               `<https://docs.missioncontrol.app/api/migration-v1>; rel="deprecation"`,
    'X-Migration-Path':   replacementPath,
  };

  return async (request: NextRequest): Promise<NextResponse> => {
    const response = await v1HandlerFn(request);

    for (const [key, value] of Object.entries(DEPRECATION_HEADERS)) {
      response.headers.set(key, value);
    }

    return response;
  };
}
