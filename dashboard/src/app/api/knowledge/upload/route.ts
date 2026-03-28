import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { run } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const VECTOR_STORE_ID = 'vs_69c069ceadc88191bbff088737bd11c3';
const UPLOAD_DIR = '/app/attachments/knowledge';

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || '';
    const tags = (formData.get('tags') as string) || '';
    const description = (formData.get('description') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, buffer);

    const uploadForm = new FormData();
    uploadForm.append('purpose', 'assistants');
    uploadForm.append('file', new Blob([buffer]), file.name);

    const uploadRes = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return NextResponse.json({ error: `File upload failed: ${err}` }, { status: 500 });
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.id;

    const attachRes = await fetch(
      `https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}/files`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({ file_id: fileId }),
      }
    );

    const attachData = await attachRes.json();
    const entryId = uuidv4();

    run(
      `INSERT INTO knowledge_entries (id, title, source_type, file_name, file_size, vector_store_file_id, status, tags, description)
       VALUES (?, ?, 'file', ?, ?, ?, ?, ?, ?)`,
      [entryId, title || file.name, file.name, file.size, fileId, attachRes.ok ? 'indexed' : 'failed', tags, description]
    );

    return NextResponse.json({
      id: entryId,
      file_id: fileId,
      vector_store_file: attachData,
      status: attachRes.ok ? 'indexed' : 'failed',
    });
  } catch (e) {
    console.error('Knowledge upload failed:', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
