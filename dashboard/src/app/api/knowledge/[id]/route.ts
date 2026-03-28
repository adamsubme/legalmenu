import { NextRequest, NextResponse } from 'next/server';
import { getKnowledge, updateKnowledge, deleteKnowledge } from '@/lib/db/knowledge';
import type { CreateKnowledgeRequest } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/knowledge/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const entry = getKnowledge(id);

    if (!entry) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Failed to fetch knowledge entry:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge entry' }, { status: 500 });
  }
}

// PUT /api/knowledge/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body: Partial<CreateKnowledgeRequest> = await request.json();

    const entry = updateKnowledge(id, body);

    if (!entry) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Failed to update knowledge entry:', error);
    return NextResponse.json({ error: 'Failed to update knowledge entry' }, { status: 500 });
  }
}

// DELETE /api/knowledge/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = deleteKnowledge(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Knowledge entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete knowledge entry:', error);
    return NextResponse.json({ error: 'Failed to delete knowledge entry' }, { status: 500 });
  }
}
