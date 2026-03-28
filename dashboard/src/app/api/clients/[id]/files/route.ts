import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET /api/clients/[id]/files - List client attachments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM client_attachments WHERE client_id = ? ORDER BY created_at DESC')
      .all(clientId);
    return NextResponse.json(rows);
  } catch (e) {
    logger.error({ event: 'client_files_list_failed' }, e);
    return NextResponse.json({ error: api.internalError('list files') }, { status: 500 });
  }
}

// POST /api/clients/[id]/files - Upload file for client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const body = await request.json();
    const { attachment_type, title, file_path, file_name, file_size, file_mime, url, content } = body;

    if (!attachment_type || !['file', 'link', 'note'].includes(attachment_type)) {
      return NextResponse.json({ error: api.attachments.invalidType }, { status: 400 });
    }

    if (attachment_type === 'file' && !file_path) {
      return NextResponse.json({ error: api.attachments.filePathRequired }, { status: 400 });
    }
    if (attachment_type === 'link' && !url) {
      return NextResponse.json({ error: api.attachments.urlRequired }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const db = getDb();

    db.prepare(
      `INSERT INTO client_attachments (id, client_id, attachment_type, title, url, file_path, file_name, file_size, file_mime, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, clientId, attachment_type, title || (attachment_type === 'link' ? url : 'Untitled'), url || null, file_path || null, file_name || null, file_size || null, file_mime || null, content || null, now);

    const row = db.prepare('SELECT * FROM client_attachments WHERE id = ?').get(id);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    logger.error({ event: 'client_file_create_failed' }, e);
    return NextResponse.json({ error: api.internalError('create attachment') }, { status: 500 });
  }
}
