import { NextRequest, NextResponse } from 'next/server';
import { listUsers, createUser } from '@/lib/db/users';
import type { CreateUserRequest, UserRole } from '@/lib/types';

type UserWithPassword = { password_hash?: string };

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') as UserRole | null;
    const isActive = searchParams.get('is_active');

    const users = listUsers({
      role: role || undefined,
      is_active: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    // Remove password_hash from response
    const safeUsers = users.map((u) => {
      const { password_hash: _, ...user } = u as UserWithPassword;
      return user;
    });

    return NextResponse.json(safeUsers);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const body: CreateUserRequest = await request.json();

    if (!body.email || !body.password || !body.name || !body.role) {
      return NextResponse.json({ error: 'Email, password, name, and role are required' }, { status: 400 });
    }

    if (!['admin', 'worker', 'client'].includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const user = createUser(body);
    const { password_hash: _, ...safeUser } = user as UserWithPassword;

    return NextResponse.json(safeUser, { status: 201 });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
