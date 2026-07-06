/**
 * NLSS (Non-Linear Signature Scheme) — ported from Knuct's nlss.js
 * Computes a challenge-response signature using the private share image bytes.
 * Must run client-side (browser) only — private share never leaves the device.
 */
import { sha3_256 } from 'js-sha3';

/**
 * Given a challenge hex string and the private share bytes,
 * produces a binary response array to send to /sapi/auth/response.
 *
 * @param challenge  - hex string from /sapi/auth/challenge response
 * @param positionCount - always 32 per Knuct spec
 * @param privShare  - Uint8Array of the private share image (alpha stripped)
 * @returns number[] - array of 0s and 1s (length = positionCount * 8 = 256)
 */
export function createChallengeResponse(
  challenge: string,
  positionCount: number,
  privShare: Uint8Array
): number[] {
  return generateSignature(challenge, positionCount, privShare);
}

function generateSignature(
  hash: string,
  positionCount: number,
  pvtShare: Uint8Array
): number[] {
  const [, signPosition] = randomPosition('sign', hash, positionCount, pvtShare);
  return getPvtPositions(signPosition, pvtShare);
}

function randomPosition(
  role: 'sign' | 'verify',
  hash: string,
  positionCount: number,
  pvtShare_or_sign: Uint8Array | number[]
): [number[], number[]] {
  let u = 0,
    m = 0;

  const signPosition = new Array<number>(positionCount * 8).fill(0);
  const originalPosition = new Array<number>(positionCount).fill(0);

  for (let i = 0; i < positionCount; i++) {
    const hashChar = getNumericValue(hash.charAt(i));
    const detVal = (((2402 + hashChar) * 2709) + ((i + 2709) + hashChar)) % 2048;

    originalPosition[i] = (detVal >> 3) << 3; // Math.floor(detVal/8) * 8

    const positionArray = new Array<number>(positionCount).fill(0);
    const finalPosition = new Array<number>(8).fill(0);

    positionArray[i] = originalPosition[i];

    let l = 0;
    for (let p = 0; p < 8; p++) {
      signPosition[u] = positionArray[i];
      finalPosition[l] = positionArray[i];
      positionArray[i]++;
      u++;
      l++;
    }

    if (role === 'sign') {
      const ptSign = getPvtPositions(finalPosition, pvtShare_or_sign as Uint8Array);
      hash = sha3_256(hash + intArray2Str(originalPosition) + intArray2Str(ptSign));
    } else {
      const p1 = (pvtShare_or_sign as number[]).slice(m, m + 8);
      m += 8;
      hash = sha3_256(hash + intArray2Str(originalPosition) + intArray2Str(p1));
    }
  }

  return [originalPosition, signPosition];
}

/**
 * Mimics Java's Character.getNumericValue():
 * '0'–'9' → 0–9, 'a'–'z'/'A'–'Z' → 10–35, else -1
 */
function getNumericValue(ch: string): number {
  const code = ch.charCodeAt(0);
  if (code >= '0'.charCodeAt(0) && code <= '9'.charCodeAt(0))
    return code - '0'.charCodeAt(0);
  if (code >= 'a'.charCodeAt(0) && code <= 'z'.charCodeAt(0))
    return code - 'a'.charCodeAt(0) + 10;
  if (code >= 'A'.charCodeAt(0) && code <= 'Z'.charCodeAt(0))
    return code - 'A'.charCodeAt(0) + 10;
  return -1;
}

/** Mimics Java intArray2Str — converts array to a string of "0" and "1" */
function intArray2Str(array: number[]): string {
  return array.map((v) => (v === 1 ? '1' : '0')).join('');
}

function getPvtPositions(positions: number[], pvtShare: Uint8Array | number[]): number[] {
  return positions.map((pos) => getShareBinDigit(pvtShare, pos));
}

/** Gets the bit at `index` position in pvtShare */
function getShareBinDigit(pvtShare: Uint8Array | number[], index: number): number {
  const q = Math.floor(index / 8);
  const r = index % 8;
  const byte = (pvtShare as Uint8Array)[q];
  return byte & (0x80 >> r) ? 1 : 0;
}
