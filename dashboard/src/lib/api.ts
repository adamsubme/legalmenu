/**
 * Centralised API route helper.
 *
 * Wraps a route handler so that:
 *  - AppError subclasses are caught and returned as JSON with the correct status code
 *  - Unknown errors are caught, logged, and returned as 500 INTERNAL_ERROR
 *  - JSON parse errors return 400 BAD_REQUEST
 *
 * Usage:
 *
 *   import { apiHandler } from '@/lib/api';
 *
 *   export const POST = apiHandler(async (request) => {
 *     const body = await parseRequest(request, schemas.createTask);
 *     const task = createTask(body);
 *     return { status: 201, data: task };
 *   });
 *
 * The handler should return { data } for success or throw an AppError.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AppError, toApiError } from './errors';
import { logger } from './logger';

type HandlerReturn =
  | { status?: number; data: unknown }
  | { status?: number; data: unknown[] }
  | { status: number; data: unknown };

type RouteHandler = (request: NextRequest) => Promise<HandlerReturn>;

function isEmptyBodyError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'body' in error &&
    (error as { body?: unknown }).body === undefined
  );
}

export function apiHandler(handler: RouteHandler) {
  return async (request: NextRequest) => {
    try {
      const result = await handler(request);

      const status = result.status ?? 200;
      const data = result.data;

      return NextResponse.json(data, { status });

    } catch (rawError) {
      const error = toApiError(rawError);

      // Log server errors so they're visible in server output
      if (error.statusCode >= 500) {
        logger.error({
          event:   'api_error',
          method:  request.method,
          pathname: request.nextUrl.pathname,
          status:  error.statusCode,
          code:    error.code,
        }, rawError);
      }

      const response = NextResponse.json(
        error.toJSON(),
        { status: error.statusCode }
      );

      // Add Retry-After header for rate limit errors
      if (error.code === 'RATE_LIMITED' && error.details && typeof error.details === 'object') {
        const retryAfter = (error.details as { retryAfter?: number }).retryAfter;
        if (retryAfter) {
          response.headers.set('Retry-After', String(retryAfter));
        }
      }

      return response;
    }
  };
}

/**
 * Wraps a GET handler that returns a list with automatic pagination.
 *
 * Usage:
 *   export const GET = apiList(async (request, { limit, offset }) => {
 *     return listTasks({ limit, offset });
 *   });
 */
export function apiList<T>(
  handler: (request: NextRequest, opts: { limit: number; offset: number }) => Promise<T[]>
) {
  return apiHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);

    const limit = Math.min(
      parseInt(searchParams.get('limit') ?? '50', 10) || 50,
      200  // hard cap
    );
    const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0;

    const items = await handler(request, { limit, offset });

    return {
      data: { items, limit, offset, count: items.length },
    };
  });
}

/**
 * GET-by-ID pattern — parses { id } from the request params.
 *
 * Usage:
 *   export const GET = apiGet(async (request, id) => {
 *     const task = getTask(id);
 *     if (!task) throw new NotFoundError('Task', id);
 *     return task;
 *   });
 */
export function apiGet<T>(
  handler: (request: NextRequest, id: string) => Promise<T>
) {
  return async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      if (!id) throw new AppError('Missing route parameter: id', 400, 'MISSING_PARAM');
      const data = await handler(request, id);
      return NextResponse.json(data);
    } catch (rawError) {
      const error = toApiError(rawError);
      const status = error instanceof AppError ? error.statusCode : 500;
      return NextResponse.json({ error: error.message, code: (error as AppError).code }, { status });
    }
  };
}
