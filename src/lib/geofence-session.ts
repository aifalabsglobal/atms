import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { captureMethodRequiresGeofence } from '@/lib/geofence-policy';

export async function assertSessionGeofenceAssignment(
  captureMethod: string,
  geofenceId: string | null | undefined,
  buildingHint?: string | null,
): Promise<{ geofenceId: string | null; error: NextResponse | null }> {
  const method = captureMethod || 'manual';
  let resolvedId = geofenceId || null;

  if (!resolvedId && buildingHint && captureMethodRequiresGeofence(method)) {
    const match = await db.geofence.findFirst({
      where: {
        isActive: true,
        OR: [
          { building: { equals: buildingHint, mode: 'insensitive' } },
          { building: { contains: buildingHint, mode: 'insensitive' } },
          { name: { contains: buildingHint.split(' ')[0], mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (match) resolvedId = match.id;
  }

  if (captureMethodRequiresGeofence(method) && !resolvedId) {
    return {
      geofenceId: null,
      error: NextResponse.json(
        { error: `Capture method "${method}" requires an active geofence. Select a zone or link a timetable slot with a building.` },
        { status: 400 },
      ),
    };
  }

  if (resolvedId) {
    const geofence = await db.geofence.findUnique({
      where: { id: resolvedId },
      select: { id: true, isActive: true, name: true },
    });
    if (!geofence) {
      return {
        geofenceId: null,
        error: NextResponse.json({ error: 'Geofence not found' }, { status: 404 }),
      };
    }
    if (!geofence.isActive) {
      return {
        geofenceId: null,
        error: NextResponse.json(
          { error: `Geofence "${geofence.name}" is inactive. Choose an active zone.` },
          { status: 400 },
        ),
      };
    }
  }

  return { geofenceId: resolvedId, error: null };
}

export async function loadGeofenceForMark(sessionId: string) {
  return db.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      geofence: {
        select: {
          id: true,
          name: true,
          type: true,
          centerLat: true,
          centerLng: true,
          radiusMtrs: true,
          polygonData: true,
          isActive: true,
        },
      },
      course: { select: { name: true, code: true, id: true } },
    },
  });
}
