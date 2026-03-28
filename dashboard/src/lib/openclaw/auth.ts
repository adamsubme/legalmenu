/**
 * Shared authentication helpers for OpenClaw API routes.
 *
 * Two auth mechanisms:
 *  1. lex-session cookie  — human users (dashboard UI)
 *  2. x-agent-key header  — agent-to-dashboard calls (agents, webhooks)
 *
 * Both are verified via the same `verifySession()` from lib/auth.
 */

import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { UnauthorizedError, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export { UnauthorizedError };

/**
 * Verifies the request has a valid session or agent key.
 * Throws UnauthorizedError if not authenticated.
 *
 * Use in route handlers that must have an authenticated caller:
 *
 *   export async function POST(request: NextRequest) {
 *     const session = await requireOpenClawAuth(request);
 *     // session.userId / session.role available
 *   }
 */
export async function requireOpenClawAuth(request: NextRequest): Promise<{
  userId: string;
  role: string;
}> {
  const session = await verifySession(request);
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

/**
 * Like requireOpenClawAuth but returns a NextResponse 401 instead of throwing.
 * Use this when you need to return a Response directly (e.g., SSE streams,
 * Response streaming contexts where throwing doesn't propagate correctly).
 *
 *   export async function GET(request: NextRequest) {
 *     const authError = await requireOpenClawAuthOrResponse(request);
 *     if (authError) return authError;
 *     // authorized, proceed with stream
 *   }
 */
export async function requireOpenClawAuthOrResponse(
  request: NextRequest
): Promise<null | NextResponse> {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * Shortcut: returns null instead of throwing.
 * Use when you need to distinguish "unauthenticated" from "forbidden".
 */
export async function getOpenClawCaller(
  request: NextRequest
): Promise<{ userId: string; role: string } | null> {
  return verifySession(request);
}

/**
 * Maps known error types to appropriate HTTP responses for OpenClaw routes.
 * Call this at the top of every catch block.
 *
 *   } catch (error) {
 *     return mapOpenClawError(error);
 *   }
 */
export function mapOpenClawError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const msg = error instanceof Error ? error.message : String(error);
  logger.error({ event: 'openclaw_route_error' }, msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}

