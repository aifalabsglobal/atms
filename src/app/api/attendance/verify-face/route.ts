import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { verifyFaceMatch } from '@/lib/face-verification';

export async function POST(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const body = await request.json();
    const { selfieBase64 } = body;

    if (!selfieBase64) {
      return NextResponse.json({ error: 'selfieBase64 is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { profileImageUrl: true },
    });

    if (!user?.profileImageUrl) {
      return NextResponse.json({ error: 'No profile photo on file for verification' }, { status: 400 });
    }

    const result = await verifyFaceMatch(selfieBase64, user.profileImageUrl);
    return NextResponse.json({ ...result, configured: false, note: 'Automated face matching is not configured — selfie comparison is a demo stub' });
  } catch (error) {
    console.error('Face verification API error:', error);
    return NextResponse.json({ error: 'Face verification failed' }, { status: 500 });
  }
}
