/**
 * GET /api/knuct/privshare
 * Downloads the authenticated user's private share image (decrypted from DB).
 * The file is served as application/octet-stream with a .png content-disposition.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { decryptBuffer } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wallet = await db.knuctWallet.findUnique({
    where: { userId: session.user.id },
    select: { privShareEnc: true, did: true, status: true },
  });

  if (!wallet?.privShareEnc) {
    return NextResponse.json(
      { error: 'No private share found. Provision your wallet first.' },
      { status: 404 }
    );
  }

  try {
    const decrypted = decryptBuffer(Buffer.from(wallet.privShareEnc));
    const didSlug = wallet.did ? wallet.did.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '') : 'wallet';

    return new NextResponse(new Uint8Array(decrypted), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="knuct-privshare-${didSlug}.png"`,
        'Content-Length': String(decrypted.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to decrypt private share. Check KNUCT_PRIVSHARE_ENC_KEY.' },
      { status: 500 }
    );
  }
}
