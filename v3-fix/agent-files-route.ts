import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const AGENT_BASE = '/root/.openclaw/agents';

const EDITABLE_FILES = [
  { dir: 'agent', name: 'IDENTITY.md' },
  { dir: 'agent', name: 'SOUL.md' },
  { dir: 'agent', name: 'AGENTS.md' },
  { dir: 'agent', name: 'BOOTSTRAP.md' },
  { dir: 'agent', name: 'ESCALATION.md' },
  { dir: 'agent', name: 'OUTPUT_FORMATS.md' },
  { dir: 'agent', name: 'CHECKLISTS.md' },
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
  }).filter(f => f.content || f.name === 'IDENTITY.md' || f.name === 'SOUL.md');

  return NextResponse.json(files);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { fileName, dir, content } = body as { fileName: string; dir: string; content: string };

  if (!fileName || content === undefined) {
    return NextResponse.json({ error: 'fileName and content required' }, { status: 400 });
  }

  const allowed = EDITABLE_FILES.find(f => f.name === fileName);
  if (!allowed) {
    return NextResponse.json({ error: 'File not editable' }, { status: 403 });
  }

  const targetDir = allowed.dir;
  const filePath = path.join(getAgentDir(id), targetDir, fileName);
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return NextResponse.json({ success: true, path: filePath, size: content.length });
}
