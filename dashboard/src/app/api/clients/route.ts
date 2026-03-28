import { NextRequest, NextResponse } from 'next/server';
import { listClients, createClient, getClient, getClientStats } from '@/lib/db/clients';
import type { CreateClientRequest, ClientWithStats } from '@/lib/types';

// GET /api/clients - List all clients
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;

    const clients = listClients(search);

    // Add stats to each client
    const clientsWithStats: ClientWithStats[] = clients.map((client) => {
      const stats = getClientStats(client.id);
      return {
        ...client,
        ...stats,
      };
    });

    return NextResponse.json(clientsWithStats);
  } catch (error) {
    console.error('Failed to fetch clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const body: CreateClientRequest = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const client = createClient(body);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Failed to create client:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
