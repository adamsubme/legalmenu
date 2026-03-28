import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

/**
 * Middleware — runs BEFORE every request.
 *
 * Public paths (no auth required):
 *   /login, /register
 *   /api/auth/*  (login, logout, register endpoints)
 *   Static assets: /_next/*, /favicon, *.ico|*.png|*.svg|etc.
 *   /api/events/stream (SSE — auth is enforced inline in the route handler)
 *
 * All other routes require a valid session cookie OR a matching x-agent-key.
 */

const PUBLIC_PATHS = new Set(['/login', '/register']);

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/metrics',   // Prometheus scraping — no auth (network-restrict in production)
  '/api/health',    // Health check
  '/_next/',
  '/favicon',
];

const PUBLIC_SUFFIXES = [
  '.ico', '.png', '.svg', '.jpg', '.jpeg', '.webp', '.woff', '.woff2', '.css', '.js',
];

function isAgentRequest(request: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY;
  if (!key) return false;
  return request.headers.get('x-agent-key') === key;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Skip auth for public paths ────────────────────────────────────────────
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return NextResponse.next();
  }

  for (const suffix of PUBLIC_SUFFIXES) {
    if (pathname.endsWith(suffix)) return NextResponse.next();
  }

  // ── SSE stream — auth is enforced inside the route, not here ─────────────
  if (pathname === '/api/events/stream') return NextResponse.next();

  // ── Agent API key (no fallback) ──────────────────────────────────────────
  if (isAgentRequest(request)) return NextResponse.next();

  // ── Session cookie ────────────────────────────────────────────────────────
  const session = await verifySession(request);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Attach session info to request headers for downstream use ─────────────
  const headers = new Headers(request.headers);
  headers.set('x-user-id', session.userId);
  headers.set('x-user-role', session.role);

  // ── Deprecation headers for non-v1 API routes ─────────────────────────
  // All /api/* except /api/v1/* return Deprecation + Sunset headers.
  // When v2 is released, move these to apply to /api/v1/* instead.
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/v1/')) {
    headers.set('X-API-Version', 'deprecated');
    headers.set('Deprecation', 'true');
    headers.set('Sunset', 'Sat, 31 Dec 2027 23:59:59 GMT');
    headers.set(
      'Link',
      '<https://docs.missioncontrol.app/api/migration-v1>; rel="deprecation"'
    );
    headers.set('X-Migration-Path', pathname.replace('/api/', '/api/v1/'));
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
