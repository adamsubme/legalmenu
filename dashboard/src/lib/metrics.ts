/**
 * In-memory metrics for Mission Control.
 *
 * Exposes counters, histograms, and gauges in Prometheus text format.
 * Zero dependencies — pure Node.js.
 *
 * Usage:
 *
 *   import { metrics } from '@/lib/metrics';
 *
 *   // Counters
 *   metrics.inc('http_requests_total', { method: 'POST', path: '/api/tasks' });
 *   metrics.inc('dispatch_total', { agent: 'Bull', status: 'success' });
 *   metrics.inc('errors_total', { type: 'validation' });
 *
 *   // Histograms (track durations)
 *   const end = metrics.startTimer('http_request_duration_seconds', { method: 'GET', path: '/api/tasks' });
 *   await doWork();
 *   end(); // records duration
 *
 *   // Gauges
 *   metrics.set('sse_connections_active', count);
 *
 * Endpoint: GET /api/metrics — returns Prometheus text format
 */

export type Labels = Record<string, string>;

// ── Counter ───────────────────────────────────────────────────────────────────

interface Counter {
  value:   number;
  labels:   Labels;
  lastInc:  number; // timestamp of last increment
}

const counters = new Map<string, Counter>();

export function incCounter(name: string, labelValues?: Labels): void {
  const key = labelsKey(name, labelValues);
  const existing = counters.get(key);
  if (existing) {
    existing.value++;
    existing.lastInc = Date.now();
  } else {
    counters.set(key, { value: 1, labels: labelValues ?? {}, lastInc: Date.now() });
  }
}

// ── Histogram ─────────────────────────────────────────────────────────────────

interface HistogramBucket {
  le:    number; // "less than or equal" upper bound
  count: number;
}

interface Histogram {
  count:   number;
  sum:     number;
  labels:  Labels;
  buckets: HistogramBucket[];
  lastUpdate: number;
}

const histograms = new Map<string, Histogram>();

// Standard bucket boundaries (seconds) — covers 5ms to 30s
export const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];

function makeBuckets(bounds: number[]): HistogramBucket[] {
  return bounds.map(le => ({ le, count: 0 }));
}

export function observeHistogram(name: string, durationSeconds: number, labelValues?: Labels): void {
  const key = labelsKey(name, labelValues);
  const existing = histograms.get(key);

  if (existing) {
    existing.count += 1;
    existing.sum   += durationSeconds;
    for (const bucket of existing.buckets) {
      if (durationSeconds <= bucket.le) bucket.count++;
    }
    existing.lastUpdate = Date.now();
  } else {
    histograms.set(key, {
      count:      1,
      sum:        durationSeconds,
      labels:     labelValues ?? {},
      buckets:    makeBuckets(DEFAULT_BUCKETS).map(b => ({ ...b, count: durationSeconds <= b.le ? 1 : 0 })),
      lastUpdate: Date.now(),
    });
  }
}

/** Starts a timer. Call the returned function to observe the duration. */
export function startTimer(name: string, labelValues?: Labels): () => void {
  const start = process.hrtime.bigint();
  return () => {
    const ns = Number(process.hrtime.bigint() - start);
    observeHistogram(name, ns / 1e9, labelValues);
  };
}

// ── Gauge ──────────────────────────────────────────────────────────────────────

interface Gauge {
  value:      number;
  labels:     Labels;
  lastUpdate: number;
}

const gauges = new Map<string, Gauge>();

export function setGauge(name: string, value: number, labelValues?: Labels): void {
  const key = labelsKey(name, labelValues);
  gauges.set(key, { value, labels: labelValues ?? {}, lastUpdate: Date.now() });
}

export function incGauge(name: string, labelValues?: Labels): void {
  const key = labelsKey(name, labelValues);
  const existing = gauges.get(key);
  if (existing) {
    existing.value++;
    existing.lastUpdate = Date.now();
  } else {
    gauges.set(key, { value: 1, labels: labelValues ?? {}, lastUpdate: Date.now() });
  }
}

export function decGauge(name: string, labelValues?: Labels): void {
  const key = labelsKey(name, labelValues);
  const existing = gauges.get(key);
  if (existing) {
    existing.value--;
    existing.lastUpdate = Date.now();
  }
}

// ── Key helper ────────────────────────────────────────────────────────────────

function labelsKey(name: string, labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const sorted = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  return `${name}{${sorted}}`;
}

// ── Prometheus text format renderer ────────────────────────────────────────────

function escapeLabel(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function renderCounters(): string {
  const lines: string[] = [];
  for (const [key, counter] of Array.from(counters.entries())) {
    lines.push(`# TYPE ${key} counter`);
    lines.push(`# HELP ${key} Counter for ${key}`);
    const labelParts = Object.entries(counter.labels)
      .map(([k, v]) => `${k}="${escapeLabel(String(v))}"`)
      .join(',');
    const labelStr = labelParts ? `{${labelParts}}` : '';
    lines.push(`${key}${labelStr} ${counter.value}`);
  }
  return lines.join('\n');
}

function renderHistograms(): string {
  const lines: string[] = [];
  for (const [key, hist] of Array.from(histograms.entries())) {
    const labelParts = Object.entries(hist.labels)
      .map(([k, v]) => `${k}="${escapeLabel(String(v))}"`)
      .join(',');
    const labelStr = labelParts ? `{${labelParts}}` : '';
    const baseName = key.split('{')[0]!;

    lines.push(`# TYPE ${baseName} histogram`);
    lines.push(`# HELP ${baseName} Histogram for ${baseName}`);

    let cumCount = 0;
    for (const bucket of hist.buckets) {
      cumCount += bucket.count;
      const bucketLabels = labelStr
        ? `${labelStr.slice(0, -1)},le="${bucket.le}"}`
        : `{le="${bucket.le}"}`;
      lines.push(`${baseName}_bucket${bucketLabels} ${cumCount}`);
    }
    lines.push(`${baseName}_sum${labelStr} ${hist.sum}`);
    lines.push(`${baseName}_count${labelStr} ${hist.count}`);
  }
  return lines.join('\n');
}

function renderGauges(): string {
  const lines: string[] = [];
  for (const [key, gauge] of Array.from(gauges.entries())) {
    lines.push(`# TYPE ${key} gauge`);
    lines.push(`# HELP ${key} Gauge for ${key}`);
    const labelParts = Object.entries(gauge.labels)
      .map(([k, v]) => `${k}="${escapeLabel(String(v))}"`)
      .join(',');
    const labelStr = labelParts ? `{${labelParts}}` : '';
    lines.push(`${key}${labelStr} ${gauge.value}`);
  }
  return lines.join('\n');
}

/**
 * Returns all metrics in Prometheus text format.
 * Used by GET /api/metrics
 */
export function getMetricsText(): string {
  const parts: string[] = [
    '# Mission Control Metrics',
    `# Generated at ${new Date().toISOString()}`,
    '',
    renderCounters(),
    renderHistograms(),
    renderGauges(),
  ];
  return parts.filter(Boolean).join('\n');
}

// ── Convenience namespace ──────────────────────────────────────────────────────

export const metrics = {
  inc:      incCounter,
  observe:  observeHistogram,
  startTimer,
  set:      setGauge,
  incGauge,
  decGauge,
} as const;
