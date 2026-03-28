import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { queryOne } from '@/lib/db';
import { InternalError, NotFoundError } from '@/lib/errors';
import type { Agent } from '@/lib/types';
import { logger } from '@/lib/logger';

const CONFIG_PATH = '/root/.openclaw/openclaw.json';

const ALLOWED_MODEL_PATTERNS = [
  /^gpt-4/,
  /^gpt-4o/,
  /^gpt-3\.5/,
  /^claude-/,
  /^gemini-/,
  /^minimax-/,
  /^glm-/,
];

function isAllowedModel(model: string): boolean {
  return ALLOWED_MODEL_PATTERNS.some(p => p.test(model));
}

function readConfig(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg: Record<string, unknown>): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const agent = queryOne<Agent>('SELECT id FROM agents WHERE id = ?', [id]);
  if (!agent) {
    return NextResponse.json({ error: `Agent ${id} not found` }, { status: 404 });
  }

  try {
    const cfg = readConfig();
    const agentEntry = (cfg.agents as { list?: { id: string }[] })?.list?.find(
      (a: { id: string }) => a.id === id
    );

    if (!agentEntry) {
      return NextResponse.json({ error: 'Agent not found in gateway config' }, { status: 404 });
    }

    return NextResponse.json({
      model:     (agentEntry as { model?: string }).model,
      heartbeat: (agentEntry as { heartbeat?: Record<string, unknown> }).heartbeat,
      subagents: (agentEntry as { subagents?: unknown[] }).subagents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to read config: ${msg}` }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const agent = queryOne<Agent>('SELECT id FROM agents WHERE id = ?', [id]);
  if (!agent) {
    return NextResponse.json({ error: `Agent ${id} not found` }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate model value if provided
  if (body.model !== undefined) {
    if (typeof body.model !== 'string' || !body.model.trim()) {
      return NextResponse.json({ error: '"model" must be a non-empty string' }, { status: 400 });
    }
    if (!isAllowedModel(body.model)) {
      return NextResponse.json(
        { error: `"${body.model}" is not an allowed model` },
        { status: 400 }
      );
    }
  }

  // Validate heartbeat if provided
  if (body.heartbeat !== undefined && typeof body.heartbeat !== 'object') {
    return NextResponse.json({ error: '"heartbeat" must be an object' }, { status: 400 });
  }

  try {
    const cfg = readConfig();
    const agentsList = (cfg.agents as { list?: { id: string }[] })?.list;
    if (!agentsList) {
      return NextResponse.json({ error: 'Invalid gateway config structure' }, { status: 500 });
    }

    const agentIndex = agentsList.findIndex((a: { id: string }) => a.id === id);
    if (agentIndex === -1) {
      return NextResponse.json({ error: 'Agent not found in gateway config' }, { status: 404 });
    }

    const agentEntry = agentsList[agentIndex] as Record<string, unknown>;

    if (typeof body.model === 'string') {
      agentEntry['model'] = body.model.trim();
    }

    if (body.heartbeat && typeof body.heartbeat === 'object') {
      agentEntry['heartbeat'] = {
        ...(agentEntry['heartbeat'] as Record<string, unknown>),
        ...(body.heartbeat as Record<string, unknown>),
      };
    }

    writeConfig(cfg);

    if (body.restartGateway === true) {
      const { execSync } = await import('child_process');
      try {
        execSync('pm2 restart openclaw || true', { timeout: 10_000 });
      } catch (pm2Err) {
        logger.error({ event: 'pm2_restart_failed' }, pm2Err);
      }
    }

    return NextResponse.json({
      success:    true,
      model:      agentEntry['model'],
      restarting:  body.restartGateway === true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to update config: ${msg}` }, { status: 500 });
  }
}
