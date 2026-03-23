import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, run } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const AGENT_BASE = '/root/.openclaw/agents';

function syncLessonsToFile(agentId: string) {
  const lessons = queryAll<{ lesson: string; category: string; matter_id: string | null; created_at: string }>(
    'SELECT lesson, category, matter_id, created_at FROM agent_lessons WHERE agent_id = ? ORDER BY created_at DESC',
    [agentId]
  );

  if (lessons.length === 0) return;

  const lines = ['# LESSONS LEARNED\n'];
  const byCategory: Record<string, typeof lessons> = {};
  for (const l of lessons) {
    const cat = l.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(l);
  }

  for (const [cat, items] of Object.entries(byCategory)) {
    lines.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`);
    for (const item of items) {
      const date = item.created_at ? item.created_at.split('T')[0] : '';
      const matter = item.matter_id ? ` [${item.matter_id}]` : '';
      lines.push(`- ${item.lesson}${matter}${date ? ` _(${date})_` : ''}`);
    }
    lines.push('');
  }

  const agentDir = path.join(AGENT_BASE, agentId, 'agent');
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }
  fs.writeFileSync(path.join(agentDir, 'LESSONS.md'), lines.join('\n'), 'utf-8');
}

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

  syncLessonsToFile(id);

  return NextResponse.json({ id: entryId, agent_id: id, lesson, category: category || 'general' });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const lessonId = searchParams.get('lessonId');

  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId required' }, { status: 400 });
  }

  run('DELETE FROM agent_lessons WHERE id = ? AND agent_id = ?', [lessonId, id]);
  syncLessonsToFile(id);

  return NextResponse.json({ success: true });
}
