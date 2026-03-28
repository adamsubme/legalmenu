import { NextRequest, NextResponse } from 'next/server';
import { listUsers, createUser, updateUser, getUser, getUserByEmail } from '@/lib/db/users';
import { verifySession } from '@/lib/auth';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: api.unauthorized }, { status: 401 });
  }
  
  if (session.role !== 'admin') {
      return NextResponse.json({ error: api.users.adminOnly }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') as any;
  
  const users = listUsers(role ? { role } : undefined);
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: api.unauthorized }, { status: 401 });
  }
  
  if (session.role !== 'admin') {
      return NextResponse.json({ error: api.users.adminOnly }, { status: 403 });
  }

  try {
    const { email, password, name, role } = await request.json();
    
    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: api.users.allFieldsRequired }, { status: 400 });
    }

    const existing = getUserByEmail(email.toLowerCase());
    if (existing) {
      return NextResponse.json({ error: api.users.alreadyExists }, { status: 400 });
    }

    const user = createUser({
      email: email.toLowerCase(),
      password,
      name,
      role
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    logger.error({ event: 'user_create_failed' }, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
