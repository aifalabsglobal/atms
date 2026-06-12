import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import ZAI from 'z-ai-web-dev-sdk';

// Haversine formula for distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, studentId, latitude, longitude, selfieBase64, captureMethod } = body;

    if (!sessionId || !studentId) {
      return NextResponse.json({ error: 'sessionId and studentId are required' }, { status: 400 });
    }

    // Get the session with geofence
    const session = await db.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        geofence: { select: { name: true, centerLat: true, centerLng: true, radiusMtrs: true } },
        course: { select: { name: true, code: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    // Check if already marked
    const existing = await db.attendanceRecord.findFirst({
      where: { sessionId, studentId },
    });

    if (existing) {
      return NextResponse.json({ error: 'Attendance already marked for this session', record: existing }, { status: 409 });
    }

    // ── GEOFENCE VALIDATION ──
    let geofenceValidated = true;
    let distanceFromCenter: number | null = null;

    if (session.geofence && session.geofence.centerLat && session.geofence.centerLng) {
      if (latitude == null || longitude == null) {
        return NextResponse.json({ error: 'Location is required for this session (geofence active)' }, { status: 400 });
      }
      distanceFromCenter = haversineDistance(
        latitude, longitude,
        session.geofence.centerLat, session.geofence.centerLng
      );
      const radius = session.geofence.radiusMtrs ?? 100;
      geofenceValidated = distanceFromCenter <= radius;

      if (!geofenceValidated) {
        return NextResponse.json({
          error: `You are ${Math.round(distanceFromCenter)}m away — must be within ${radius}m of ${session.geofence.name}`,
          geofenceValidated: false,
          distanceFromCenter,
          radius,
        }, { status: 403 });
      }
    }

    // ── SAVE SELFIE ──
    let selfieUrl: string | null = null;
    if (selfieBase64) {
      const selfiesDir = path.join(process.cwd(), 'public', 'selfies');
      if (!fs.existsSync(selfiesDir)) fs.mkdirSync(selfiesDir, { recursive: true });
      const filename = `${studentId}-${Date.now()}.png`;
      const filepath = path.join(selfiesDir, filename);
      const base64Data = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
      selfieUrl = `/selfies/${filename}`;
    }

    // ── FACE VERIFICATION ──
    let faceVerified = false;
    let confidence: number | null = null;

    if (selfieBase64) {
      try {
        const student = await db.user.findUnique({ where: { id: studentId } });
        if (student?.profileImageUrl) {
          const zai = await ZAI.create();
          const selfieDataUrl = selfieBase64.startsWith('data:') ? selfieBase64 : `data:image/png;base64,${selfieBase64}`;
          const profileFullPath = path.join(process.cwd(), 'public', student.profileImageUrl);
          let profileDataUrl = student.profileImageUrl;
          if (fs.existsSync(profileFullPath)) {
            const imgBuffer = fs.readFileSync(profileFullPath);
            profileDataUrl = `data:image/png;base64,${imgBuffer.toString('base64')}`;
          }

          const vlmResponse = await zai.chat.completions.createVision({
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Compare these two photos. Is this the same person? Reply ONLY with JSON: {"isMatch": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}' },
                { type: 'image_url', image_url: { url: selfieDataUrl } },
                { type: 'image_url', image_url: { url: profileDataUrl } },
              ],
            }],
            thinking: { type: 'disabled' },
          });

          const content = vlmResponse.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            faceVerified = parsed.isMatch === true && (parsed.confidence ?? 0) >= 0.4;
            confidence = parsed.confidence ?? null;
          }
        }
      } catch (faceErr) {
        console.error('Face verification error (non-blocking):', faceErr);
        // Non-blocking: face verification failure doesn't prevent attendance
      }
    }

    // ── CREATE RECORD ──
    const record = await db.attendanceRecord.create({
      data: {
        sessionId,
        studentId,
        status: 'present',
        markedAt: new Date(),
        captureMethod: captureMethod || 'self_geo_face',
        gpsLat: latitude ?? null,
        gpsLng: longitude ?? null,
        selfieUrl,
        faceVerified,
        geofenceValidated,
        distanceFromCenter,
        confidence,
      },
    });

    // ── UPDATE SESSION COUNTS ──
    const presentCount = await db.attendanceRecord.count({ where: { sessionId, status: 'present' } });
    await db.attendanceSession.update({
      where: { id: sessionId },
      data: { presentCount },
    });

    return NextResponse.json({
      success: true,
      record,
      geofenceValidated,
      faceVerified,
      distanceFromCenter,
      confidence,
    }, { status: 201 });
  } catch (error) {
    console.error('Mark attendance API error:', error);
    return NextResponse.json({ error: 'Failed to mark attendance' }, { status: 500 });
  }
}
