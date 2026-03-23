import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lessons = queryAll(
    'SELECT * FROM agent_lessons WHERE agent_id = ? ORDER BY created_at DESC',
    [id]
  );
  return NextResponse.json(lessons);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { lesson, category, matter_id } = body;

  if (!lesson) {
    return NextResponse.json({ error: 'lesson required' }, { status: 400 });
  }

  const entryId = uuidv4();
  run(
    `INSERT INTO agent_lessons (id, agent_id, lesson, category, matter_id) VALUES (?, ?, ?, ?, ?)`,
    [entryId, id, lesson, category || 'general', matter_id || null]
  );

  return NextResponse.json({ id: entryId, agent_id: id, lesson, category: category || 'general' });
}
