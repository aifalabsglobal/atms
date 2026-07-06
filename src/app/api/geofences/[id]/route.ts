import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { logAudit, getClientIp } from '@/lib/audit';
import { requireGeofenceWrite } from '@/lib/geofence-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireGeofenceWrite();
    if (error || !session) return error;

    const { id } = await context.params;
    const body = await request.json();

    const existing = await db.geofence.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Geofence not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) data.type = body.type;
    if (body.centerLat !== undefined) data.centerLat = body.centerLat;
    if (body.centerLng !== undefined) data.centerLng = body.centerLng;
    if (body.radiusMtrs !== undefined) data.radiusMtrs = body.radiusMtrs;
    if (body.polygonData !== undefined) data.polygonData = body.polygonData;
    if (body.building !== undefined) data.building = body.building;
    if (body.floor !== undefined) data.floor = body.floor;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const geofence = await db.geofence.update({ where: { id }, data });

    await logAudit({
      userId: session.user.id,
      action: 'geofence.update',
      resource: `geofence:${id}`,
      details: { fields: Object.keys(data) },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(geofence);
  } catch (error) {
    console.error('Update geofence error:', error);
    return NextResponse.json({ error: 'Failed to update geofence' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { error, session } = await requireGeofenceWrite();
    if (error || !session) return error;

    const { id } = await context.params;
    const existing = await db.geofence.findUnique({
      where: { id },
      include: { _count: { select: { attendanceSessions: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Geofence not found' }, { status: 404 });
    }
    if (existing._count.attendanceSessions > 0) {
      await db.geofence.update({ where: { id }, data: { isActive: false } });
      await logAudit({
        userId: session.user.id,
        action: 'geofence.deactivate',
        resource: `geofence:${id}`,
        details: { name: existing.name, reason: 'linked_sessions' },
        ipAddress: getClientIp(request),
      });
      return NextResponse.json({ message: 'Geofence deactivated (linked to attendance sessions)' });
    }

    await db.geofence.delete({ where: { id } });
    await logAudit({
      userId: session.user.id,
      action: 'geofence.delete',
      resource: `geofence:${id}`,
      details: { name: existing.name },
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ message: 'Geofence deleted' });
  } catch (error) {
    console.error('Delete geofence error:', error);
    return NextResponse.json({ error: 'Failed to delete geofence' }, { status: 500 });
  }
}
