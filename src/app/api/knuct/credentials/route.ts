import { NextResponse } from 'next/server';
import { requireAuth, requireSection, requireRoles, requireWritableRoles } from '@/lib/auth-helpers';
import {
  getCredentialStats,
  getUserCredentials,
  issueCredential,
  isCredentialEnabled,
} from '@/lib/knuct/credential-service';
import type { CredentialType } from '@/lib/knuct/credential-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TYPES: CredentialType[] = [
  'attendance_certificate',
  'grade_transcript',
  'compliance_report',
];

export async function GET(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId') ?? session.user.id;
    const role = session.user.role;

    if (targetUserId !== session.user.id) {
      const { error: settingsError } = await requireSection('settings');
      if (settingsError) return settingsError;
      if (role !== 'super_admin' && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const [credentials, stats] = await Promise.all([
      getUserCredentials(targetUserId),
      targetUserId === session.user.id ? null : getCredentialStats(),
    ]);

    return NextResponse.json({
      enabled: isCredentialEnabled(),
      credentials,
      stats,
    });
  } catch (err) {
    console.error('[knuct] credentials GET error:', err);
    return NextResponse.json({ error: 'Failed to load credentials' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireSection('settings');
    if (error || !session) return error;

    const roleError = (await requireWritableRoles(['super_admin', 'admin'])).error;
    if (roleError) return roleError;

    const body = await request.json().catch(() => ({}));
    const userId = body.userId as string | undefined;
    const type = body.type as CredentialType | undefined;
    const resourceId = body.resourceId as string | undefined;
    const payload = (body.payload as Record<string, unknown>) ?? {};

    if (!userId || !type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: 'userId and valid type are required' },
        { status: 400 }
      );
    }

    const result = await issueCredential(userId, type, payload, resourceId);
    return NextResponse.json({ credential: result }, { status: 202 });
  } catch (err) {
    console.error('[knuct] credentials POST error:', err);
    return NextResponse.json({ error: 'Credential issue failed' }, { status: 500 });
  }
}
