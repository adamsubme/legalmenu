import { NextRequest, NextResponse } from 'next/server';
import { listClients, createClient, getClientStats } from '@/lib/db/clients';
import { parseRequest, createClientSchema } from '@/lib/validation';
import type { ClientWithStats } from '@/lib/types';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;

    const clients = listClients(search);

    const clientsWithStats: ClientWithStats[] = clients.map((client) => {
      const stats = getClientStats(client.id);
      return { ...client, ...stats };
    });

    return NextResponse.json(clientsWithStats);
  } catch (error) {
    logger.error({ event: 'clients_fetch_failed' }, error);
    return NextResponse.json({ error: api.internalError('fetch clients') }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseRequest(request, createClientSchema);
    const client = createClient(body);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({ event: 'client_create_failed' }, error);
    return NextResponse.json({ error: api.internalError('create client') }, { status: 500 });
  }
}
