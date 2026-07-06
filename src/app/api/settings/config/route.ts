import { NextResponse } from 'next/server';
import { requireAuth, requireRoles, requireSection } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  getSystemConfigMeta,
  saveSystemConfig,
  resetSystemConfig,
  validateSystemConfig,
  parseSystemConfig,
} from '@/lib/system-config';

export async function GET() {
  try {
    const { error, session } = await requireSection('settings');
    if (error || !session) return error;

    const meta = await getSystemConfigMeta();
    return NextResponse.json(meta);
  } catch (err) {
    console.error('System config GET error:', err);
    return NextResponse.json({ error: 'Failed to load system configuration' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const limited = await enforceRateLimit(`config-save:${getClientIp(request) ?? 'anon'}`, 10, 60_000);
    if (limited) return limited;

    const { error, session } = await requireRoles(['super_admin']);
    if (error || !session) return error;

    const body = await request.json();

    if (body.reset === true) {
      const settings = await resetSystemConfig(session.user.id);
      await logAudit({
        userId: session.user.id,
        action: 'config.reset',
        resource: 'system:config',
        details: { eligibilityPct: settings.attendance.eligibilityPct },
        ipAddress: getClientIp(request),
      });
      const meta = await getSystemConfigMeta();
      return NextResponse.json({ ...meta, message: 'Configuration reset to defaults' });
    }

    const parsed = parseSystemConfig(body.settings ?? body);
    const validated = validateSystemConfig(parsed);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const settings = await saveSystemConfig(validated.settings, session.user.id);
    await logAudit({
      userId: session.user.id,
      action: 'config.update',
      resource: 'system:config',
      details: {
        eligibilityPct: settings.attendance.eligibilityPct,
        condonationPct: settings.attendance.condonationPct,
      },
      ipAddress: getClientIp(request),
    });

    const meta = await getSystemConfigMeta();
    return NextResponse.json({ ...meta, message: 'Configuration saved' });
  } catch (err) {
    console.error('System config PUT error:', err);
    const message = err instanceof Error ? err.message : 'Failed to save system configuration';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
