import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUser, deleteUser } from '@/lib/db/users';
import { verifySession } from '@/lib/auth';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: api.unauthorized }, { status: 401 });
  }

  const user = getUser(params.id);
  if (!user) {
      return NextResponse.json({ error: api.users.notFound }, { status: 404 });
  }

  // Users can see their own data, admins can see all
  if (session.userId !== params.id && session.role !== 'admin') {
    return NextResponse.json({ error: api.forbidden }, { status: 403 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: api.unauthorized }, { status: 401 });
  }

  // Only admin can update other users, regular users can only update themselves
  if (session.userId !== params.id && session.role !== 'admin') {
    return NextResponse.json({ error: api.forbidden }, { status: 403 });
  }

  try {
    const data = await request.json();
    const user = updateUser(params.id, data);
    if (!user) {
      return NextResponse.json({ error: api.users.notFound }, { status: 404 });
    }
    return NextResponse.json({ success: true, user });
  } catch (error) {
    logger.error({ event: 'user_update_failed' }, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifySession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: api.unauthorized }, { status: 401 });
  }

  const user = getUser(params.id);
  if (!user) {
      return NextResponse.json({ error: api.users.notFound }, { status: 404 });
  }

  if (user.role === 'admin') {
    return NextResponse.json({ error: api.users.cannotDeleteAdmin }, { status: 400 });
  }

  // Soft delete - deactivate
  updateUser(params.id, { is_active: false });
  return NextResponse.json({ success: true });
}
