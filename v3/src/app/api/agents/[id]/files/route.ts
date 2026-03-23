import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const AGENT_BASE = '/root/.openclaw/agents';
const EDITABLE_FILES = [
  { dir: 'workspace', name: 'IDENTITY.md' },
  { dir: 'workspace', name: 'SOUL.md' },
  { dir: 'workspace', name: 'AGENTS.md' },
  { dir: 'workspace', name: 'BOOTSTRAP.md' },
  { dir: 'workspace', name: 'ESCALATION.md' },
  { dir: 'workspace', name: 'OUTPUT_FORMATS.md' },
  { dir: 'workspace', name: 'CHECKLISTS.md' },
  { dir: 'agent', name: 'TOOLS.md' },
];

function getAgentDir(agentId: string) {
  return path.join(AGENT_BASE, agentId);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agentDir = getAgentDir(id);

  if (!fs.existsSync(agentDir)) {
    return NextResponse.json({ error: 'Agent directory not found' }, { status: 404 });
  }

  const files = EDITABLE_FILES.map(f => {
    const filePath = path.join(agentDir, f.dir, f.name);
    let content = '';
    let size = 0;
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
      size = fs.statSync(filePath).size;
    }
    return { name: f.name, dir: f.dir, path: filePath, content, size };
  }).filter(f => f.content || f.name === 'IDENTITY.md');

  return NextResponse.json(files);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { fileName, dir, content } = body as { fileName: string; dir: string; content: string };

  if (!fileName || !content) {
    return NextResponse.json({ error: 'fileName and content required' }, { status: 400 });
  }

  const allowed = EDITABLE_FILES.find(f => f.name === fileName && f.dir === dir);
  if (!allowed) {
    return NextResponse.json({ error: 'File not editable' }, { status: 403 });
  }

  const filePath = path.join(getAgentDir(id), dir, fileName);
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return NextResponse.json({ success: true, path: filePath, size: content.length });
}
