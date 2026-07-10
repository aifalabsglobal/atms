import { rateLimitByUser } from '@/lib/api-rate-limit';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAudit, getClientIp } from '@/lib/audit';
import { enqueueAnchor } from '@/lib/knuct/anchor-service';
import { requireGeofenceRead, requireGeofenceWrite, validateGeofenceBody } from '@/lib/geofence-api';
import { getSystemConfig } from '@/lib/system-config';

export async function GET(request: Request) {
  try {
    const { error } = await requireGeofenceRead();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const geofences = await db.geofence.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { _count: { select: { attendanceSessions: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const config = await getSystemConfig();

    return NextResponse.json({
      geofences,
      defaults: { radiusMeters: config.geofence.defaultRadiusMeters },
    });
  } catch (error) {
    console.error('Geofences API error:', error);
    return NextResponse.json({ error: 'Failed to load geofences' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireGeofenceWrite();
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'geofence-create', 20, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const validationError = validateGeofenceBody(body);
    if (validationError) return validationError;

    const geofence = await db.geofence.create({
      data: {
        name: body.name,
        type: body.type || 'circle',
        centerLat: body.centerLat ?? null,
        centerLng: body.centerLng ?? null,
        radiusMtrs: body.radiusMtrs ?? null,
        polygonData: body.polygonData ?? null,
        building: body.building ?? null,
        floor: body.floor ?? null,
        isActive: body.isActive ?? true,
      },
    });

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
