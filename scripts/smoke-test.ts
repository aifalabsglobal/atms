/**
 * Full smoke test — run: npx tsx scripts/smoke-test.ts
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

type Result = { name: string; ok: boolean; detail: string; ms?: number };

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const value = await fn();
  return [value, Date.now() - start];
}

function getCookieHeader(setCookie: string | null): string {
  if (!setCookie) return '';
  const parts = setCookie.split(/,(?=\s*[^;]+=[^;]+)/);
  return parts.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

async function main() {
  const results: Result[] = [];
  let cookie = '';

  async function check(name: string, fn: () => Promise<void>) {
    try {
      const [, ms] = await timed(fn);
      results.push({ name, ok: true, detail: 'pass', ms });
    } catch (e) {
      results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  await check('GET /login', async () => {
    const res = await fetch(`${BASE}/login`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const html = await res.text();
    if (!html.includes('JNTUH SCMS')) throw new Error('missing branding');
  });

  await check('GET /api unauthenticated', async () => {
    const res = await fetch(`${BASE}/api`);
    if (res.status !== 401) throw new Error(`expected 401 got ${res.status}`);
  });

  await check('POST login (Super Admin)', async () => {
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();
    cookie = getCookieHeader(csrfRes.headers.get('set-cookie'));

    const body = new URLSearchParams({
      email: 'vice.chancellor@jntuh.ac.in',
      password: 'demo123',
      csrfToken,
      callbackUrl: `${BASE}/`,
      json: 'true',
    });

    const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body,
      redirect: 'manual',
    });
    const loginCookie = getCookieHeader(loginRes.headers.get('set-cookie'));
    if (loginCookie) cookie = [cookie, loginCookie].filter(Boolean).join('; ');
    if (loginRes.status !== 200) throw new Error(`login status ${loginRes.status}`);
  });

  await check('GET /api/auth/session', async () => {
    const res = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } });
    const data = await res.json();
    if (!data?.user?.email?.includes('vice.chancellor')) throw new Error('session missing user');
    if (data.user.role !== 'super_admin') throw new Error(`wrong role: ${data.user.role}`);
  });

  const apiChecks: [string, string, (d: Record<string, unknown>) => void][] = [
    ['GET /api/dashboard', '/api/dashboard', (d) => {
      const stats = d.stats as Record<string, number> | undefined;
      if (!stats || typeof stats.totalStudents !== 'number') throw new Error('bad stats');
    }],
    ['GET /api/users', '/api/users?limit=5', (d) => {
      if (!Array.isArray(d.departments) || (d.departments as string[]).length < 5) throw new Error('departments missing');
      if (typeof d.total !== 'number' || d.total < 1) throw new Error('no users');
    }],
    ['GET /api/geofences', '/api/geofences', (d) => {
      if (!Array.isArray(d.geofences) || (d.geofences as unknown[]).length < 1) throw new Error('no geofences');
    }],
    ['GET /api/lms/courses', '/api/lms/courses?limit=5', (d) => {
      if (!Array.isArray(d.courses)) throw new Error('no courses');
    }],
    ['GET /api/attendance/violations', '/api/attendance/violations?limit=1', (d) => {
      if (typeof d.total !== 'number') throw new Error('bad violations response');
    }],
    ['GET /api/masters/departments', '/api/masters/departments?limit=5', (d) => {
      if (!Array.isArray(d.departments)) throw new Error('masters departments missing');
    }],
  ];

  for (const [name, path, validate] of apiChecks) {
    await check(name, async () => {
      const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      validate(data as Record<string, unknown>);
    });
  }

  await check('Student login', async () => {
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();
    let studentCookie = getCookieHeader(csrfRes.headers.get('set-cookie'));
    const body = new URLSearchParams({
      email: 'student.ravi@jntuh.ac.in',
      password: 'demo123',
      csrfToken,
      callbackUrl: `${BASE}/`,
      json: 'true',
    });
    const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: studentCookie },
      body,
    });
    const extra = getCookieHeader(loginRes.headers.get('set-cookie'));
    if (extra) studentCookie = [studentCookie, extra].filter(Boolean).join('; ');
    const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: studentCookie } });
    const session = await sessionRes.json();
    if (session.user.role !== 'student') throw new Error(`expected student got ${session.user.role}`);
    const dashRes = await fetch(`${BASE}/api/dashboard`, { headers: { Cookie: studentCookie } });
    if (!dashRes.ok) throw new Error(`student dashboard ${dashRes.status}`);
    const dash = await dashRes.json();
    if (dash.scope !== 'student') throw new Error(`scope ${dash.scope}`);
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log('\n=== JNTUH SCMS Smoke Test ===\n');
  for (const r of results) {
    const icon = r.ok ? 'PASS' : 'FAIL';
    const ms = r.ms != null ? ` (${r.ms}ms)` : '';
    console.log(`${icon}  ${r.name}${ms}${r.ok ? '' : ` — ${r.detail}`}`);
  }
  console.log(`\n${passed}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error('smoke_test_crash', e);
  process.exit(1);
});
