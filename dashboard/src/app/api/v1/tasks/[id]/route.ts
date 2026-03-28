/**
 * /api/v1/tasks/[id] — GET one, PATCH update, DELETE delete.
 * All responses include X-API-Version: 1.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v1Handler } from '@/lib/api-version';
import { parseRequest, updateTaskSchema } from '@/lib/validation';
import { WorkflowError } from '@/lib/errors';
import { enforceTransition, isValidStatus, type TaskStatus } from '@/lib/workflow';
import {
  getTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  type UpdateTaskBody,
} from '@/lib/api/tasks/handlers';

export const GET = v1Handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const result = getTaskHandler(id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  }
);

export const PATCH = v1Handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    let body: UpdateTaskBody;
    try {
      body = (await parseRequest(request, updateTaskSchema)) as UpdateTaskBody;
    } catch (err) {
      if (err instanceof Error && err.name === 'ValidationError') {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    // Workflow guard
    const existing = getTaskHandler(id);
    if ('error' in existing) {
      return NextResponse.json({ error: existing.error }, { status: existing.status });
    }

    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        return NextResponse.json(
          { error: `Invalid status "${body.status}"` },
          { status: 422 }
        );
      }

      if (body.status !== existing.data.status) {
        let actor: { id: string; is_master?: boolean } | undefined;

        if (body.updated_by_agent_id) {
          const { queryOne } = await import('@/lib/db');
          const agent = queryOne<{ id: string; is_master?: number }>(
            'SELECT id, is_master FROM agents WHERE id = ?',
            [body.updated_by_agent_id]
          );
          if (agent) actor = { id: agent.id, is_master: !!agent.is_master };
        }

        try {
          enforceTransition({
            from: existing.data.status as TaskStatus,
            to: body.status as TaskStatus,
            actor,
          });
        } catch (err) {
          if (err instanceof WorkflowError) {
            return NextResponse.json(
              { error: err.message, code: err.code },
              { status: err.statusCode }
            );
          }
          throw err;
        }
      }
    }

    const result = await updateTaskHandler(id, body);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  }
);

export const DELETE = v1Handler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const result = deleteTaskHandler(id);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data);
  }
);
