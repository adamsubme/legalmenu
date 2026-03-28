import { NextRequest, NextResponse } from 'next/server';
import { listKnowledge, createKnowledge, searchKnowledge, getKnowledgeForContext } from '@/lib/db/knowledge';
import { parseRequest, createKnowledgeSchema } from '@/lib/validation';
import type { KnowledgeScope } from '@/lib/types';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET /api/knowledge - List or search knowledge entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scopeParam = searchParams.get('scope');
    const scopeId = searchParams.get('scope_id') || undefined;
    const entryType = searchParams.get('entry_type') || undefined;
    const search = searchParams.get('search') || undefined;
    const query = searchParams.get('query') || undefined;
    const clientId = searchParams.get('client_id') || undefined;
    const projectId = searchParams.get('project_id') || undefined;
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || undefined;

    if (query) {
      const results = searchKnowledge(query, { client_id: clientId, project_id: projectId });
      return NextResponse.json(results);
    }

    if (scopeParam === 'context') {
      const entries = getKnowledgeForContext({
        client_id: clientId,
        project_id: projectId,
        task_id: scopeId,
      });
      return NextResponse.json(entries);
    }

    const entries = listKnowledge({
      scope: (scopeParam ?? undefined) as KnowledgeScope | undefined,
      scope_id: scopeId,
      entry_type: entryType,
      search,
      tags,
    });

    return NextResponse.json(entries);
  } catch (error) {
    logger.error({ event: 'knowledge_fetch_failed' }, error);
    return NextResponse.json({ error: api.internalError('fetch knowledge') }, { status: 500 });
  }
}

// POST /api/knowledge - Create a new knowledge entry
export async function POST(request: NextRequest) {
  try {
    const body = await parseRequest(request, createKnowledgeSchema);
    const entry = createKnowledge(body);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({ event: 'knowledge_create_failed' }, error);
    return NextResponse.json({ error: api.internalError('create knowledge entry') }, { status: 500 });
  }
}
