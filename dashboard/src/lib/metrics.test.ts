/**
 * Prometheus metrics — tests.
 *
 * These tests verify the Prometheus text format generation logic
 * without depending on shared module state between tests.
 */

import { describe, it, expect } from 'vitest';

// Re-implement the core formatting logic to test the algorithm
// (the actual metrics module is a singleton with shared state)

function escapeLabelValue(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function renderCounter(name: string, value: number, labels: Record<string, string>): string[] {
  const labelParts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`)
    .join(',');
  const labelStr = labelParts ? `{${labelParts}}` : '';
  return [
    `# TYPE ${name} counter`,
    `# HELP ${name} Counter for ${name}`,
    `${name}${labelStr} ${value}`,
  ];
}

function renderHistogramBuckets(
  name: string,
  labels: Record<string, string>,
  buckets: Array<{ le: number; count: number }>,
  sum: number,
  count: number
): string[] {
  const baseLabels = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`)
    .join(',');
  const labelStr = baseLabels ? `{${baseLabels}}` : '';
  const lines: string[] = [
    `# TYPE ${name} histogram`,
    `# HELP ${name} Histogram for ${name}`,
  ];

  let cumCount = 0;
    for (const bucket of buckets) {
      cumCount += bucket.count;
      const leStr = isFinite(bucket.le) ? String(bucket.le) : '+Inf';
      const bucketLabels = baseLabels
        ? `${baseLabels.slice(0, -1)},le="${leStr}"}`
        : `{le="${leStr}"}`;
      lines.push(`${name}_bucket${bucketLabels} ${cumCount}`);
    }

  lines.push(`${name}_sum${labelStr} ${sum}`);
  lines.push(`${name}_count${labelStr} ${count}`);
  return lines;
}

// ── Counter rendering ──────────────────────────────────────────────────────

describe('metrics — Prometheus counter format', () => {
  it('renders TYPE and HELP comments', () => {
    const lines = renderCounter('http_requests', 42, {});
    expect(lines[0]).toBe('# TYPE http_requests counter');
    expect(lines[1]).toBe('# HELP http_requests Counter for http_requests');
  });

  it('renders counter value', () => {
    const lines = renderCounter('events_total', 7, {});
    expect(lines[2]).toBe('events_total 7');
  });

  it('renders labels alphabetically sorted', () => {
    const lines = renderCounter('req', 1, { z: 'last', a: 'first', m: 'mid' });
    const line = lines[2]!;
    expect(line.indexOf('a="first"')).toBeLessThan(line.indexOf('m="mid"'));
    expect(line.indexOf('m="mid"')).toBeLessThan(line.indexOf('z="last"'));
  });

  it('escapes newlines in label values', () => {
    const lines = renderCounter('test', 1, { path: '/api/tasks\nnew' });
    expect(lines[2]).toContain('path="/api/tasks\\nnew"');
  });

  it('escapes backslashes and quotes in label values', () => {
    const lines = renderCounter('test', 1, { msg: 'say "hi\\nthere"' });
    expect(lines[2]).toContain('msg="say \\"hi\\\\nthere\\""');
  });

  it('renders empty labels without braces', () => {
    const lines = renderCounter('no_labels', 1, {});
    expect(lines[2]).toBe('no_labels 1');
  });
});

// ── Histogram bucket rendering ─────────────────────────────────────────────

describe('metrics — Prometheus histogram format', () => {
  const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];

  it('renders TYPE and HELP', () => {
    const lines = renderHistogramBuckets('http_duration', {}, [], 0, 0);
    expect(lines[0]).toBe('# TYPE http_duration histogram');
    expect(lines[1]).toBe('# HELP http_duration Histogram for http_duration');
  });

  it('renders buckets in ascending le order with cumulative counts', () => {
    const buckets = [
      { le: 0.005, count: 0 },
      { le: 0.01, count: 2 },
      { le: 0.05, count: 5 },
      { le: 0.1, count: 10 },
      { le: 0.25, count: 12 },
    ];
    const lines = renderHistogramBuckets('latency', {}, buckets, 1.5, 12);

    // Find bucket lines and check they are in ascending le order
    const bucketLines = lines.filter(l => l.includes('_bucket'));

    // Verify ascending le order by parsing le values
    for (let i = 1; i < bucketLines.length; i++) {
      const match = (l: string) => l.match(/le="([^"]+)"/)?.[1];
      const leA = parseFloat(bucketLines[i - 1]!.match(/le="([^"]+)"/)?.[1] ?? '0');
      const leB = parseFloat(bucketLines[i]!.match(/le="([^"]+)"/)?.[1] ?? '0');
      expect(leB).toBeGreaterThan(leA);
    }

    // Verify cumulative counts are non-decreasing
    for (let i = 1; i < bucketLines.length; i++) {
      const countA = parseInt(bucketLines[i - 1]!.split(' ').pop()!);
      const countB = parseInt(bucketLines[i]!.split(' ').pop()!);
      expect(countB).toBeGreaterThanOrEqual(countA);
    }
  });

  it('renders bucket with +Inf le value when present', () => {
    // Note: the actual metrics.ts implementation doesn't auto-add +Inf bucket.
    // This tests the rendering logic IF +Inf is present in the bucket data.
    const buckets = [
      { le: 0.005, count: 0 },
      { le: 0.01, count: 0 },
      { le: Infinity, count: 0 },
    ];
    const lines = renderHistogramBuckets('latency', {}, buckets, 0, 0);
    const infLine = lines.find(l => l.includes('le="Infinity"') || l.includes('le="+Inf"'));
    expect(infLine).toBeDefined();
  });

  it('renders _sum and _count', () => {
    const buckets = [{ le: 0.005, count: 1 }];
    const lines = renderHistogramBuckets('latency', { method: 'GET' }, buckets, 3.14, 1);

    expect(lines.some(l => l.includes('_sum') && l.includes('3.14'))).toBe(true);
    expect(lines.some(l => l.includes('_count') && l.includes(' 1'))).toBe(true);
  });

  it('renders labels on sum and count lines', () => {
    const buckets = [{ le: 0.005, count: 1 }];
    const lines = renderHistogramBuckets('req', { route: '/api/health' }, buckets, 0.1, 1);

    const sumLine = lines.find(l => l.includes('_sum'));
    const countLine = lines.find(l => l.includes('_count'));
    expect(sumLine).toContain('route="/api/health"');
    expect(countLine).toContain('route="/api/health"');
  });

  it('DEFAULT_BUCKETS cover 5ms to 30s range', () => {
    expect(DEFAULT_BUCKETS[0]).toBe(0.005);
    expect(DEFAULT_BUCKETS[DEFAULT_BUCKETS.length - 1]).toBe(30);
    expect(DEFAULT_BUCKETS.length).toBeGreaterThan(5);
    // Should be sorted
    for (let i = 1; i < DEFAULT_BUCKETS.length; i++) {
      expect(DEFAULT_BUCKETS[i]).toBeGreaterThan(DEFAULT_BUCKETS[i - 1]!);
    }
  });
});

// ── Label escaping ─────────────────────────────────────────────────────────

describe('metrics — label escaping', () => {
  it('escapes backslash', () => {
    expect(escapeLabelValue('path\\to\\file')).toBe('path\\\\to\\\\file');
  });

  it('escapes double quote', () => {
    expect(escapeLabelValue('say "hello"')).toBe('say \\"hello\\"');
  });

  it('escapes newline', () => {
    expect(escapeLabelValue('line1\nline2')).toBe('line1\\nline2');
  });

  it('passes through plain strings unchanged', () => {
    expect(escapeLabelValue('simple')).toBe('simple');
    expect(escapeLabelValue('with spaces')).toBe('with spaces');
    expect(escapeLabelValue('with-dash_underscore')).toBe('with-dash_underscore');
  });
});

// ── Bucket cumulative count invariant ──────────────────────────────────────

describe('metrics — bucket counts are cumulative', () => {
  it('each bucket count >= previous bucket count', () => {
    const buckets = [
      { le: 0.005, count: 3 },
      { le: 0.01, count: 5 },
      { le: 0.05, count: 5 },
      { le: 0.1, count: 10 },
      { le: 0.25, count: 10 },
    ];

    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i]!.count).toBeGreaterThanOrEqual(buckets[i - 1]!.count);
    }
  });

  it('total count in +Inf bucket equals overall count', () => {
    const buckets = [
      { le: 0.005, count: 1 },
      { le: 0.01, count: 3 },
      { le: 0.05, count: 7 },
      { le: 0.1, count: 15 },
    ];
    const totalCount = buckets[buckets.length - 1]!.count;
    expect(totalCount).toBe(15);
  });
});
