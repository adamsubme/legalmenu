import { NextRequest, NextResponse } from 'next/server';
import { listCaseMessages, createCaseMessage } from '@/lib/db/case-chat';
import { logCommentAdded } from '@/lib/db/case-timeline';
import type { CreateCaseMessageRequest } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/[id]/messages - List messages for a task
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before') || undefined;

    const messages = listCaseMessages(id, { limit, before });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST /api/tasks/[id]/messages - Create a new message
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body: CreateCaseMessageRequest & { user_id?: string; user_name?: string } = await request.json();

    if (!body.content || !body.content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Set sender info if not provided
    if (!body.sender_id) {
      body.sender_id = body.user_id || 'unknown';
    }
    if (!body.sender_name) {
      body.sender_name = body.user_name || 'User';
    }
    if (!body.sender_type) {
      body.sender_type = 'user';
    }

    const message = createCaseMessage(id, body);

    // Also log to timeline
    logCommentAdded(id, body.content.slice(0, 100), body.user_id);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Failed to create message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
