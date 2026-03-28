import { NextRequest, NextResponse } from 'next/server';
import { listKnowledge, createKnowledge, searchKnowledge, getKnowledgeForContext } from '@/lib/db/knowledge';
import type { CreateKnowledgeRequest, KnowledgeScope } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET /api/knowledge - List or search knowledge entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scopeParam = searchParams.get('scope');
    const scope = scopeParam as KnowledgeScope | null;
    const scopeId = searchParams.get('scope_id') || undefined;
    const entryType = searchParams.get('entry_type') || undefined;
    const search = searchParams.get('search') || undefined;
    const query = searchParams.get('query') || undefined;
    const clientId = searchParams.get('client_id') || undefined;
    const projectId = searchParams.get('project_id') || undefined;
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || undefined;

    // Semantic search mode
    if (query) {
      const results = searchKnowledge(query, { client_id: clientId, project_id: projectId });
      return NextResponse.json(results);
    }

    // Context building mode
    if (scopeParam === 'context') {
      const entries = getKnowledgeForContext({
        client_id: clientId,
        project_id: projectId,
        task_id: scopeId,
      });
      return NextResponse.json(entries);
    }

    // Regular listing
    const entries = listKnowledge({
      scope: scopeParam as KnowledgeScope || undefined,
      scope_id: scopeId,
      entry_type: entryType,
      search,
      tags,
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Failed to fetch knowledge:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 });
  }
}

// POST /api/knowledge - Create a new knowledge entry
export async function POST(request: NextRequest) {
  try {
    const body: CreateKnowledgeRequest = await request.json();

    if (!body.title || !body.content || !body.scope) {
      return NextResponse.json({ error: 'Title, content, and scope are required' }, { status: 400 });
    }

    if (!['global', 'client', 'project', 'task'].includes(body.scope)) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    const entry = createKnowledge(body);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Failed to create knowledge entry:', error);
    return NextResponse.json({ error: 'Failed to create knowledge entry' }, { status: 500 });
  }
}
