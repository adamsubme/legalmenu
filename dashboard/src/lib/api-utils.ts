/**
 * API Response Utilities
 * 
 * Standardized response helpers for Next.js API routes.
 * Reduces boilerplate and ensures consistent error formatting.
 */

import { NextResponse } from 'next/server';

/**
 * Standard API error response
 */
export function apiError(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 400 Bad Request error
 */
export function badRequest(message: string): NextResponse {
  return apiError(message, 400);
}

/**
 * 404 Not Found error
 */
export function notFound(message: string = 'Not found'): NextResponse {
  return apiError(message, 404);
}

/**
 * 403 Forbidden error
 */
export function forbidden(message: string = 'Forbidden'): NextResponse {
  return apiError(message, 403);
}

/**
 * Standard success response with data
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * 201 Created response
 */
export function created<T>(data: T): NextResponse {
  return apiSuccess(data, 201);
}

/**
 * Success response with simple boolean
 */
export function successResponse(): NextResponse {
  return NextResponse.json({ success: true });
}

/**
 * Wrap an async handler with standard error handling
 * Logs errors and returns 500 on exception
 */
export function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | { error: string }>> {
  return handler().catch((error): NextResponse<{ error: string }> => {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError(message) as NextResponse<{ error: string }>;
  });
}

/**
 * Parse JSON body with error handling
 * Returns null if parsing fails
 */
export async function safeParseJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.json();
  } catch (error) {
    console.error('Failed to parse JSON body:', error);
    return null;
  }
}

/**
 * Extract search params from NextRequest with type safety
 */
export function getSearchParams(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

/**
 * Get a single search param value
 */
export function getParam(request: Request, key: string): string | null {
  return getSearchParams(request).get(key);
}

/**
 * Get multiple search param values
 */
export function getParams(request: Request, ...keys: string[]): Record<string, string | null> {
  const params = getSearchParams(request);
  const result: Record<string, string | null> = {};
  for (const key of keys) {
    result[key] = params.get(key);
  }
  return result;
}
