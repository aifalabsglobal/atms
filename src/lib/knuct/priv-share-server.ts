/**
 * Server-side privshare hash pipeline for E2E tests (sharp decodes PNG → same hash as browser Canvas path).
 */
import sharp from 'sharp';
import { mhMd5, mbBase32, removeAlphaChannel } from './priv-share';

export async function computePrivShareHashFromBuffer(
  imageBuffer: Buffer
): Promise<{ privShare: Uint8Array; hash: string }> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    throw new Error(`Expected RGBA image, got ${info.channels} channels`);
  }

  const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const privShare = removeAlphaChannel(rgba);
  const hash = mbBase32(mhMd5(privShare));
  return { privShare, hash };
}
