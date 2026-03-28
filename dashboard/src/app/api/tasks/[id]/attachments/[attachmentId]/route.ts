import { NextRequest, NextResponse } from 'next/server';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const UPLOAD_ROOT = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH)
  : path.join(process.cwd(), 'data', 'uploads');

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: taskId, attachmentId } = await params;
    const db = getDb();

    const row = db
      .prepare('SELECT * FROM task_attachments WHERE id = ? AND task_id = ?')
      .get(attachmentId, taskId) as { file_path?: string | null } | undefined;

    if (!row) {
      return NextResponse.json({ error: api.attachments.notFound }, { status: 404 });
    }

    if (row.file_path) {
      const resolved = path.resolve(UPLOAD_ROOT, row.file_path);
      if (resolved.startsWith(UPLOAD_ROOT) && existsSync(resolved)) {
        try {
          unlinkSync(resolved);
        } catch (e) {
          logger.warn({ event: 'attachment_file_unlink_failed' }, e);
        }
      }
    }

    db.prepare('DELETE FROM task_attachments WHERE id = ? AND task_id = ?').run(attachmentId, taskId);
    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ event: 'attachment_delete_failed' }, e);
    return NextResponse.json({ error: api.internalError('delete') }, { status: 500 });
  }
}
