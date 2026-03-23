import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const entries = queryAll('SELECT * FROM knowledge_entries ORDER BY created_at DESC');
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, source_type, source_url, file_name, description, tags } = body;

  if (!title || !source_type) {
    return NextResponse.json({ error: 'title and source_type required' }, { status: 400 });
  }

  const id = uuidv4();
  run(
    `INSERT INTO knowledge_entries (id, title, source_type, source_url, file_name, description, tags, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, title, source_type, source_url || null, file_name || null, description || null, tags || null]
  );

  const entry = queryOne('SELECT * FROM knowledge_entries WHERE id = ?', [id]);
  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const entry = queryOne('SELECT * FROM knowledge_entries WHERE id = ?', [id]);
  if (!entry) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  run('DELETE FROM knowledge_entries WHERE id = ?', [id]);
  return NextResponse.json({ success: true });
}
