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

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Validate geofence create (full) or PATCH (partial) bodies.
 * For PATCH, pass existing.type when body.type is omitted.
 */
export function validateGeofenceBody(
  body: Record<string, unknown>,
  opts?: { partial?: boolean; existingType?: string },
): NextResponse | null {
  const partial = opts?.partial === true;

  if (!partial) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
  } else if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }
  }

  const fenceType =
    (typeof body.type === 'string' && body.type) ||
    opts?.existingType ||
    'circle';

  if (body.type !== undefined && body.type !== 'circle' && body.type !== 'polygon') {
    return NextResponse.json({ error: 'type must be circle or polygon' }, { status: 400 });
  }

  if (fenceType === 'circle') {
    const checkLat = !partial || body.centerLat !== undefined;
    const checkLng = !partial || body.centerLng !== undefined;
    const checkRadius = !partial || body.radiusMtrs !== undefined;

    if (checkLat) {
      const lat = asFiniteNumber(body.centerLat);
      if (lat == null) return NextResponse.json({ error: 'centerLat must be a valid number' }, { status: 400 });
      if (lat < -90 || lat > 90) {
        return NextResponse.json({ error: 'centerLat must be between -90 and 90' }, { status: 400 });
      }
    }
    if (checkLng) {
      const lng = asFiniteNumber(body.centerLng);
      if (lng == null) return NextResponse.json({ error: 'centerLng must be a valid number' }, { status: 400 });
      if (lng < -180 || lng > 180) {
        return NextResponse.json({ error: 'centerLng must be between -180 and 180' }, { status: 400 });
      }
    }
    if (checkRadius) {
      const radius = asFiniteNumber(body.radiusMtrs);
      if (radius == null) return NextResponse.json({ error: 'radiusMtrs must be a valid number' }, { status: 400 });
      if (radius < 10 || radius > 5000) {
        return NextResponse.json({ error: 'radiusMtrs must be between 10 and 5000' }, { status: 400 });
      }
    }
  }

  if (fenceType === 'polygon') {
    if (!partial && !body.polygonData) {
      return NextResponse.json({ error: 'Polygon geofences require polygonData' }, { status: 400 });
    }
    if (body.polygonData !== undefined && (typeof body.polygonData !== 'string' || !body.polygonData.trim())) {
      return NextResponse.json({ error: 'polygonData must be a non-empty string' }, { status: 400 });
    }
  }

  return null;
}

export function normalizeGeofenceWriteData(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.type !== undefined) data.type = body.type;
  if (body.centerLat !== undefined) data.centerLat = asFiniteNumber(body.centerLat);
  if (body.centerLng !== undefined) data.centerLng = asFiniteNumber(body.centerLng);
  if (body.radiusMtrs !== undefined) data.radiusMtrs = asFiniteNumber(body.radiusMtrs);
  if (body.polygonData !== undefined) data.polygonData = body.polygonData;
  if (body.building !== undefined) data.building = body.building === '' ? null : body.building;
  if (body.floor !== undefined) data.floor = body.floor === '' ? null : body.floor;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return data;
}
