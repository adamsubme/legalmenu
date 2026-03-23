import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VECTOR_STORE_ID = 'vs_69c069ceadc88191bbff088737bd11c3';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query, limit = 10 } = body;

  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.openai.com/v1/vector_stores/${VECTOR_STORE_ID}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        query,
        max_num_results: limit,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Vector store search failed: ${err}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
