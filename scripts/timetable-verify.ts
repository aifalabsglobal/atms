/**
 * Timetable integration verify — run with dev server: npm run verify:timetable
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

  const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } });
  const session = await sessionRes.json();
  if (!session?.user?.email) throw new Error('no session');
  if (session.user.email !== email) throw new Error(`wrong email ${session.user.email}`);

  return cookie;
}

function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Check = { name: string; cookieFor: 'faculty' | 'student'; run: (cookie: string) => Promise<void> };

const checks: Check[] = [
  {
    name: 'Faculty can load today timetable',
    cookieFor: 'faculty',
    run: async (cookie) => {
      const date = localDateStr();
      const res = await fetch(`${BASE}/api/timetable?date=${date}`, { headers: { Cookie: cookie } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.slots)) throw new Error('missing slots array');
    },
  },
  {
    name: 'Student cannot access masters timetable',
    cookieFor: 'student',
    run: async (cookie) => {
      const res = await fetch(`${BASE}/api/masters/timetable-slots?limit=5`, { headers: { Cookie: cookie } });
      if (res.status !== 403) throw new Error(`expected 403, got ${res.status}`);
    },
  },
  {
    name: 'Invalid date rejected on timetable API',
    cookieFor: 'faculty',
    run: async (cookie) => {
      const res = await fetch(`${BASE}/api/timetable?date=not-a-date`, { headers: { Cookie: cookie } });
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    },
  },
  {
    name: 'Duplicate active slot session rejected',
    cookieFor: 'faculty',
    run: async (cookie) => {
      const date = localDateStr();
      const listRes = await fetch(`${BASE}/api/timetable?date=${date}`, { headers: { Cookie: cookie } });
      const list = await listRes.json();
      const slot = list.slots?.find((s: { session?: { status: string } | null }) => s.session?.status === 'active');
      if (!slot) return;

      const dupRes = await fetch(`${BASE}/api/attendance/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          courseId: slot.courseId,
          sessionDate: date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timetableSlotId: slot.id,
          captureMethod: 'manual',
        }),
      });
      if (dupRes.status !== 409) {
        throw new Error(`expected 409 on duplicate, got ${dupRes.status}`);
      }
    },
  },
];

async function main() {
  console.log('Timetable production verify\n');
  let passed = 0;

  const cookies = {
    faculty: await login('faculty.venkat@aimscs.ac.in'),
    student: await login('student.ravi@aimscs.ac.in'),
  };

  for (const check of checks) {
    try {
      await check.run(cookies[check.cookieFor]);
      passed++;
      console.log(`  ✓ ${check.name}`);
    } catch (err) {
      console.error(`  ✗ ${check.name}: ${err instanceof Error ? err.message : err}`);
      process.exitCode = 1;
    }
  }

  console.log(`\n${passed}/${checks.length} integration checks passed`);
  if (process.exitCode) process.exit(process.exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
