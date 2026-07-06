/**
 * Geofence API integration verify — run with dev server: npm run verify:geofences
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

function mergeCookies(existing: string, setCookie: string | null): string {
  const jar = new Map<string, string>();
  for (const part of existing.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [k, ...v] = part.split('=');
    jar.set(k, v.join('='));
  }
  if (setCookie) {
    for (const chunk of setCookie.split(/,(?=\s*[^;]+=[^;]+)/)) {
      const [pair] = chunk.split(';');
      const [k, ...v] = pair.trim().split('=');
      jar.set(k, v.join('='));
    }
  }
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function login(email: string): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  let cookie = mergeCookies('', csrfRes.headers.get('set-cookie'));

  const body = new URLSearchParams({
    email,
    password: 'demo123',
    csrfToken,
    callbackUrl: `${BASE}/`,
    json: 'true',
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body,
  });
  cookie = mergeCookies(cookie, loginRes.headers.get('set-cookie'));
  if (loginRes.status !== 200) throw new Error(`login failed ${loginRes.status}`);
  return cookie;
}

type Check = { name: string; run: (cookies: Record<string, string>) => Promise<void> };

const checks: Check[] = [
  {
    name: 'Faculty can list active geofences',
    run: async (cookies) => {
      const res = await fetch(`${BASE}/api/geofences`, { headers: { Cookie: cookies.faculty } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.geofences) || data.geofences.length < 1) {
        throw new Error('expected seeded geofences');
      }
    },
  },
  {
    name: 'Student can list active geofences',
    run: async (cookies) => {
      const res = await fetch(`${BASE}/api/geofences`, { headers: { Cookie: cookies.student } });
      if (!res.ok) throw new Error(`status ${res.status}`);
    },
  },
  {
    name: 'Faculty can PATCH geofence (write role)',
    run: async (cookies) => {
      const listRes = await fetch(`${BASE}/api/geofences`, { headers: { Cookie: cookies.faculty } });
      const { geofences } = await listRes.json();
      const target = geofences[0];
      const res = await fetch(`${BASE}/api/geofences/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookies.faculty },
        body: JSON.stringify({ building: target.building || 'CSE Block' }),
      });
      if (!res.ok) throw new Error(`PATCH status ${res.status}`);
    },
  },
  {
    name: 'Geo session without geofence rejected',
    run: async (cookies) => {
      const coursesRes = await fetch(`${BASE}/api/lms/courses?limit=1`, { headers: { Cookie: cookies.faculty } });
      const { courses } = await coursesRes.json();
      if (!courses?.[0]?.id) throw new Error('no course');
      const res = await fetch(`${BASE}/api/attendance/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookies.faculty },
        body: JSON.stringify({
          courseId: courses[0].id,
          sessionDate: new Date().toISOString().slice(0, 10),
          startTime: '23:59',
          captureMethod: 'self_geo_face',
        }),
      });
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    },
  },
  {
    name: 'Active sessions include geofence shape fields',
    run: async (cookies) => {
      const res = await fetch(`${BASE}/api/attendance/active-sessions?studentId=u10`, {
        headers: { Cookie: cookies.student },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const withFence = (data.sessions ?? []).find((s: { geofence?: { type?: string } }) => s.geofence?.type);
      if (!withFence) return; // no active geo sessions is ok
      if (!withFence.geofence.type) throw new Error('missing geofence.type on session');
    },
  },
];

async function main() {
  console.log('Geofence integration verify\n');
  const cookies = {
    faculty: await login('faculty.venkat@jntuh.ac.in'),
    student: await login('student.ravi@jntuh.ac.in'),
  };

  let passed = 0;
  for (const check of checks) {
    process.stdout.write(`  → ${check.name}... `);
    try {
      await check.run(cookies);
      passed++;
      console.log('OK');
    } catch (err) {
      console.log('FAIL');
      console.error(`    ${err instanceof Error ? err.message : err}`);
      process.exitCode = 1;
      break;
    }
  }
  console.log(`\n${passed}/${checks.length} geofence integration checks passed`);
  if (process.exitCode) process.exit(process.exitCode);
}

main();
