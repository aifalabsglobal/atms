#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { ensureDirectDatabaseUrl } from './lib/neon-direct-url.mjs';

ensureDirectDatabaseUrl();

const maxAttempts = 3;
const retryDelayMs = 15_000;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  console.log(`[vercel-build] prisma migrate deploy (attempt ${attempt}/${maxAttempts})`);
  const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  if (migrate.status === 0) break;

  if (attempt >= maxAttempts) {
    console.error('[vercel-build] migrate deploy failed after retries');
    process.exit(migrate.status ?? 1);
  }

  console.warn(`[vercel-build] migrate failed — retrying in ${retryDelayMs / 1000}s (advisory lock / transient DB)`);
  await sleep(retryDelayMs);
}

console.log('[vercel-build] next build');
const build = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(build.status ?? 1);
