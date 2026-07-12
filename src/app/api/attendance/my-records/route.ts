import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSection, resolveStudentId } from '@/lib/auth-helpers';
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

    const records = await db.attendanceRecord.findMany({
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
    });

    const present = records.filter((r) => r.status === 'present').length;
    const late = records.filter((r) => r.status === 'late').length;
    const total = records.length;

    return NextResponse.json({
      records,
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
