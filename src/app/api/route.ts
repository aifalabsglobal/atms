import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  return NextResponse.json({ status: 'ok', service: 'AIMSCS API' });
}
