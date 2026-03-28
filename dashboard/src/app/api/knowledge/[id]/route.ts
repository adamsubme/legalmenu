import { NextRequest, NextResponse } from 'next/server';
import { getKnowledge, updateKnowledge, deleteKnowledge } from '@/lib/db/knowledge';
import { parseRequest, updateKnowledgeSchema } from '@/lib/validation';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const entry = getKnowledge(id);

    if (!entry) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    logger.error({ event: 'knowledge_fetch_failed' }, error);
    return NextResponse.json({ error: api.internalError('fetch knowledge entry') }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await parseRequest(request, updateKnowledgeSchema);

    const entry = updateKnowledge(id, body);
    if (!entry) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({ event: 'knowledge_update_failed' }, error);
    return NextResponse.json({ error: api.internalError('update knowledge entry') }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const deleted = deleteKnowledge(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ event: 'knowledge_delete_failed' }, error);
    return NextResponse.json({ error: api.internalError('delete knowledge entry') }, { status: 500 });
  }
}
