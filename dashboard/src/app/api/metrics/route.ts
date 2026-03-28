/**
 * GET /api/metrics
 * Returns all metrics in Prometheus text format.
 * No auth required (internal endpoint, should be network-restricted in production).
 */

import { NextResponse } from 'next/server';
import { getMetricsText } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const text = getMetricsText();
  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
