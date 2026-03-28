/**
 * /api/v1/tasks — GET list, POST create.
 * All responses include X-API-Version: 1.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v1Handler } from '@/lib/api-version';
import { parseRequest, createTaskSchema } from '@/lib/validation';
import { WorkflowError } from '@/lib/errors';
import { enforceTransition, type TaskStatus } from '@/lib/workflow';
import {
  listTasksHandler,
  createTaskHandler,
  type ListTasksOptions,
  type CreateTaskBody,
} from '@/lib/api/tasks/handlers';

export const GET = v1Handler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  const rawLimit = parseInt(searchParams.get('limit') ?? '200', 10) || 200;
  const limit = Math.min(Math.max(rawLimit, 1), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

  const opts: ListTasksOptions = {
    status:          searchParams.get('status') ?? undefined,
    businessId:    searchParams.get('business_id') ?? undefined,
    workspaceId:    searchParams.get('workspace_id') ?? undefined,
    assignedAgentId: searchParams.get('assigned_agent_id') ?? undefined,
    limit,
    offset,
  };

  const data = listTasksHandler(opts);
  return NextResponse.json(data);
});

export const POST = v1Handler(async (request: NextRequest) => {
  try {
    const body = await parseRequest(request, createTaskSchema);

    if (body.status) {
      enforceTransition({ from: 'not_started', to: body.status as TaskStatus });
    }

    const result = await createTaskHandler(body as CreateTaskBody);
    return NextResponse.json(result.data, { status: result.status ?? 201 });
  } catch (err) {
    if (err instanceof WorkflowError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    throw err;
  }
});
