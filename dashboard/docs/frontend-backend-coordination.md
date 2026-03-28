# Frontend-Backend Coordination

This document tracks alignment between frontend and backend for the Mission Control application.

---

## ✅ Synchronized Types

### TaskStatus

All three sources now agree on the same `TaskStatus` type:

| File | Location |
|------|----------|
| `lib/types.ts` | `TaskStatus` type |
| `lib/validation.ts` | `taskStatusSchema` Zod enum |
| `lib/workflow.ts` | `TASK_STATUSES` array |

**Current value:**
```
'not_started' | 'in_progress' | 'intake' | 'research' | 'drafting' |
'review' | 'testing' | 'client_input' | 'awaiting_approval' |
'done' | 'cancelled' | 'blocked' | 'planning'
```

---

## 🔄 SSE Events (Real-time)

### Frontend Expects

File: `src/lib/types.ts` — `SSEEventType`:
```
'task_updated' | 'task_created' | 'task_deleted' | 'event_added' |
'activity_logged' | 'deliverable_added' | 'agent_spawned' | 'agent_completed'
```

### Backend Sends

File: `src/lib/events.ts` — `broadcast()` calls must match these event types.

### SSE Rate Limiting

- **Backend:** Returns `429 Too Many Requests` when >5 connections/IP
- **Frontend:** `useSSE` hook reconnects with 5s backoff (no special 429 handling)

---

## 🔐 Error Codes

### Frontend Error Hierarchy

File: `src/lib/errors.ts` — `AppError` subclasses with codes:

| Class | Status | Code |
|-------|--------|------|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `BadRequestError` | 400 | `BAD_REQUEST` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `WorkflowError` | 422 | `WORKFLOW_ERROR` |
| `RateLimitError` | 429 | `RATE_LIMITED` |
| `DatabaseError` | 500 | `DATABASE_ERROR` |
| `OpenClawError` | 502 | `OPENCLAW_ERROR` |
| `NotionError` | 502 | `NOTION_ERROR` |

---

## 📋 Backend Tasks (from Backend Agent Plan)

| Priority | Task | Frontend Impact |
|----------|------|-----------------|
| 🔴 CRITICAL | Middleware autentykacji | Frontend already uses httpOnly cookies |
| 🔴 CRITICAL | Napisz aktualny schema.ts | When done, regenerate types |
| 🟠 HIGH | Hierarchia AppError + Zod | Already exists in `lib/errors.ts` |
| 🟠 HIGH | Auth + rate limit SSE | Already has 429 handling |

---

## 📝 When Backend Schema Changes

1. Backend agent updates `lib/db/schema.ts`
2. Frontend agent should:
   - Export Zod schemas that match DB schema
   - Put them in `lib/schemas.ts`
   - Generate TypeScript types: `type Task = z.infer<typeof TaskSchema>`
   - Ensure `lib/types.ts` and `lib/validation.ts` stay in sync

---

## 🔗 API Response Format

### Success
```json
{ "data": { ... }, "error": null }
```

### Error
```json
{ "error": "Human-readable message", "code": "ERROR_CODE" }
```

---

## ⚠️ Pre-existing Issues to Fix

These are tracked separately and are not blocking:

1. `lib/api.ts` / `lib/api-version.ts` — RouteHandler type issues
2. `app/page.tsx` / `app/projects/[id]/page.tsx` — STATUS_LABELS missing new statuses
3. `TaskModal.tsx` — Status label mappings incomplete

---
