import { NextRequest, NextResponse } from 'next/server';
import { getClient, updateClient, deleteClient, getClientStats } from '@/lib/db/clients';
import { parseRequest, updateClientSchema } from '@/lib/validation';
import type { ClientWithStats } from '@/lib/types';
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
    const client = getClient(id);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const stats = getClientStats(id);
    return NextResponse.json({ ...client, ...stats } satisfies ClientWithStats);
  } catch (error) {
    logger.error({ event: 'client_fetch_failed' }, error);
    return NextResponse.json({ error: api.internalError('fetch client') }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await parseRequest(request, updateClientSchema);

    const client = updateClient(id, body);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({ event: 'client_update_failed' }, error);
    return NextResponse.json({ error: api.internalError('update client') }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const deleted = deleteClient(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ event: 'client_delete_failed' }, error);
    return NextResponse.json({ error: api.internalError('delete client') }, { status: 500 });
  }
}
