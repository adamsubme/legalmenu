/**
 * Server-Sent Events (SSE) endpoint for real-time updates.
 *
 * Auth: Requires valid lex-session cookie OR x-agent-key header.
 *       SSE connections are long-lived so they can't use cookie redirects —
 *       auth is enforced inline here rather than in middleware.
 *
 * Rate limit: 5 connections per IP. Prevents a single client from
 *             exhausting server resources with many SSE streams.
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerClient, unregisterClient } from '@/lib/events';
import { requireOpenClawAuthOrResponse } from '@/lib/openclaw/auth';

// ── In-memory rate limiter ─────────────────────────────────────────────────────
const ipConnectionCount = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 5;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function rateLimitIp(ip: string): boolean {
  const count = (ipConnectionCount.get(ip) ?? 0) + 1;
  if (count > MAX_CONNECTIONS_PER_IP) return false;
  ipConnectionCount.set(ip, count);
  return true;
}

function releaseIp(ip: string) {
  const count = (ipConnectionCount.get(ip) ?? 1) - 1;
  if (count <= 0) {
    ipConnectionCount.delete(ip);
  } else {
    ipConnectionCount.set(ip, count);
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await requireOpenClawAuthOrResponse(request);
  if (authError) return authError;

  const ip = getClientIp(request);
  if (!rateLimitIp(ip)) {
    return NextResponse.json(
      { error: 'Too many SSE connections from this IP', code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      registerClient(controller);

      controller.enqueue(encoder.encode(`: connected\n\n`));

      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 25_000);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        unregisterClient(controller);
        releaseIp(ip);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
