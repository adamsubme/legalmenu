import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const UPLOAD_ROOT = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH)
  : path.join(process.cwd(), 'data', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const taskId = (formData.get('taskId') ?? formData.get('task_id')) as string | null;

    if (!file || !taskId?.trim()) {
      return NextResponse.json({ error: 'file and taskId (or task_id) are required' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
    const sub = path.join('tasks', taskId.trim());
    const dir = path.join(UPLOAD_ROOT, sub);
    mkdirSync(dir, { recursive: true });

    const storedName = `${randomUUID()}_${safeName}`;
    const fullPath = path.join(dir, storedName);
    writeFileSync(fullPath, buf);

    const relative = path.join(sub, storedName).split(path.sep).join('/');

    return NextResponse.json({
      file_path: relative,
      file_name: file.name,
      file_size: buf.length,
      file_mime: file.type || 'application/octet-stream',
    });
  } catch (e) {
    console.error('[attachments/upload]', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
