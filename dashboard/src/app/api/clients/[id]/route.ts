import { NextRequest, NextResponse } from 'next/server';
import { getClient, updateClient, deleteClient, getClientStats } from '@/lib/db/clients';
import type { UpdateClientRequest, ClientWithStats } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id] - Get a single client
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const client = getClient(id);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const stats = getClientStats(id);
    const clientWithStats: ClientWithStats = { ...client, ...stats };

    return NextResponse.json(clientWithStats);
  } catch (error) {
    console.error('Failed to fetch client:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

// PUT /api/clients/[id] - Update a client
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body: UpdateClientRequest = await request.json();

    const client = updateClient(id, body);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('Failed to update client:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

// DELETE /api/clients/[id] - Delete a client
export async function DELETE(
  request: NextRequest,
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
    console.error('Failed to delete client:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
