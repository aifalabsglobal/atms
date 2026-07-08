#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { ensureDirectDatabaseUrl } from './lib/neon-direct-url.mjs';

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
