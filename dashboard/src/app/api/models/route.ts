import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = '/root/.openclaw/openclaw.json';

export async function GET() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const models: { id: string; name: string; provider: string; reasoning?: boolean }[] = [];

    for (const [providerName, provider] of Object.entries(cfg.models?.providers || {})) {
      const p = provider as { models?: { id: string; name: string; reasoning?: boolean }[] };
      if (p.models) {
        for (const model of p.models) {
          models.push({
            id: model.id,
            name: model.name,
            provider: providerName,
            reasoning: model.reasoning,
          });
        }
      }
    }

    return NextResponse.json(models);
  } catch (e) {
    console.error('[Models] Failed to read config:', e);
    return NextResponse.json({ error: 'Failed to read models config' }, { status: 500 });
  }
}
