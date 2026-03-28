/**
 * Structured logging for Mission Control server.
 *
 * Design goals:
 *  - JSON output to stdout (machine-parseable, PM2/docker compatible)
 *  - Log levels: debug / info / warn / error / fatal
 *  - Context injection: requestId, userId, method, pathname
 *  - Sensitive field redaction by default
 *  - Zero dependencies (pure Node.js)
 *
 * Usage:
 *
 *   import { logger, withRequest } from '@/lib/logger';
 *
 *   // Basic
 *   logger.info({ event: 'task_dispatched', taskId, agentId });
 *
 *   // With request context
 *   const log = withRequest(request);
 *   log.info({ event: 'dispatch_started' });
 *
 *   // Error with stack
 *   logger.error({ event: 'dispatch_failed', taskId }, error);
 *
 *   // Redacted fields (shown as [REDACTED])
 *   logger.info({ event: 'user_login', email: 'a@b.com', password: '[REDACTED]' });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  userId?:    string;
  method?:    string;
  pathname?:  string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
  fatal: 4,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'api_key', 'apikey', 'authorization',
  'x-agent-key', 'x-agent-key', 'session', 'cookie', 'token',
]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase()) ||
    /\b(token|secret|key|password|auth)\b/i.test(key);
}

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (isSensitiveKey(value)) return REDACTED;
    return value;
  }
  if (typeof value === 'object') {
    return deepRedact(value as Record<string, unknown>);
  }
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
    return {
      name:    err.name,
      message: err.message,
      stack:   err.stack,
    };
  }
  if (err !== null && err !== undefined) {
    return { message: String(err) };
  }
  return {};
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) return formatError(value);
  return redact(value as Record<string, unknown>);
}

function buildEntry(
  level: LogLevel,
  context: LogContext,
  eventOrMessage?: string | { event: string },
  errorOrMeta?: unknown,
  maybeError?: unknown
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    level,
    timestamp: new Date().toISOString(),
    ...context,
  };

  // Two calling conventions:
  // logger.info({ event: 'task_dispatched', taskId })
  // logger.info({ event: 'task_dispatched', taskId }, error?)
  // logger.info({ event: 'task_dispatched', taskId }, { key: val }, error?)
  // logger.info('message', meta?, error?)
  let event: string;
  let meta: unknown;
  let error: unknown;

  if (eventOrMessage === undefined) {
    // logger.info({ event: 'x' }) - just context provided
    event = 'unknown';
    meta = undefined;
    error = undefined;
  } else if (typeof eventOrMessage === 'string') {
    // logger.info('message', meta?, error?)
    event = eventOrMessage;
    meta = errorOrMeta;
    error = maybeError;
    if (error instanceof Error) {
      meta = undefined;
    }
  } else {
    // logger.info({ event: 'task_dispatched', ...extra })
    Object.assign(base, eventOrMessage);
    event = (eventOrMessage as { event: string }).event ?? 'unknown';
    error = errorOrMeta instanceof Error ? errorOrMeta : maybeError;
    meta = errorOrMeta instanceof Error ? maybeError : errorOrMeta;
    if (meta instanceof Error) {
      meta = undefined;
    }
  }

  if (error) {
    base.error = formatError(error);
  }

  if (meta !== undefined && !(meta instanceof Error)) {
    base.data = serializeValue(meta as Record<string, unknown>);
  }

  base.event = event;
  return base;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LEVEL];
}

function write(entry: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// ── Public API ──────────────────────────────────────────────────────────────────

// Accepts 1-3 args:
//   logger.info({ event: 'x' })
//   logger.info({ event: 'x' }, error)
//   logger.info({ event: 'x' }, { key: val }, error)
export const logger = {
  debug(context: LogContext, eventOrMessage?: unknown, errorOrMeta?: unknown, maybeError?: unknown): void {
    if (!shouldLog('debug')) return;
    write(buildEntry('debug', context, eventOrMessage as string | { event: string } | undefined, errorOrMeta, maybeError));
  },

  info(context: LogContext, eventOrMessage?: unknown, errorOrMeta?: unknown, maybeError?: unknown): void {
    if (!shouldLog('info')) return;
    write(buildEntry('info', context, eventOrMessage as string | { event: string } | undefined, errorOrMeta, maybeError));
  },

  warn(context: LogContext, eventOrMessage?: unknown, errorOrMeta?: unknown, maybeError?: unknown): void {
    if (!shouldLog('warn')) return;
    write(buildEntry('warn', context, eventOrMessage as string | { event: string } | undefined, errorOrMeta, maybeError));
  },

  error(context: LogContext, eventOrMessage?: unknown, errorOrMeta?: unknown, maybeError?: unknown): void {
    if (!shouldLog('error')) return;
    write(buildEntry('error', context, eventOrMessage as string | { event: string } | undefined, errorOrMeta, maybeError));
  },

  fatal(context: LogContext, eventOrMessage?: unknown, errorOrMeta?: unknown, maybeError?: unknown): void {
    if (!shouldLog('fatal')) return;
    write(buildEntry('fatal', context, eventOrMessage as string | { event: string } | undefined, errorOrMeta, maybeError));
  },
} as const;

/**
 * Injects request context into the logger.
 * Returns a logger-like object that always includes request metadata.
 *
 * Usage:
 *   const log = withRequest(request);
 *   log.info({ event: 'dispatch_started', taskId });
 */
export function withRequest(request: { method?: string; nextUrl?: { pathname?: string }; headers?: { get?: (name: string) => string | null } }): Pick<typeof logger, 'debug' | 'info' | 'warn' | 'error' | 'fatal'> {
  const requestIdHeader = request.headers?.get?.('x-request-id');
  let fallbackId: string;
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    fallbackId = globalThis.crypto.randomUUID();
  } else {
    fallbackId = Math.random().toString(36).slice(2);
  }
  const context: LogContext = {
    method:   request.method,
    pathname: request.nextUrl?.pathname,
    requestId: requestIdHeader ?? fallbackId,
  };

  return {
    debug(ctx: LogContext, e: unknown, m?: unknown) { logger.debug({ ...context, ...ctx }, e as string | { event: string }, m); },
    info( ctx: LogContext, e: unknown, m?: unknown) { logger.info({  ...context, ...ctx }, e as string | { event: string }, m); },
    warn( ctx: LogContext, e: unknown, m?: unknown) { logger.warn({  ...context, ...ctx }, e as string | { event: string }, m); },
    error(ctx: LogContext, e: unknown, m?: unknown) { logger.error({ ...context, ...ctx }, e as string | { event: string }, m); },
    fatal(ctx: LogContext, e: unknown, m?: unknown) { logger.fatal({ ...context, ...ctx }, e as string | { event: string }, m); },
  };
}
