import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

const WORKSPACE_ROOT = process.env.VENTURE_STUDIO_PATH || join(process.cwd(), '..', 'venture-studio');

export async function POST(request: NextRequest) {
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
      { cwd: WORKSPACE_ROOT, timeout: 120_000 },
      (error, stdout, stderr) => {
        if (error) {
          console.error('[Deploy] Error:', error.message);
          resolve(
            NextResponse.json({
              success: false,
              error: error.message,
              stdout,
              stderr,
            }, { status: 500 })
          );
          return;
        }

        console.log('[Deploy] Success:', stdout);
        resolve(
          NextResponse.json({
            success: true,
            stdout,
            stderr,
          })
        );
      }
    );
  });
}
