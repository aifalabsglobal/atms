import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSection, resolveStudentId } from '@/lib/auth-helpers';
import { getAttendanceThresholds } from '@/lib/system-config';
import { getStudentCondonationClearance } from '@/lib/condonation-service';
import { attendancePercentageFromCounts } from '@/lib/attendance-percentage';

export async function GET(request: Request) {
  try {
    const { error, session } = await requireSection('attendance');
    if (error || !session) return error;

    const { searchParams } = new URL(request.url);
    const { studentId, error: studentError } = await resolveStudentId(session, searchParams.get('studentId'));
    if (studentError) return studentError;
    if (!studentId) {
      return NextResponse.json({ error: 'Student scope required' }, { status: 403 });
    }

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { departmentId: true },
    });
    const thresholds = await getAttendanceThresholds({ departmentId: student?.departmentId });

    const [records, clearance] = await Promise.all([
      db.attendanceRecord.findMany({
        where: { studentId },
        include: {
          session: {
            select: {
              id: true,
              sessionDate: true,
              startTime: true,
              endTime: true,
              status: true,
              captureMethod: true,
              course: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      getStudentCondonationClearance(studentId),
    ]);

    const present = records.filter((r) => r.status === 'present').length;
    const late = records.filter((r) => r.status === 'late').length;
    const total = records.length;

    return NextResponse.json({
      records,
      thresholds: {
        eligibilityPct: thresholds.eligibilityPct,
        condonationPct: thresholds.condonationPct,
      },
      condonationClearance: clearance,
      summary: {
        total,
        present,
        late,
        percentage: attendancePercentageFromCounts({ present, late, total }),
      },
    });
  } catch (error) {
    console.error('My records API error:', error);
    return NextResponse.json({ error: 'Failed to load attendance records' }, { status: 500 });
  }
}
