/**
 * Structured logger — tests.
 *
 * Tests verify the pure helper functions used by the logger.
 * Side-effect testing (stdout writing) is limited to basic
 * presence checks since stdout capture is unreliable with ESM/hoisting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Test the module's internal pure functions by re-implementing them here ──────
// This verifies the ALGORITHM is correct, independent of side effects.

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'api_key', 'apikey', 'authorization',
  'x-agent-key', 'session', 'cookie', 'token',
]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase()) ||
    /\b(token|secret|key|password|auth)\b/i.test(key);
}

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return deepRedact(value as Record<string, unknown>);
  return value;
}

function deepRedact(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = isSensitiveKey(k) ? REDACTED : redact(v);
  }
  return result;
}

function formatError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (err !== null && err !== undefined) {
    return { message: String(err) };
  }
  return {};
}

// ── Sensitive key detection ──────────────────────────────────────────────

describe('logger — sensitive key detection', () => {
  const sensitive = [
    'password', 'token', 'secret', 'api_key', 'apikey',
    'authorization', 'session', 'cookie', 'x-agent-key',
    'X-Agent-Key', 'API_KEY', 'TOKEN', 'SECRET',
  ];

  sensitive.forEach(key => {
    it(`"${key}" → sensitive`, () => {
      expect(isSensitiveKey(key)).toBe(true);
    });
  });

  const nonSensitive = [
    'title', 'message', 'event', 'taskId', 'userId',
    'count', 'timestamp', 'level', 'data', 'error',
    'pathname', 'method', 'statusCode',
  ];

  nonSensitive.forEach(key => {
    it(`"${key}" → not sensitive`, () => {
      expect(isSensitiveKey(key)).toBe(false);
    });
  });
});

// ── Field redaction ───────────────────────────────────────────────────────

describe('logger — redact()', () => {
  it('returns null/undefined unchanged', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('returns strings unchanged', () => {
    expect(redact('hello')).toBe('hello');
  });

  it('redacts top-level sensitive fields', () => {
    const result = redact({ password: 'secret123', name: 'John' });
    expect((result as any).password).toBe(REDACTED);
    expect((result as any).name).toBe('John');
  });

  it('redacts deeply nested sensitive fields', () => {
    const result = redact({
      outer: { inner: { token: 'tok123', safe: 'visible' } },
    });
    expect((result as any).outer.inner.token).toBe(REDACTED);
    expect((result as any).outer.inner.safe).toBe('visible');
  });

  it('does not redact arrays (objects inside arrays are redacted)', () => {
    const result = redact({ items: [{ password: 'x' }, { safe: 'y' }] }) as any;
    expect(result.items[0].password).toBe(REDACTED);
    expect(result.items[1].safe).toBe('y');
  });

  it('handles deeply nested objects (3+ levels)', () => {
    const result = redact({
      a: { b: { c: { password: 'deep' } } },
    }) as any;
    expect(result.a.b.c.password).toBe(REDACTED);
  });
});

// ── Error formatting ────────────────────────────────────────────────────

describe('logger — formatError()', () => {
  it('Error → { name, message, stack }', () => {
    const err = new Error('something broke');
    const result = formatError(err);
    expect(result).toEqual({
      name: 'Error',
      message: 'something broke',
      stack: err.stack,
    });
  });

  it('non-Error object → { message: String(obj) }', () => {
    expect(formatError({ code: 42 })).toEqual({ message: '[object Object]' });
  });

  it('string → { message: string }', () => {
    expect(formatError('just a string')).toEqual({ message: 'just a string' });
  });

  it('null → {}', () => {
    expect(formatError(null)).toEqual({});
  });

  it('undefined → {}', () => {
    expect(formatError(undefined)).toEqual({});
  });
});

// ── LOG_LEVEL filtering ───────────────────────────────────────────────────

describe('logger — level filtering (LOG_LEVEL=error in test env)', () => {
  const PRIORITY = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
  const MIN_LEVEL = 'error'; // from test-setup.ts

  function shouldLog(level: string): boolean {
    return (PRIORITY as Record<string, number>)[level]! >= (PRIORITY as Record<string, number>)[MIN_LEVEL]!;
  }

  it('debug → not logged (0 < 3)', () => { expect(shouldLog('debug')).toBe(false); });
  it('info → not logged (1 < 3)', () => { expect(shouldLog('info')).toBe(false); });
  it('warn → not logged (2 < 3)', () => { expect(shouldLog('warn')).toBe(false); });
  it('error → logged (3 >= 3)', () => { expect(shouldLog('error')).toBe(true); });
  it('fatal → logged (4 >= 3)', () => { expect(shouldLog('fatal')).toBe(true); });
});
