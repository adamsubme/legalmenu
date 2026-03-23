import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const LOG_DIR = '/tmp/openclaw-0';

interface LogEntry {
  agent?: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  timestamp?: string;
}

export async function GET() {
  try {
    const logFiles = fs.existsSync(LOG_DIR)
      ? fs.readdirSync(LOG_DIR).filter(f => f.startsWith('openclaw-') && f.endsWith('.log'))
      : [];

    const entries: LogEntry[] = [];
    const agentStats: Record<string, { tokens_in: number; tokens_out: number; requests: number }> = {};
    const modelStats: Record<string, { tokens_in: number; tokens_out: number; requests: number }> = {};

    for (const logFile of logFiles.slice(-7)) {
      try {
        const content = fs.readFileSync(path.join(LOG_DIR, logFile), 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.includes('tokens') || line.includes('model') || line.includes('usage')) {
            const modelMatch = line.match(/model[=: ]+([a-zA-Z0-9/._-]+)/);
            const tokensInMatch = line.match(/(?:input|prompt)[\s_]*tokens?[=: ]+(\d+)/i);
            const tokensOutMatch = line.match(/(?:output|completion)[\s_]*tokens?[=: ]+(\d+)/i);
            const agentMatch = line.match(/\[([a-z-]+)\]/);

            if (modelMatch || tokensInMatch || tokensOutMatch) {
              const agent = agentMatch?.[1] || 'unknown';
              const model = modelMatch?.[1] || 'unknown';
              const tin = parseInt(tokensInMatch?.[1] || '0');
              const tout = parseInt(tokensOutMatch?.[1] || '0');

              if (tin > 0 || tout > 0) {
                if (!agentStats[agent]) agentStats[agent] = { tokens_in: 0, tokens_out: 0, requests: 0 };
                agentStats[agent].tokens_in += tin;
                agentStats[agent].tokens_out += tout;
                agentStats[agent].requests++;

                if (!modelStats[model]) modelStats[model] = { tokens_in: 0, tokens_out: 0, requests: 0 };
                modelStats[model].tokens_in += tin;
                modelStats[model].tokens_out += tout;
                modelStats[model].requests++;
              }
            }
          }
        }
      } catch {
        // skip unreadable log files
      }
    }

    const MODEL_COSTS: Record<string, { input: number; output: number }> = {
      'gemini-3.1-pro-preview': { input: 2.0, output: 12.0 },
      'gemini-3-pro-preview': { input: 2.0, output: 12.0 },
      'glm-5': { input: 0.5, output: 2.0 },
      'MiniMax-M2.5': { input: 0.2, output: 1.2 },
    };

    let totalCost = 0;
    const modelCosts = Object.entries(modelStats).map(([model, stats]) => {
      const shortModel = model.split('/').pop() || model;
      const pricing = MODEL_COSTS[shortModel] || { input: 1.0, output: 3.0 };
      const cost = (stats.tokens_in / 1_000_000) * pricing.input + (stats.tokens_out / 1_000_000) * pricing.output;
      totalCost += cost;
      return { model, tokens_in: stats.tokens_in, tokens_out: stats.tokens_out, requests: stats.requests, cost: Math.round(cost * 100) / 100 };
    });

    return NextResponse.json({
      period: 'last_7_days',
      total_cost: Math.round(totalCost * 100) / 100,
      by_agent: agentStats,
      by_model: modelCosts,
      log_files_parsed: logFiles.length,
      note: Object.keys(agentStats).length === 0
        ? 'No token usage data found in gateway logs. Costs will populate as agents process tasks.'
        : undefined,
    });
  } catch (e) {
    console.error('Cost calculation failed:', e);
    return NextResponse.json({ error: 'Failed to read cost data', total_cost: 0, by_agent: {}, by_model: [] });
  }
}
