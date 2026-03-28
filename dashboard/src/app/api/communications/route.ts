import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, run } from '@/lib/db';
import { parseRequest, createCommunicationSchema } from '@/lib/validation';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel');
    const taskId = searchParams.get('task_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);

    let sql = 'SELECT * FROM client_messages WHERE 1=1';
    const params: unknown[] = [];

    if (channel) {
      sql += ' AND channel = ?';
      params.push(channel);
    }
    if (taskId) {
      sql += ' AND task_id = ?';
      params.push(taskId);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const messages = queryAll(sql, params);
    return NextResponse.json(messages);
  } catch (error) {
    logger.error({ event: 'communications_fetch_failed' }, error);
    return NextResponse.json({ error: api.internalError('fetch communications') }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseRequest(request, createCommunicationSchema);

    const id = uuidv4();
    run(
      `INSERT INTO client_messages (id, task_id, channel, direction, sender, recipient, subject, body)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.task_id || null, body.channel, body.direction,
       body.sender || null, body.recipient || null, body.subject || null, body.body]
    );

    return NextResponse.json({ id, channel: body.channel, direction: body.direction, body: body.body }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({ event: 'communication_create_failed' }, error);
    return NextResponse.json({ error: api.internalError('create communication') }, { status: 500 });
  }
}
