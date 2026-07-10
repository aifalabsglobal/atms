import { NextResponse } from 'next/server';
import { requireSection } from '@/lib/auth-helpers';
import { getCategories } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { error } = await requireSection('settings');
    if (error) return error;
    return NextResponse.json({ categories: getCategories() });
  } catch (err) {
    console.error('[settings] categories error:', err);
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
  }
}
