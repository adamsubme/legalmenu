const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function getToken(): string {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error('NOTION_TOKEN not set');
  return token;
}

function getTaskDbId(): string {
  const id = process.env.NOTION_TASK_DB;
  if (!id) throw new Error('NOTION_TASK_DB not set');
  return id;
}

function headers() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

// --- Status mapping ---

const NOTION_TO_MC_STATUS: Record<string, string> = {
  'Not started': 'not_started',
  'In progress': 'in_progress',
  'Done': 'done',
  'Blocked': 'blocked',
  'Awaiting Approval': 'awaiting_approval',
};

const MC_TO_NOTION_STATUS: Record<string, string> = {
  'not_started': 'Not started',
  'in_progress': 'In progress',
  'done': 'Done',
  'blocked': 'Blocked',
  'awaiting_approval': 'Awaiting Approval',
};

// --- Priority mapping ---

const NOTION_TO_MC_PRIORITY: Record<string, string> = {
  'P0': 'urgent',
  'P1': 'high',
  'P2': 'normal',
  'P3': 'low',
};

const MC_TO_NOTION_PRIORITY: Record<string, string> = {
  'urgent': 'P0',
  'high': 'P1',
  'normal': 'P2',
  'low': 'P3',
};

// --- Agent name mapping (MC name -> Notion AI Assignee value) ---

const AGENT_NAME_MAP: Record<string, string> = {
  'Bull': 'Bull',
  'Eagle': 'Eagle',
  'Wolf': 'Wolf',
  'Cheetah': 'Cheetah',
  'Fox (Ziutek)': 'Fox',
  'Owl': 'Owl',
  'Lynx': 'Lynx',
  'Beaver': 'Beaver',
};

const NOTION_AGENT_TO_MC: Record<string, string> = {
  'Bull': 'Bull',
  'Eagle': 'Eagle',
  'Wolf': 'Wolf',
  'Cheetah': 'Cheetah',
  'Fox': 'Fox (Ziutek)',
  'Ziutek': 'Fox (Ziutek)',
  'Owl': 'Owl',
  'Lynx': 'Lynx',
  'Beaver': 'Beaver',
};

// --- Types ---

export interface NotionTask {
  notion_page_id: string;
  title: string;
  status: string;
  priority: string;
  description: string;
  due_date: string | null;
  ai_assignee: string | null;
  created_by: string | null;
  type: string | null;
  project: string | null;
  deliverable_url: string | null;
  last_edited: string;
}

// --- Extract properties from Notion page ---

function extractText(prop: Record<string, unknown>): string {
  if (!prop) return '';
  const type = prop.type as string;

  if (type === 'title') {
    const arr = prop.title as Array<{ plain_text: string }>;
    return arr?.map(t => t.plain_text).join('') || '';
  }
  if (type === 'rich_text') {
    const arr = prop.rich_text as Array<{ plain_text: string }>;
    return arr?.map(t => t.plain_text).join('') || '';
  }
  if (type === 'select') {
    return (prop.select as { name: string } | null)?.name || '';
  }
  if (type === 'status') {
    return (prop.status as { name: string } | null)?.name || '';
  }
  if (type === 'date') {
    return (prop.date as { start: string } | null)?.start || '';
  }
  if (type === 'url') {
    return (prop.url as string) || '';
  }
  if (type === 'multi_select') {
    const arr = prop.multi_select as Array<{ name: string }>;
    return arr?.map(s => s.name).join(', ') || '';
  }
  if (type === 'relation') {
    const arr = prop.relation as Array<{ id: string }>;
    return arr?.map(r => r.id).join(', ') || '';
  }
  if (type === 'people') {
    const arr = prop.people as Array<{ name?: string }>;
    return arr?.map(p => p.name || '').join(', ') || '';
  }
  return '';
}

function parseNotionPage(page: Record<string, unknown>): NotionTask {
  const props = page.properties as Record<string, Record<string, unknown>>;

  const notionStatus = extractText(props['Status']);
  const notionPriority = extractText(props['Priority']);

  return {
    notion_page_id: page.id as string,
    title: extractText(props['Task']),
    status: NOTION_TO_MC_STATUS[notionStatus] || 'not_started',
    priority: NOTION_TO_MC_PRIORITY[notionPriority] || 'normal',
    description: extractText(props['Brief']),
    due_date: extractText(props['Deadline']) || null,
    ai_assignee: extractText(props['AI Assignee']) || null,
    created_by: extractText(props['Created By']) || null,
    type: extractText(props['Type']) || null,
    project: extractText(props['Project']) || null,
    deliverable_url: extractText(props['Deliverable URL']) || null,
    last_edited: page.last_edited_time as string,
  };
}

// --- API Methods ---

export async function queryTaskBoard(startCursor?: string): Promise<{
  tasks: NotionTask[];
  next_cursor: string | null;
  has_more: boolean;
}> {
  const body: Record<string, unknown> = {
    page_size: 100,
    sorts: [{ property: 'Status', direction: 'ascending' }],
  };
  if (startCursor) body.start_cursor = startCursor;

  const res = await fetch(`${NOTION_API}/databases/${getTaskDbId()}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion query failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const tasks = (data.results as Record<string, unknown>[]).map(parseNotionPage);

  return {
    tasks,
    next_cursor: data.next_cursor,
    has_more: data.has_more,
  };
}

export async function getAllTasks(): Promise<NotionTask[]> {
  const all: NotionTask[] = [];
  let cursor: string | undefined;

  do {
    const result = await queryTaskBoard(cursor);
    all.push(...result.tasks);
    cursor = result.next_cursor || undefined;
    if (!result.has_more) break;
  } while (cursor);

  return all;
}

export async function createNotionTask(task: {
  title: string;
  status?: string;
  priority?: string;
  description?: string;
  due_date?: string | null;
  ai_assignee?: string | null;
  created_by?: string | null;
  type?: string | null;
}): Promise<string> {
  const properties: Record<string, unknown> = {
    'Task': {
      title: [{ text: { content: task.title } }],
    },
  };

  if (task.status) {
    const notionStatus = MC_TO_NOTION_STATUS[task.status] || 'Not started';
    properties['Status'] = { status: { name: notionStatus } };
  }

  if (task.priority) {
    const notionPriority = MC_TO_NOTION_PRIORITY[task.priority] || 'P2';
    properties['Priority'] = { select: { name: notionPriority } };
  }

  if (task.description) {
    properties['Brief'] = {
      rich_text: [{ text: { content: task.description.slice(0, 2000) } }],
    };
  }

  if (task.due_date) {
    properties['Deadline'] = { date: { start: task.due_date } };
  }

  if (task.ai_assignee) {
    const name = AGENT_NAME_MAP[task.ai_assignee] || task.ai_assignee;
    properties['AI Assignee'] = { select: { name } };
  }

  if (task.created_by) {
    const name = AGENT_NAME_MAP[task.created_by] || task.created_by;
    properties['Created By'] = { select: { name } };
  }

  if (task.type) {
    properties['Type'] = { select: { name: task.type } };
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      parent: { database_id: getTaskDbId() },
      properties,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion create failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id;
}

export async function updateNotionTask(
  pageId: string,
  updates: {
    title?: string;
    status?: string;
    priority?: string;
    description?: string;
    due_date?: string | null;
    ai_assignee?: string | null;
  }
): Promise<void> {
  const properties: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    properties['Task'] = {
      title: [{ text: { content: updates.title } }],
    };
  }

  if (updates.status !== undefined) {
    const notionStatus = MC_TO_NOTION_STATUS[updates.status] || 'Not started';
    properties['Status'] = { status: { name: notionStatus } };
  }

  if (updates.priority !== undefined) {
    const notionPriority = MC_TO_NOTION_PRIORITY[updates.priority] || 'P2';
    properties['Priority'] = { select: { name: notionPriority } };
  }

  if (updates.description !== undefined) {
    properties['Brief'] = {
      rich_text: [{ text: { content: updates.description.slice(0, 2000) } }],
    };
  }

  if (updates.due_date !== undefined) {
    properties['Deadline'] = updates.due_date
      ? { date: { start: updates.due_date } }
      : { date: null };
  }

  if (updates.ai_assignee !== undefined) {
    if (updates.ai_assignee) {
      const name = AGENT_NAME_MAP[updates.ai_assignee] || updates.ai_assignee;
      properties['AI Assignee'] = { select: { name } };
    } else {
      properties['AI Assignee'] = { select: null };
    }
  }

  if (Object.keys(properties).length === 0) return;

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion update failed (${res.status}): ${err}`);
  }
}

export function resolveAgentName(notionName: string | null): string | null {
  if (!notionName) return null;
  return NOTION_AGENT_TO_MC[notionName] || notionName;
}

export { MC_TO_NOTION_STATUS, MC_TO_NOTION_PRIORITY, AGENT_NAME_MAP, NOTION_AGENT_TO_MC };
