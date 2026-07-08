/**
 * Private share image utilities — ported from Knuct's privShare.js
 * All functions that touch the DOM (getImageData) must run client-side only.
 */
import md5 from 'md5';
import { isMobileDevice } from './device';

declare global {
  interface Window {
    cv?: {
      imread: (img: HTMLImageElement) => { data: Uint8Array; delete: () => void };
    };
  }
}

/**
 * Reads a File object's pixel data using Canvas (desktop) or OpenCV.js (mobile).
 * Matches Knuct vendor privShare.js behaviour.
 */
export function getImageData(
  file: File,
  callback: (data: Uint8Array) => void,
  errCallback?: (err: unknown) => void
): void {
  if (typeof callback !== 'function') throw new Error('callback must be a function');

  const img = new Image();

  img.onload = () => {
    try {
      if (!isMobileDevice()) {
        const cvs = document.createElement('canvas');
        const ctx = cvs.getContext('2d');
        if (!ctx) {
          errCallback?.(new Error('Canvas 2D context unavailable'));
          return;
        }
        cvs.width = img.width;
        cvs.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        callback(new Uint8Array(imgData.data.buffer));
        return;
      }

      const cv = window.cv;
      if (!cv?.imread) {
        errCallback?.(new Error('OpenCV.js is not loaded — wait for mobile OpenCV to finish loading'));
        return;
      }
      const mat = cv.imread(img);
      const imgData = mat.data;
      mat.delete();
      callback(imgData);
    } catch (err) {
      errCallback?.(err);
    }
  };

  img.onerror = (err) => errCallback?.(err);
  img.src = URL.createObjectURL(file);
}

/**
 * Strips the alpha channel from RGBA image data → RGB Uint8Array.
 */
export function removeAlphaChannel(imgData: Uint8Array): Uint8Array {
  if (imgData.length % 4 !== 0)
    throw new Error('Image data length is not a multiple of 4 (expected RGBA)');

  const len = imgData.length - imgData.length / 4;
  const out = new Uint8Array(len);

  for (let i = 0, j = 0; i < imgData.length; i += 4, j += 3) {
    out[j] = imgData[i];
    out[j + 1] = imgData[i + 1];
    out[j + 2] = imgData[i + 2];
  }
  return out;
}

/**
 * Computes the multihash-MD5 of the image bytes.
 * Prepends the md5 varint codec (0xd5, 0x01) and hash length (16).
 */
export function mhMd5(data: Uint8Array): number[] {
  const md5Code = 0xd5;
  const hashLength = 16;
  const hash: number[] = md5(data, { asBytes: true }) as unknown as number[];
  hash.unshift(hashLength);
  hash.unshift(0x01);
  hash.unshift(md5Code);
  return hash;
}

/**
 * Encodes data to multibase base32 (lowercase alphabet, 'b' prefix).
 * This produces the `hash` value for POST /sapi/auth/challenge.
 */
export function mbBase32(data: number[] | Uint8Array): string {
  const prefix = 'b';
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const bitsPerChar = 5;
  return prefix + baseEncode(data, alphabet, bitsPerChar);
}

/**
 * Full pipeline: File → privShare bytes + challenge hash string.
 * On mobile, call ensureOpenCvReady() before this function.
 */
export function computePrivShareHash(
  file: File
): Promise<{ privShare: Uint8Array; hash: string }> {
  return new Promise((resolve, reject) => {
    getImageData(
      file,
      (imgData) => {
        try {
          const privShare = removeAlphaChannel(imgData);
          const hashRaw = mhMd5(privShare);
          const hash = mbBase32(hashRaw);
          resolve({ privShare, hash });
        } catch (err) {
          reject(err);
        }
      },
      reject
    );
  });
}

function baseEncode(
  data: number[] | Uint8Array,
  alphabet: string,
  bitsPerChar: number
): string {
  const pad = alphabet[alphabet.length - 1] === '=';
  const mask = (1 << bitsPerChar) - 1;
  let out = '';
  let bits = 0;
  let buffer = 0;

  for (let i = 0; i < data.length; ++i) {
    buffer = (buffer << 8) | data[i];
    bits += 8;
    while (bits > bitsPerChar) {
      bits -= bitsPerChar;
      out += alphabet[mask & (buffer >> bits)];
    }
  }

  if (bits) out += alphabet[mask & (buffer << (bitsPerChar - bits))];
  if (pad) {
    while ((out.length * bitsPerChar) & 7) out += '=';
  }

  return out;
}
