import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSection, STAFF_ROLES } from '@/lib/auth-helpers';
import { logAudit, getClientIp } from '@/lib/audit';
import { enqueueAnchor } from '@/lib/knuct/anchor-service';

export async function GET() {
  try {
    const { error } = await requireSection('geofences');
    if (error) return error;
    const geofences = await db.geofence.findMany({
      include: { _count: { select: { attendanceSessions: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ geofences });
  } catch (error) {
    console.error('Geofences API error:', error);
    return NextResponse.json({ error: 'Failed to load geofences' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireSection('geofences');
    if (error || !session) return error;
    if (!STAFF_ROLES.includes(session.user.role as (typeof STAFF_ROLES)[number])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const geofence = await db.geofence.create({ data: body });

    await logAudit({
      userId: session.user.id,
      action: 'geofence.create',
      resource: `geofence:${geofence.id}`,
      details: { name: geofence.name },
      ipAddress: getClientIp(request),
    });

    enqueueAnchor('geofence_policy', geofence.id, {
      name: geofence.name,
      centerLat: geofence.centerLat,
      centerLng: geofence.centerLng,
      radiusMtrs: geofence.radiusMtrs,
      createdBy: session.user.id,
      createdAt: geofence.createdAt.toISOString(),
    });

    return NextResponse.json(geofence, { status: 201 });
  } catch (error) {
    console.error('Create geofence error:', error);
    return NextResponse.json({ error: 'Failed to create geofence' }, { status: 500 });
  }
}
