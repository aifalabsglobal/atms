import fs from 'fs';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type ObjectStorageBackend = 's3' | 'local';

/** S3-compatible object store (AWS S3, Cloudflare R2, MinIO, etc.). */
export function isS3ObjectStorageConfigured(): boolean {
  return !!(
    process.env.S3_BUCKET?.trim() &&
    process.env.S3_ACCESS_KEY_ID?.trim() &&
    process.env.S3_SECRET_ACCESS_KEY?.trim()
  );
}

export function getObjectStorageBackend(): ObjectStorageBackend {
  return isS3ObjectStorageConfigured() ? 's3' : 'local';
}

function parseBase64Image(base64: string): Buffer {
  const data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(data, 'base64');
}

function contentTypeFromBase64(base64: string): string {
  const match = base64.match(/^data:(image\/\w+);base64,/);
  return match?.[1] ?? 'image/png';
}

function extensionFromContentType(contentType: string): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  return 'png';
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() || 'auto';
  s3Client = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
    },
  });
  return s3Client;
}

function publicUrlForKey(key: string): string {
  const base = process.env.S3_PUBLIC_URL?.trim();
  if (base) {
    return `${base.replace(/\/$/, '')}/${key}`;
  }
  const bucket = process.env.S3_BUCKET!.trim();
  const region = process.env.S3_REGION?.trim() || 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT?.trim();
  if (endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
  }
  if (region === 'us-east-1') {
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Upload a base64 image.
 * - Production on Vercel: configure S3-compatible storage (e.g. Cloudflare R2).
 * - Local dev: writes under public/ when S3 env vars are not set.
 */
export async function uploadImageFromBase64(
  folder: 'profiles' | 'selfies' | 'branding',
  filenameStem: string,
  base64: string,
): Promise<{ url: string; backend: ObjectStorageBackend }> {
  const contentType = contentTypeFromBase64(base64);
  const ext = extensionFromContentType(contentType);
  const buffer = parseBase64Image(base64);

  if (buffer.length < 16) {
    throw new Error('Invalid or empty image data');
  }

  return putObjectBuffer(folder, filenameStem, ext, buffer, contentType);
}

/**
 * Upload supporting evidence for condonation (image scan or PDF).
 * Max size enforced by callers.
 */
export async function uploadDocumentFromBase64(
  folder: 'condonation-docs',
  filenameStem: string,
  base64: string,
): Promise<{ url: string; backend: ObjectStorageBackend; contentType: string }> {
  const match = base64.match(/^data:([a-zA-Z0-9/+.-]+);base64,/);
  const contentType = match?.[1] ?? '';
  const allowed =
    contentType.startsWith('image/') ||
    contentType === 'application/pdf';
  if (!allowed) {
    throw new Error('Only image or PDF documents are allowed');
  }

  const raw = base64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length < 16) {
    throw new Error('Invalid or empty document data');
  }

  let ext = 'bin';
  if (contentType === 'application/pdf') ext = 'pdf';
  else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
  else if (contentType.includes('png')) ext = 'png';
  else if (contentType.includes('webp')) ext = 'webp';
  else if (contentType.includes('gif')) ext = 'gif';

  const result = await putObjectBuffer(folder, filenameStem, ext, buffer, contentType);
  return { ...result, contentType };
}

async function putObjectBuffer(
  folder: string,
  filenameStem: string,
  ext: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; backend: ObjectStorageBackend }> {
  const backend = getObjectStorageBackend();
  const key = `${folder}/${filenameStem}.${ext}`;

  if (backend === 's3') {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!.trim(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { url: publicUrlForKey(key), backend };
  }

  const dir = path.join(process.cwd(), 'public', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${filenameStem}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return { url: `/${folder}/${filename}`, backend };
}

/** Resolve a stored URL/path to an absolute URL for external services (face API). */
export function resolvePublicAssetUrl(storedUrl: string, requestOrigin?: string | null): string {
  if (storedUrl.startsWith('http://') || storedUrl.startsWith('https://')) {
    return storedUrl;
  }
  const origin =
    requestOrigin ??
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${origin.replace(/\/$/, '')}${storedUrl.startsWith('/') ? storedUrl : `/${storedUrl}`}`;
}
