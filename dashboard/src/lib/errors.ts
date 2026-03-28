/**
 * Centralised error hierarchy for Mission Control.
 *
 * All errors thrown in route handlers should be AppError subclasses.
 * The API error handler (in lib/api.ts) catches them and returns
 * consistent JSON responses with { error, code, details }.
 *
 * Usage in route handlers:
 *   throw new ValidationError('title is required');
 *   throw new NotFoundError('Task', id);
 *   throw new ForbiddenError();
 *
 * Usage outside handlers (services, db helpers):
 *   throw new DatabaseError('INSERT failed', details);
 */

import { api as _apiErrors } from './messages';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

// ── 400 Bad Request ─────────────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

// ── 401 Unauthorized ────────────────────────────────────────────────────────────

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// ── 403 Forbidden ───────────────────────────────────────────────────────────────

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// ── 404 Not Found ──────────────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} ${id} not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// ── 409 Conflict ───────────────────────────────────────────────────────────────

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// ── 422 Unprocessable Entity ───────────────────────────────────────────────────

export class WorkflowError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'WORKFLOW_ERROR', details);
    this.name = 'WorkflowError';
  }
}

// ── 429 Too Many Requests ──────────────────────────────────────────────────────

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter?: number) {
    super(message, 429, 'RATE_LIMITED', retryAfter ? { retryAfter } : undefined);
    this.name = 'RateLimitError';
  }
}

// ── 500 Internal Server Error ──────────────────────────────────────────────────

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR');
    this.name = 'InternalError';
  }
}

// ── Database errors ─────────────────────────────────────────────────────────────

export class DatabaseError extends AppError {
  constructor(message: string, operation?: string, details?: unknown) {
    super(
      message,
      500,
      'DATABASE_ERROR',
      { operation, ...(details !== undefined && { details }) }
    );
    this.name = 'DatabaseError';
  }
}

// ── External service errors ────────────────────────────────────────────────────

export class OpenClawError extends AppError {
  constructor(message: string, sessionId?: string, details?: unknown) {
    super(message, 502, 'OPENCLAW_ERROR', { sessionId, ...(details !== undefined && { details }) });
    this.name = 'OpenClawError';
  }
}

export class NotionError extends AppError {
  constructor(message: string, pageId?: string, details?: unknown) {
    super(message, 502, 'NOTION_ERROR', { pageId, ...(details !== undefined && { details }) });
    this.name = 'NotionError';
  }
}

// ── Error handler helper ───────────────────────────────────────────────────────

/**
 * Converts an unknown error to a safe API response.
 * If the error is an AppError subclass, returns its JSON.
 * If it's a generic Error, returns 500 with the message.
 * All other values are stringified.
 */
export function toApiError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    return new InternalError(error.message);
  }
  return new InternalError(String(error));
}
