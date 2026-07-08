#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { ensureDirectDatabaseUrl } from './lib/neon-direct-url.mjs';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://build:build@localhost:5432/build';
}
ensureDirectDatabaseUrl();

const result = spawnSync('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
