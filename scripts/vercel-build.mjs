#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { ensureDirectDatabaseUrl } from './lib/neon-direct-url.mjs';

function run(command, args, { capture = false } = {}) {
  return spawnSync(command, args, {
    stdio: capture ? 'pipe' : 'inherit',
    env: process.env,
    encoding: capture ? 'utf8' : undefined,
  });
}

function logDirectHost() {
  const direct = process.env.DIRECT_DATABASE_URL;
  if (!direct) return;
  try {
    const host = new URL(direct).hostname;
    console.log(`[vercel-build] migrate host: ${host}`);
  } catch {
    /* ignore */
  }
}

function isDatabaseUpToDate() {
  const result = run('npx', ['prisma', 'migrate', 'status'], { capture: true });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return (
    result.status === 0 ||
    output.includes('Database schema is up to date') ||
    output.includes('No pending migrations to apply')
  );
}

ensureDirectDatabaseUrl();
logDirectHost();

const maxAttempts = 5;
const retryDelayMs = 20_000;
let migrateOk = false;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  console.log(`[vercel-build] prisma migrate deploy (attempt ${attempt}/${maxAttempts})`);
  const migrate = run('npx', ['prisma', 'migrate', 'deploy']);

  if (migrate.status === 0) {
    migrateOk = true;
    break;
  }

  if (attempt >= maxAttempts) {
    if (isDatabaseUpToDate()) {
      console.warn(
        '[vercel-build] migrate deploy failed (likely advisory lock) but schema is up to date — continuing build'
      );
      migrateOk = true;
      break;
    }
    console.error('[vercel-build] migrate deploy failed and database is not up to date');
    process.exit(migrate.status ?? 1);
  }

  console.warn(
    `[vercel-build] migrate failed — retrying in ${retryDelayMs / 1000}s (Neon lock / transient DB)`
  );
  await sleep(retryDelayMs);
}

if (!migrateOk) {
  process.exit(1);
}

console.log('[vercel-build] next build');
const build = run('npx', ['next', 'build']);
process.exit(build.status ?? 1);
