import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { api } from '@/lib/messages';

export const dynamic = 'force-dynamic';

const UPLOAD_ROOT = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH)
  : path.join(process.cwd(), 'data', 'uploads');

export async function GET(request: NextRequest) {
  const pathParam = request.nextUrl.searchParams.get('path');
  if (!pathParam) {
    return NextResponse.json({ error: api.attachments.pathRequired }, { status: 400 });
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathParam);
  } catch {
    return NextResponse.json({ error: api.attachments.invalidPath }, { status: 400 });
  }

  const resolved = path.resolve(UPLOAD_ROOT, decoded);
  if (!resolved.startsWith(UPLOAD_ROOT)) {
    return NextResponse.json({ error: api.attachments.invalidPath }, { status: 400 });
  }

  if (!existsSync(resolved)) {
    return NextResponse.json({ error: api.attachments.notFound }, { status: 404 });
  }

  const st = statSync(resolved);
  if (!st.isFile()) {
    return NextResponse.json({ error: api.attachments.notAFile }, { status: 400 });
  }

  const buf = readFileSync(resolved);
  const filename = path.basename(resolved);

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(st.size),
    },
  });
}
