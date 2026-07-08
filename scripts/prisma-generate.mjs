#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { ensureDirectDatabaseUrl } from './lib/neon-direct-url.mjs';

ensureDirectDatabaseUrl();

const result = spawnSync('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
