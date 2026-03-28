import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUser, deleteUser } from '@/lib/db/users';
import type { UpdateUserRequest } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/users/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = getUser(id);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { password_hash: _, ...safeUser } = user as { password_hash?: string } & ReturnType<typeof getUser>;
    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT /api/users/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body: UpdateUserRequest = await request.json();

    if (body.role && !['admin', 'worker', 'client'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const user = updateUser(id, body);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { password_hash: _, ...safeUser } = user as { password_hash?: string } & ReturnType<typeof updateUser>;
    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = deleteUser(id);

    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
