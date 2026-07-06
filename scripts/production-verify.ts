/**
 * Production readiness gate — run: npm run verify:production
 * Requires dev server at BASE_URL (default http://localhost:3000) for API checks.
 */
import { spawnSync } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

type Step = { name: string; run: () => boolean | Promise<boolean> };

function runNpm(script: string): boolean {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    stdio: 'inherit',
    shell: true,
  });
  return result.status === 0;
}

async function waitForServer(maxMs = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

const steps: Step[] = [
  { name: 'TypeScript (typecheck)', run: () => runNpm('typecheck') },
  { name: 'Timetable unit tests', run: () => runNpm('test:timetable') },
  { name: 'Geofence policy unit tests', run: () => runNpm('test:geofence') },
  { name: 'Dedupe active slot sessions', run: () => runNpm('db:dedupe-slot-sessions') },
  {
    name: 'Dev server reachable',
    run: async () => {
      const ok = await waitForServer();
      if (!ok) console.error(`  Server not running at ${BASE} — start with: npm run dev`);
      return ok;
    },
  },
  { name: 'Geofence integration verify', run: () => runNpm('verify:geofences') },
  { name: 'Timetable integration verify', run: () => runNpm('verify:timetable') },
  { name: 'Production build', run: () => runNpm('build') },
];

async function main() {
  console.log('Production readiness verification\n');
  let passed = 0;

  for (const step of steps) {
    process.stdout.write(`→ ${step.name}... `);
    try {
      const ok = await step.run();
      if (ok) {
        passed++;
        console.log('OK');
      } else {
        console.log('FAILED');
        process.exitCode = 1;
        break;
      }
    } catch (err) {
      console.log('FAILED');
      console.error(err);
      process.exitCode = 1;
      break;
    }
  }

  console.log(`\n${passed}/${steps.length} production gates passed`);
  if (process.exitCode) process.exit(process.exitCode);
  console.log('\nProduction ready.');
}

main();
