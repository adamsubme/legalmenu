import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, run } from '@/lib/db';
import { getAllTasks, createNotionTask, resolveAgentName } from '@/lib/notion/client';
import { InternalError } from '@/lib/errors';
import type { Agent } from '@/lib/types';
import { logger } from '@/lib/logger';

interface McTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_agent_id: string | null;
  due_date: string | null;
  notion_page_id: string | null;
  notion_last_synced: string | null;
  updated_at: string;
}

function findAgentByName(agents: Agent[], notionName: string | null): Agent | null {
  if (!notionName) return null;
  const mcName = resolveAgentName(notionName);
  if (!mcName) return null;
  return agents.find(a =>
    a.name === mcName || a.name.toLowerCase() === mcName.toLowerCase()
  ) ?? null;
}

export async function POST(): Promise<NextResponse> {
  try {
    const agents = queryAll<Agent>('SELECT * FROM agents');
    const notionTasks = await getAllTasks();
    const mcTasks = queryAll<McTask>(
      `SELECT id, title, description, status, priority, assigned_agent_id,
              due_date, notion_page_id, notion_last_synced, updated_at
       FROM tasks`
    );

    const mcByNotion = new Map<string, McTask>();
    const mcWithoutNotion: McTask[] = [];

    for (const t of mcTasks) {
      if (t.notion_page_id) {
        mcByNotion.set(t.notion_page_id, t);
      } else {
        mcWithoutNotion.push(t);
      }
    }

    let created = 0;
    let updated = 0;
    let pushed = 0;

    // Pull: Notion → MC
    for (const nt of notionTasks) {
      const existing = mcByNotion.get(nt.notion_page_id);

      if (!existing) {
        const agent = findAgentByName(agents, nt.ai_assignee);
        const creator = findAgentByName(agents, nt.created_by);
        const id = uuidv4();
        const now = new Date().toISOString();

        run(
          `INSERT INTO tasks
             (id, title, description, status, priority, assigned_agent_id, created_by_agent_id,
              workspace_id, business_id, due_date, notion_page_id, notion_last_synced,
              source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'notion', ?, ?)`,
          [
            id, nt.title, nt.description || null, nt.status, nt.priority,
            agent?.id || null, creator?.id || null,
            'default', 'default', nt.due_date, nt.notion_page_id, now,
            now, now,
          ]
        );
        created++;
      } else {
        const notionEdited = new Date(nt.last_edited).getTime();
        const lastSync = existing.notion_last_synced
          ? new Date(existing.notion_last_synced).getTime()
          : 0;

        if (notionEdited > lastSync) {
          const agent = findAgentByName(agents, nt.ai_assignee);
          const now = new Date().toISOString();

          run(
            `UPDATE tasks
               SET title = ?, description = ?, status = ?, priority = ?,
                   assigned_agent_id = ?, due_date = ?, notion_last_synced = ?, updated_at = ?
               WHERE id = ?`,
            [
              nt.title, nt.description || null, nt.status, nt.priority,
              agent?.id || existing.assigned_agent_id,
              nt.due_date, now, now, existing.id,
            ]
          );
          updated++;
        }
      }
    }

    // Push: MC → Notion
    for (const mc of mcWithoutNotion) {
      const agent = mc.assigned_agent_id
        ? agents.find(a => a.id === mc.assigned_agent_id)
        : null;

      try {
        const pageId = await createNotionTask({
          title:         mc.title,
          status:        mc.status,
          priority:      mc.priority,
          description:   mc.description || undefined,
          due_date:      mc.due_date,
          ai_assignee:   agent?.name || null,
        });

        const now = new Date().toISOString();
        run(
          'UPDATE tasks SET notion_page_id = ?, notion_last_synced = ?, updated_at = ? WHERE id = ?',
          [pageId, now, now, mc.id]
        );
        pushed++;
      } catch (err) {
        // Per-task failures don't fail the whole sync
        logger.error({ event: 'notion_push_failed', title: mc.title }, err);
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        notion_total:    notionTasks.length,
        mc_total:       mcTasks.length,
        created,
        updated,
        pushed_to_notion: pushed,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ event: 'notion_sync_failed', message: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
