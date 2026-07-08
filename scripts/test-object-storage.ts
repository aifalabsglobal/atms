/**
 * Smoke-test Cloudflare R2 / S3 object storage.
 * Usage: npx tsx --env-file=.env scripts/test-object-storage.ts
 */
import { uploadImageFromBase64, getObjectStorageBackend } from '../src/lib/object-storage';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  const backend = getObjectStorageBackend();
  console.log('Backend:', backend);

  if (backend === 'local') {
    console.warn('S3_* env vars not set — would use local public/ folder.');
    console.warn('Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (and S3_ENDPOINT for R2).');
    process.exit(1);
  }

  const { url, backend: used } = await uploadImageFromBase64(
    'profiles',
    `r2-test-${Date.now()}`,
    TINY_PNG,
  );

  console.log('Upload OK');
  console.log('Backend:', used);
  console.log('Public URL:', url);
  console.log('Open the URL in a browser — you should see a 1×1 pixel image.');
}

main().catch((err) => {
  console.error('R2 test failed:', err);
  process.exit(1);
});
