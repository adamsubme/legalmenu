import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel');
  const taskId = searchParams.get('task_id');
  const limit = parseInt(searchParams.get('limit') || '50');

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
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { task_id, channel, direction, sender, recipient, subject, body: msgBody } = body;

  if (!channel || !direction || !msgBody) {
    return NextResponse.json({ error: 'channel, direction, body required' }, { status: 400 });
  }

  const id = uuidv4();
  run(
    `INSERT INTO client_messages (id, task_id, channel, direction, sender, recipient, subject, body)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, task_id || null, channel, direction, sender || null, recipient || null, subject || null, msgBody]
  );

  return NextResponse.json({ id, channel, direction, body: msgBody }, { status: 201 });
}
