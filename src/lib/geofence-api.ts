import { NextResponse } from 'next/server';
import { requireSection, STAFF_ROLES } from '@/lib/auth-helpers';
import { GEOFENCE_WRITE_ROLES, type Role } from '@/lib/store';

export async function requireGeofenceRead() {
  return requireSection('geofences');
}

export async function requireGeofenceWrite() {
  const { error, session } = await requireSection('geofences');
  if (error || !session) return { error, session: null };
  const role = session.user.role as Role;
  if (!GEOFENCE_WRITE_ROLES.includes(role) || !STAFF_ROLES.includes(role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export function validateGeofenceBody(body: Record<string, unknown>): NextResponse | null {
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
