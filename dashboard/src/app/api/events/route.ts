import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, run } from '@/lib/db';
import { parseRequest, createEventSchema } from '@/lib/validation';
import { api } from '@/lib/messages';

// GET /api/events — List events (live feed polling)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const since = searchParams.get('since');
    const taskId = searchParams.get('task_id');

    // Hard cap — prevent accidental table scans
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(rawLimit, 1), 200);

    let sql = `
      SELECT e.*, a.name as agent_name, a.avatar_emoji as agent_emoji, t.title as task_title
      FROM events e
      LEFT JOIN agents a ON e.agent_id = a.id
      LEFT JOIN tasks t ON e.task_id = t.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (since) {
      sql += ' AND e.created_at > ?';
      params.push(since);
    }

    if (taskId) {
      sql += ' AND e.task_id = ?';
      params.push(taskId);
    }

    sql += ' ORDER BY e.created_at DESC LIMIT ?';
    params.push(limit);

    const events = queryAll(sql, params);

    return NextResponse.json(events);
  } catch (error) {
    console.error('[GET /api/events]', error);
    return NextResponse.json({ error: api.internalError('fetch events') }, { status: 500 });
  }
}

// POST /api/events — Create a manual event (e.g., note_added, comment)
export async function POST(request: NextRequest) {
  try {
    const body = await parseRequest(request, createEventSchema);
    const id = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO events (id, type, agent_id, task_id, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.type,
        body.agent_id ?? null,
        body.task_id ?? null,
        body.message,
        body.metadata ? JSON.stringify(body.metadata) : null,
        now,
      ]
    );

    return NextResponse.json(
      { id, type: body.type, message: body.message, created_at: now },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/events]', error);

    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: api.internalError('create event') }, { status: 500 });
  }
}
