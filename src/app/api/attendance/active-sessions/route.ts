import { db } from '@/lib/db';
import { isFaceVerificationEnabled } from '@/lib/face-verification';
import { NextResponse } from 'next/server';
import { requireSection, resolveStudentId, getCampusScope, buildCourseIdFilter } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireSection('attendance');
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const { studentId, error: studentError } = await resolveStudentId(session, searchParams.get('studentId'));
    if (studentError) return studentError;

    const where: Record<string, unknown> = { status: 'active' };

    if (studentId) {
      const enrollments = await db.courseEnrollment.findMany({
        where: { studentId, status: 'enrolled' },
        select: { courseId: true },
      });
      const enrolledIds = enrollments.map((e) => e.courseId);
      where.courseId = { in: enrolledIds.length > 0 ? enrolledIds : ['__none__'] };
    } else {
      const scope = await getCampusScope(session);
      const courseFilter = buildCourseIdFilter(scope);
      if (courseFilter) where.courseId = courseFilter;
    }

    const sessions = await db.attendanceSession.findMany({
      where,
      include: {
        course: { select: { name: true, code: true } },
        geofence: { select: { name: true, type: true, centerLat: true, centerLng: true, radiusMtrs: true, polygonData: true } },
        timetableSlot: { select: { roomNumber: true, building: true, startTime: true, endTime: true } },
        creator: { select: { name: true } },
        records: studentId ? { where: { studentId } } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = sessions.map((s) => {
      const alreadyMarked = studentId ? (s.records as unknown[]).length > 0 : false;
      const existingRecord = studentId && (s.records as unknown[]).length > 0 ? (s.records as { id: string; status: string; faceVerified: boolean; geofenceValidated: boolean; selfieUrl?: string; gpsLat?: number; gpsLng?: number; confidence?: number; distanceFromCenter?: number; captureMethod: string }[])[0] : null;
      const { records: _records, ...rest } = s;
      void _records;
      return { ...rest, alreadyMarked, existingRecord };
    });

    return NextResponse.json({
      sessions: enriched,
      total: enriched.length,
      faceVerificationConfigured: isFaceVerificationEnabled() && Boolean(process.env.FACE_VERIFICATION_API_URL?.trim()),
    });
  } catch (error) {
    console.error('Active sessions API error:', error);
    return NextResponse.json({ error: 'Failed to load active sessions' }, { status: 500 });
  }
}
