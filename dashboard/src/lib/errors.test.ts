/**
 * AppError hierarchy — tests.
 *
 * Tests verify:
 *  1. Each error class has correct name, statusCode, code
 *  2. AppError.toJSON() returns the right shape
 *  3. toApiError() correctly categorises unknown errors
 *  4. Error details are preserved through the hierarchy
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  WorkflowError,
  RateLimitError,
  InternalError,
  DatabaseError,
  OpenClawError,
  NotionError,
  toApiError,
} from './errors';

// ── AppError base ─────────────────────────────────────────────────────────────

describe('AppError base class', () => {
  it('preserves message, statusCode, code, details', () => {
    const err = new AppError('Something broke', 500, 'SOMETHING', { foo: 'bar' });
    expect(err.message).toBe('Something broke');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('SOMETHING');
    expect(err.details).toEqual({ foo: 'bar' });
  });

  it('toJSON() includes error, code, and details', () => {
    const err = new AppError('Oops', 400, 'OopsError', { field: 'email' });
    expect(err.toJSON()).toEqual({
      error: 'Oops',
      code: 'OopsError',
      details: { field: 'email' },
    });
  });

  it('toJSON() omits details when not provided', () => {
    const err = new AppError('Oops', 400, 'OopsError');
    expect(err.toJSON()).toEqual({ error: 'Oops', code: 'OopsError' });
  });

  it('is an instance of Error', () => {
    const err = new AppError('test', 500, 'TEST');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('has a stack trace', () => {
    const err = new AppError('test', 500, 'TEST');
    expect(err.stack).toBeDefined();
    expect(err.stack!.length).toBeGreaterThan(0);
  });
});

// ── 400 errors ────────────────────────────────────────────────────────────────

describe('ValidationError', () => {
  it('has status 400 and code VALIDATION_ERROR', () => {
    const err = new ValidationError('title is required');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('title is required');
    expect(err.name).toBe('ValidationError');
  });

  it('accepts optional details', () => {
    const err = new ValidationError('bad input', { field: 'email' });
    expect(err.details).toEqual({ field: 'email' });
  });
});

describe('BadRequestError', () => {
  it('has status 400 and code BAD_REQUEST', () => {
    const err = new BadRequestError('Missing required field');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('Missing required field');
  });
});

// ── 401 errors ────────────────────────────────────────────────────────────────

describe('UnauthorizedError', () => {
  it('has status 401 and code UNAUTHORIZED', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('uses default message when none provided', () => {
    expect(new UnauthorizedError().message).toBe('Unauthorized');
  });

  it('accepts custom message', () => {
    expect(new UnauthorizedError('Token expired').message).toBe('Token expired');
  });
});

// ── 403 errors ────────────────────────────────────────────────────────────────

describe('ForbiddenError', () => {
  it('has status 403 and code FORBIDDEN', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('uses default message when none provided', () => {
    expect(new ForbiddenError().message).toBe('Forbidden');
  });
});

// ── 404 errors ────────────────────────────────────────────────────────────────

describe('NotFoundError', () => {
  it('with id → message includes resource and id', () => {
    const err = new NotFoundError('Task', 'abc-123');
    expect(err.message).toBe('Task abc-123 not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('without id → message is just resource name', () => {
    const err = new NotFoundError('Task');
    expect(err.message).toBe('Task not found');
  });

  it('toJSON() includes error, code, no details', () => {
    const err = new NotFoundError('Task', 'x');
    expect(err.toJSON()).toEqual({ error: 'Task x not found', code: 'NOT_FOUND' });
  });
});

// ── 409 errors ────────────────────────────────────────────────────────────────

describe('ConflictError', () => {
  it('has status 409 and code CONFLICT', () => {
    const err = new ConflictError('Resource already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });
});

// ── 422 errors ────────────────────────────────────────────────────────────────

describe('WorkflowError', () => {
  it('has status 422 and code WORKFLOW_ERROR', () => {
    const err = new WorkflowError('Invalid transition');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('WORKFLOW_ERROR');
  });

  it('accepts details about the transition context', () => {
    const err = new WorkflowError('Invalid', { from: 'review', to: 'done' });
    expect(err.details).toEqual({ from: 'review', to: 'done' });
  });
});

// ── 429 errors ────────────────────────────────────────────────────────────────

describe('RateLimitError', () => {
  it('has status 429 and code RATE_LIMITED', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('without retryAfter → no details', () => {
    expect(new RateLimitError().details).toBeUndefined();
  });

  it('with retryAfter → details include retryAfter', () => {
    const err = new RateLimitError('Slow down', 60);
    expect(err.details).toEqual({ retryAfter: 60 });
  });
});

// ── 500 errors ────────────────────────────────────────────────────────────────

describe('InternalError', () => {
  it('has status 500 and code INTERNAL_ERROR', () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  it('uses default message', () => {
    expect(new InternalError().message).toBe('Internal server error');
  });
});

// ── DatabaseError ─────────────────────────────────────────────────────────────

describe('DatabaseError', () => {
  it('has status 500 and code DATABASE_ERROR', () => {
    const err = new DatabaseError('INSERT failed');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('DATABASE_ERROR');
  });

  it('merges operation into details', () => {
    const err = new DatabaseError('INSERT failed', 'INSERT', { table: 'tasks' });
    expect(err.details).toEqual({ operation: 'INSERT', details: { table: 'tasks' } });
  });

  it('details include operation only when no extra details', () => {
    const err = new DatabaseError('SELECT failed', 'SELECT');
    expect(err.details).toEqual({ operation: 'SELECT' });
  });
});

// ── External service errors ───────────────────────────────────────────────────

describe('OpenClawError', () => {
  it('has status 502 and code OPENCLAW_ERROR', () => {
    const err = new OpenClawError('Gateway unreachable');
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('OPENCLAW_ERROR');
  });

  it('includes sessionId in details', () => {
    const err = new OpenClawError('Timeout', 'sess-abc');
    expect(err.details).toEqual({ sessionId: 'sess-abc' });
  });

  it('includes extra details alongside sessionId', () => {
    const err = new OpenClawError('Timeout', 'sess-abc', { url: 'ws://...' });
    expect(err.details).toEqual({ sessionId: 'sess-abc', details: { url: 'ws://...' } });
  });
});

describe('NotionError', () => {
  it('has status 502 and code NOTION_ERROR', () => {
    const err = new NotionError('Sync failed');
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('NOTION_ERROR');
  });

  it('includes pageId in details', () => {
    const err = new NotionError('Page not found', 'page-xyz');
    expect(err.details).toEqual({ pageId: 'page-xyz' });
  });
});

// ── toApiError ────────────────────────────────────────────────────────────────

describe('toApiError — categorises unknown errors', () => {
  it('AppError subclass → returned as-is', () => {
    const original = new ValidationError('bad input');
    const result = toApiError(original);
    expect(result).toBe(original);
    expect(result).toBeInstanceOf(AppError);
  });

  it('generic Error → wrapped in InternalError with message preserved', () => {
    const original = new Error('Something went wrong');
    const result = toApiError(original);
    expect(result).toBeInstanceOf(InternalError);
    expect(result.message).toBe('Something went wrong');
    expect((result as InternalError).code).toBe('INTERNAL_ERROR');
  });

  it('non-Error value → wrapped in InternalError with String(value)', () => {
    expect(toApiError(null).message).toBe('null');
    expect(toApiError(undefined).message).toBe('undefined');
    expect(toApiError(42).message).toBe('42');
    expect(toApiError({ foo: 1 }).message).toBe('[object Object]');
  });

  it('AppError subclasses preserve their specific codes', () => {
    const cases = [
      new ValidationError('v'),
      new UnauthorizedError(),
      new ForbiddenError(),
      new NotFoundError('R'),
      new ConflictError('c'),
      new WorkflowError('w'),
      new RateLimitError('r', 30),
      new DatabaseError('d'),
      new OpenClawError('o'),
      new NotionError('n'),
    ];
    cases.forEach(original => {
      const result = toApiError(original);
      expect(result.statusCode).toBe(original.statusCode);
      expect(result.code).toBe(original.code);
    });
  });
});
