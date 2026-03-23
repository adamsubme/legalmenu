import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { exec } from 'child_process';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = '/root/.openclaw/openclaw.json';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const agent = cfg.agents?.list?.find((a: { id: string }) => a.id === id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found in config' }, { status: 404 });
    }
    return NextResponse.json({
      model: agent.model,
      heartbeat: agent.heartbeat,
      subagents: agent.subagents,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const agentIndex = cfg.agents?.list?.findIndex((a: { id: string }) => a.id === id);
    if (agentIndex === -1 || agentIndex === undefined) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (body.model) {
      cfg.agents.list[agentIndex].model = body.model;
    }
    if (body.heartbeat) {
      cfg.agents.list[agentIndex].heartbeat = {
        ...cfg.agents.list[agentIndex].heartbeat,
        ...body.heartbeat,
      };
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');

    if (body.restartGateway) {
      exec('systemctl restart openclaw-legal', (error) => {
        if (error) console.error('[Model] Failed to restart gateway:', error.message);
        else console.log('[Model] Gateway restarted after config change');
      });
    }

    return NextResponse.json({
      success: true,
      model: cfg.agents.list[agentIndex].model,
      restarting: !!body.restartGateway,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
