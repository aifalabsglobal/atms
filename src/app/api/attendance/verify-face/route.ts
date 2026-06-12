import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { selfieBase64, profileImageUrl } = body;

    if (!selfieBase64 || !profileImageUrl) {
      return NextResponse.json({ error: 'selfieBase64 and profileImageUrl are required' }, { status: 400 });
    }

    const zai = await ZAI.create();

    const selfieDataUrl = selfieBase64.startsWith('data:') ? selfieBase64 : `data:image/png;base64,${selfieBase64}`;

    // Try to read profile image from disk for better quality
    let profileDataUrl = profileImageUrl;
    const profileFullPath = path.join(process.cwd(), 'public', profileImageUrl);
    if (fs.existsSync(profileFullPath)) {
      const imgBuffer = fs.readFileSync(profileFullPath);
      profileDataUrl = `data:image/png;base64,${imgBuffer.toString('base64')}`;
    }

    const response = await zai.chat.completions.createVision({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Compare these two photos carefully. Is this the same person? Reply ONLY with JSON: {"isMatch": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}' },
          { type: 'image_url', image_url: { url: selfieDataUrl } },
          { type: 'image_url', image_url: { url: profileDataUrl } },
        ],
      }],
      thinking: { type: 'disabled' },
    });

    const content = response.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        isMatch: parsed.isMatch ?? false,
        confidence: parsed.confidence ?? 0,
        reason: parsed.reason ?? 'No reason provided',
      });
    }

    return NextResponse.json({
      isMatch: false,
      confidence: 0,
      reason: 'Could not parse face comparison result',
    });
  } catch (error) {
    console.error('Face verification API error:', error);
    return NextResponse.json({ error: 'Face verification failed' }, { status: 500 });
  }
}
