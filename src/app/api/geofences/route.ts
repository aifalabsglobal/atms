import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
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
    const body = await request.json();
    const geofence = await db.geofence.create({ data: body });
    return NextResponse.json(geofence, { status: 201 });
  } catch (error) {
    console.error('Create geofence error:', error);
    return NextResponse.json({ error: 'Failed to create geofence' }, { status: 500 });
  }
}
