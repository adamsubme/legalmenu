/**
 * /api/deploy — Triggers the deploy.sh script on the server.
 *
 * Auth: Requires agent API key (x-agent-key header).
 * This is intentional — deploy is an infrastructure operation, not a user action.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

const WORKSPACE_ROOT =
  process.env.VENTURE_STUDIO_PATH ||
  join(process.cwd(), '..', 'venture-studio');

const AGENT_API_KEY = process.env.AGENT_API_KEY;
const DEPLOY_TIMEOUT_MS = 120_000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth — agent key required for deploys ──────────────────────────────
  if (AGENT_API_KEY) {
    const key = request.headers.get('x-agent-key');
    if (key !== AGENT_API_KEY) {
      return NextResponse.json({ error: api.unauthorized }, { status: 401 });
    }
  }

  const deployScript = join(WORKSPACE_ROOT, 'deploy.sh');

  if (!existsSync(deployScript)) {
    return NextResponse.json(
      { error: 'deploy.sh not found', path: deployScript },
      { status: 404 }
    );
  }

  return new Promise<NextResponse>((resolve) => {
    exec(
      `bash "${deployScript}"`,
      { cwd: WORKSPACE_ROOT, timeout: DEPLOY_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error) {
          logger.error({ event: 'deploy_failed', message: error.message });
          resolve(
            NextResponse.json(
              { success: false, error: error.message, stdout, stderr },
              { status: 500 }
            )
          );
          return;
        }

        logger.info({ event: 'deploy_success' });
        resolve(
          NextResponse.json({ success: true, stdout, stderr })
        );
      }
    );
  });
}
