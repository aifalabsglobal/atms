import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireSection, resolveStudentId, SELF_MARK_METHODS } from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { verifyFaceMatch } from '@/lib/face-verification';
import { validateGeofenceLocation } from '@/lib/geofence';
import { captureMethodRequiresGeofence } from '@/lib/geofence-policy';
import { rateLimitByUser } from '@/lib/api-rate-limit';
import { logAudit, getClientIp } from '@/lib/audit';
import { getSystemConfig } from '@/lib/system-config';
import { uploadImageFromBase64, resolvePublicAssetUrl } from '@/lib/object-storage';

export async function POST(request: Request) {
  try {
    const { error, session } = await requireSection('attendance');
    if (error || !session) return error;

    const limited = await rateLimitByUser(request, session.user.id, 'attendance-mark', 20, 60_000);
    if (limited) return limited;

    const body = await request.json();
    const { sessionId, studentId: requestedStudentId, latitude, longitude, selfieBase64, captureMethod } = body;
    const method = captureMethod || 'self_geo_face';

    const role = session.user.role as Role;
    if (SELF_MARK_METHODS.includes(method as typeof SELF_MARK_METHODS[number]) && role !== 'student' && role !== 'parent') {
      return NextResponse.json({ error: 'Self-mark attendance is only available for students and parents' }, { status: 403 });
    }

    const { studentId, error: studentError } = await resolveStudentId(session, requestedStudentId ?? null);
    if (studentError) return studentError;
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    if (!sessionId || !studentId) {
      return NextResponse.json({ error: 'sessionId and studentId are required' }, { status: 400 });
    }

    const attendanceSession = await db.attendanceSession.findUnique({
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

    if (!attendanceSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (attendanceSession.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    const existing = await db.attendanceRecord.findFirst({
      where: { sessionId, studentId },
    });

    if (existing) {
      return NextResponse.json({ error: 'Attendance already marked for this session', record: existing }, { status: 409 });
    }

    const enrollment = await db.courseEnrollment.findFirst({
      where: { studentId, courseId: attendanceSession.courseId, status: 'enrolled' },
    });
    if (!enrollment) {
      return NextResponse.json({ error: 'You are not enrolled in this course' }, { status: 403 });
    }

    const sessionNeedsGeo =
      !!attendanceSession.geofence ||
      captureMethodRequiresGeofence(attendanceSession.captureMethod) ||
      captureMethodRequiresGeofence(method);

    const systemConfig = await getSystemConfig();
    const enforceGeofence =
      systemConfig.policies.geofenceSelfMarkRequired && sessionNeedsGeo;

    if (enforceGeofence && !attendanceSession.geofence) {
      return NextResponse.json(
        { error: 'This session requires geofence verification but no geofence is configured. Contact faculty.' },
        { status: 400 },
      );
    }

    let geofenceValidated = false;
    let distanceFromCenter: number | null = null;

    if (attendanceSession.geofence && enforceGeofence) {
      if (!attendanceSession.geofence.isActive) {
        return NextResponse.json({ error: 'Session geofence is inactive. Contact faculty.' }, { status: 400 });
      }

      if (latitude == null || longitude == null) {
        return NextResponse.json({ error: 'Location is required for this session (geofence active)' }, { status: 400 });
      }

      const { validated, distanceFromCenter: dist } = validateGeofenceLocation(
        attendanceSession.geofence,
        latitude,
        longitude,
      );
      distanceFromCenter = dist;
      geofenceValidated = validated;

      if (!geofenceValidated) {
        const radius = attendanceSession.geofence.radiusMtrs ?? 100;
        const msg =
          attendanceSession.geofence.type === 'polygon'
            ? `You are outside ${attendanceSession.geofence.name}`
            : `You are ${Math.round(dist ?? 0)}m away — must be within ${radius}m of ${attendanceSession.geofence.name}`;

        await logAudit({
          userId: session.user.id,
          action: 'attendance.geofence_denied',
          resource: `session:${sessionId}`,
          details: {
            studentId,
            geofenceId: attendanceSession.geofence.id,
            distanceFromCenter: dist,
            latitude,
            longitude,
          },
          ipAddress: getClientIp(request),
        });

        return NextResponse.json(
          {
            error: msg,
            geofenceValidated: false,
            distanceFromCenter: dist,
            radius: attendanceSession.geofence.type === 'circle' ? radius : undefined,
          },
          { status: 403 },
        );
      }
    }

    let selfieUrl: string | null = null;
    if (selfieBase64) {
      const uploaded = await uploadImageFromBase64(
        'selfies',
        `${studentId}-${Date.now()}`,
        selfieBase64,
      );
      selfieUrl = uploaded.url;
    }

    let faceVerified = false;
    let confidence: number | null = null;

    if (selfieBase64) {
      try {
        const student = await db.user.findUnique({ where: { id: studentId } });
        if (student?.profileImageUrl) {
          const profileForMatch = resolvePublicAssetUrl(student.profileImageUrl, new URL(request.url).origin);
          const result = await verifyFaceMatch(selfieBase64, profileForMatch);
          faceVerified = result.isMatch;
          confidence = result.confidence;
        }
      } catch (faceErr) {
        console.error('Face verification error (non-blocking):', faceErr);
      }

      if (systemConfig.policies.faceVerificationEnforced && !faceVerified) {
        return NextResponse.json(
          {
            error: 'Face verification failed — attendance not recorded. Ensure your profile photo is clear and try again.',
            faceVerified: false,
            confidence,
          },
          { status: 403 },
        );
      }
    }

    const record = await db.attendanceRecord.create({
      data: {
        sessionId,
        studentId,
        status: 'present',
        markedAt: new Date(),
        captureMethod: method,
        gpsLat: latitude ?? null,
        gpsLng: longitude ?? null,
        selfieUrl,
        faceVerified,
        geofenceValidated,
        distanceFromCenter,
        confidence,
      },
    });

    const presentCount = await db.attendanceRecord.count({ where: { sessionId, status: 'present' } });
    await db.attendanceSession.update({
      where: { id: sessionId },
      data: { presentCount },
    });

    return NextResponse.json(
      {
        success: true,
        record,
        geofenceValidated,
        faceVerified,
        distanceFromCenter,
        confidence,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Mark attendance API error:', error);
    return NextResponse.json({ error: 'Failed to mark attendance' }, { status: 500 });
  }
}
