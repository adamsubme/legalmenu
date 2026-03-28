import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import type { AttachmentType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY datetime(created_at) DESC')
      .all(taskId);
    return NextResponse.json(rows);
  } catch (e) {
    console.error('[GET attachments]', e);
    return NextResponse.json({ error: 'Failed to list attachments' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = (await request.json()) as {
      attachment_type: AttachmentType;
      title?: string;
      url?: string;
      file_path?: string;
      file_name?: string;
      file_size?: number;
      file_mime?: string;
      content?: string;
      description?: string;
    };

    if (!body.attachment_type || !['file', 'link', 'note'].includes(body.attachment_type)) {
      return NextResponse.json({ error: 'Invalid attachment_type' }, { status: 400 });
    }

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    if (body.attachment_type === 'link' && !body.url?.trim()) {
      return NextResponse.json({ error: 'url is required for link' }, { status: 400 });
    }
    if (body.attachment_type === 'note' && !body.content?.trim()) {
      return NextResponse.json({ error: 'content is required for note' }, { status: 400 });
    }
    if (body.attachment_type === 'file' && !body.file_path?.trim()) {
      return NextResponse.json({ error: 'file_path is required for file' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const db = getDb();

    db.prepare(
      `INSERT INTO task_attachments (
        id, task_id, attachment_type, title, url, file_path, file_name, file_size, file_mime, content, description, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      taskId,
      body.attachment_type,
      title,
      body.url?.trim() || null,
      body.file_path?.trim() || null,
      body.file_name || null,
      body.file_size ?? null,
      body.file_mime || null,
      body.content?.trim() || null,
      body.description?.trim() || null,
      'user',
      now
    );

    const row = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(id);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    console.error('[POST attachments]', e);
    return NextResponse.json({ error: 'Failed to create attachment' }, { status: 500 });
  }
}
