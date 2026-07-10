#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDirectDatabaseUrl } from './lib/neon-direct-url.mjs';

/** Load .env into process.env when running outside Prisma CLI. */
function loadDotEnv() {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const direct = ensureDirectDatabaseUrl();
if (direct && direct !== process.env.DATABASE_URL) {
  console.log('[migrate] Using DIRECT_DATABASE_URL (Neon direct) for advisory locks');
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
