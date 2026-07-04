import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth, STAFF_ROLES } from '@/lib/auth-helpers';
import { GEOFENCE_WRITE_ROLES, type Role } from '@/lib/store';
import { logAudit, getClientIp } from '@/lib/audit';
import { enqueueAnchor } from '@/lib/knuct/anchor-service';

const GEOFENCE_READ_ROLES: Role[] = [
  'super_admin', 'admin', 'hod', 'faculty', 'lab_assistant', 'security',
  'student', 'parent', 'visitor',
];

async function requireGeofenceRead() {
  const { error, session } = await requireAuth();
  if (error || !session) return { error, session: null };
  const role = session.user.role as Role;
  if (!GEOFENCE_READ_ROLES.includes(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

function validateGeofenceBody(body: Record<string, unknown>): NextResponse | null {
  const { name, type, centerLat, centerLng, radiusMtrs, polygonData } = body;
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const fenceType = (type as string) || 'circle';
  if (fenceType === 'circle') {
    if (centerLat == null || centerLng == null || radiusMtrs == null) {
      return NextResponse.json({ error: 'Circle geofences require centerLat, centerLng, and radiusMtrs' }, { status: 400 });
    }
  }
  if (fenceType === 'polygon' && !polygonData) {
    return NextResponse.json({ error: 'Polygon geofences require polygonData' }, { status: 400 });
  }
  return null;
}

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

    return NextResponse.json({ geofences });
  } catch (error) {
    console.error('Geofences API error:', error);
    return NextResponse.json({ error: 'Failed to load geofences' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireGeofenceRead();
    if (error || !session) return error;

    const role = session.user.role as Role;
    if (!GEOFENCE_WRITE_ROLES.includes(role) || !STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
