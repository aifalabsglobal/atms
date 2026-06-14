import fs from 'fs';
import path from 'path';

export interface FaceVerificationResult {
  isMatch: boolean;
  confidence: number | null;
  reason: string;
}

export function isFaceVerificationEnabled(): boolean {
  return process.env.FACE_VERIFICATION_ENABLED === 'true';
}

/**
 * Face verification: stub locally, or delegate to FACE_VERIFICATION_API_URL when enabled.
 */
export async function verifyFaceMatch(
  selfieBase64: string,
  profileImageUrl: string
): Promise<FaceVerificationResult> {
  if (!selfieBase64 || !profileImageUrl) {
    return {
      isMatch: false,
      confidence: null,
      reason: 'Selfie and profile image are required',
    };
  }

  const apiUrl = process.env.FACE_VERIFICATION_API_URL?.trim();
  if (isFaceVerificationEnabled() && apiUrl) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.FACE_VERIFICATION_API_KEY
            ? { Authorization: `Bearer ${process.env.FACE_VERIFICATION_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({ selfieBase64, profileImageUrl }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const data = (await res.json()) as Partial<FaceVerificationResult>;
        return {
          isMatch: !!data.isMatch,
          confidence: data.confidence ?? null,
          reason: data.reason || 'External face verification',
        };
      }
      console.warn('[face] external API failed:', res.status);
    } catch (err) {
      console.warn('[face] external API error:', err);
    }
  }

  if (isFaceVerificationEnabled() && !apiUrl) {
    return {
      isMatch: false,
      confidence: null,
      reason: 'Face verification enabled but FACE_VERIFICATION_API_URL is not set',
    };
  }

  const profileFullPath = path.join(process.cwd(), 'public', profileImageUrl.replace(/^\//, ''));
  if (!fs.existsSync(profileFullPath)) {
    return {
      isMatch: false,
      confidence: null,
      reason: 'Profile image not found on server',
    };
  }

  const selfieData = selfieBase64.replace(/^data:image\/\w+;base64,/, '');
  if (!selfieData || selfieData.length < 100) {
    return {
      isMatch: false,
      confidence: null,
      reason: 'Invalid or empty selfie image',
    };
  }

  return {
    isMatch: true,
    confidence: null,
    reason: 'Selfie captured; automated face matching is not configured',
  };
}
