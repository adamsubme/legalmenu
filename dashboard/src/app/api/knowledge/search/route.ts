import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { searchKnowledge } from '@/lib/db/knowledge';
import { api } from '@/lib/messages';

export const dynamic = 'force-dynamic';

const VECTOR_STORE_ID = 'vs_69c069ceadc88191bbff088737bd11c3';

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: api.unauthorized }, { status: 401 });
  }

  const body = await request.json();
  const { query, limit = 10, scope, scope_id, client_id, project_id } = body;

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // If no OpenAI API key, use database full-text search as fallback
  if (!apiKey) {
    try {
      const results = searchKnowledge(query, {
        client_id: client_id || scope === 'client' ? scope_id : undefined,
        project_id: project_id || scope === 'project' ? scope_id : undefined,
        limit,
      });
      return NextResponse.json({ results, source: 'db' });
    } catch (e) {
      return NextResponse.json({ error: api.knowledge.searchUnavailable }, { status: 503 });
    }
  }

  try {
    const searchQuery = scope && scope_id
      ? `[${scope}:${scope_id}] ${query}`
      : query;

    const res = await fetch(`https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        query: searchQuery,
        max_num_results: limit,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      // Fall back to DB search on vector store errors
      try {
        const results = searchKnowledge(query, { limit });
        return NextResponse.json({ results, source: 'db', warning: `Vector store unavailable: ${err}` });
      } catch {
        return NextResponse.json({ error: `Vector store search failed: ${err}` }, { status: res.status });
      }
    }

    const data = await res.json();
    return NextResponse.json({ ...data, source: 'openai' });
  } catch (e) {
    // Graceful fallback to DB search
    try {
      const results = searchKnowledge(query, { limit });
      return NextResponse.json({ results, source: 'db' });
    } catch {
      return NextResponse.json({ error: api.internalError('search') }, { status: 500 });
    }
  }
}
