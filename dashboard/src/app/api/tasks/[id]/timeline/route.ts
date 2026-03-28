import { NextRequest, NextResponse } from 'next/server';
import { listTimeline, createTimelineEvent, getTimelineSummary } from '@/lib/db/case-timeline';
import type { CreateTimelineEventRequest, TimelineEventType } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/[id]/timeline - List timeline events for a task
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('event_type') as TimelineEventType | null;
    const limit = parseInt(searchParams.get('limit') || '100');
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      const timelineSummary = getTimelineSummary(id);
      return NextResponse.json(timelineSummary);
    }

    const events = listTimeline(id, { event_type: eventType || undefined, limit });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Failed to fetch timeline:', error);
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}

// POST /api/tasks/[id]/timeline - Create a new timeline event
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body: CreateTimelineEventRequest = await request.json();

    if (!body.event_type || !body.description) {
      return NextResponse.json({ error: 'Event type and description are required' }, { status: 400 });
    }

    const event = createTimelineEvent(id, body);

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Failed to create timeline event:', error);
    return NextResponse.json({ error: 'Failed to create timeline event' }, { status: 500 });
  }
}
