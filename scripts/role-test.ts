/**
 * Role-based access tests — run: npm run test:roles
 */
import { ROLE_SECTIONS, type Role, type Section } from '../src/lib/store';
import { DEFAULT_ROLE_SECTIONS } from '../src/lib/rbac-defaults';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const DEMO_ACCOUNTS: { label: string; email: string; role: Role }[] = [
  { label: 'Super Admin', email: 'vice.chancellor@aimscs.ac.in', role: 'super_admin' },
  { label: 'Admin', email: 'registrar@aimscs.ac.in', role: 'admin' },
  { label: 'HOD (CSE)', email: 'hod.cse@aimscs.ac.in', role: 'hod' },
  { label: 'Faculty', email: 'faculty.venkat@aimscs.ac.in', role: 'faculty' },
  { label: 'Student', email: 'student.ravi@aimscs.ac.in', role: 'student' },
  { label: 'Parent', email: 'parent.rajesh@aimscs.ac.in', role: 'parent' },
  { label: 'Security', email: 'security.murthy@aimscs.ac.in', role: 'security' },
];

type Endpoint = {
  name: string;
  path: string;
  section?: Section;
  expectAccess: (role: Role) => boolean;
};

function hasSection(role: Role, section: Section): boolean {
  return (DEFAULT_ROLE_SECTIONS[role] ?? ROLE_SECTIONS[role] ?? []).includes(section);
}

function hasAnySection(role: Role, sections: Section[]): boolean {
  return sections.some((s) => hasSection(role, s));
}

const ENDPOINTS: Endpoint[] = [
  { name: 'dashboard', path: '/api/dashboard', section: 'dashboard', expectAccess: (r) => hasSection(r, 'dashboard') },
  { name: 'masters', path: '/api/masters/departments?limit=5', section: 'masters', expectAccess: (r) => hasSection(r, 'masters') },
  { name: 'users', path: '/api/users?limit=5', section: 'users', expectAccess: (r) => hasSection(r, 'users') },
  { name: 'lms', path: '/api/lms/courses?limit=5', section: 'lms', expectAccess: (r) => hasSection(r, 'lms') },
  { name: 'violations', path: '/api/attendance/violations?limit=1', section: 'violations', expectAccess: (r) => hasSection(r, 'violations') },
  { name: 'reports', path: '/api/reports', section: 'reports', expectAccess: (r) => hasSection(r, 'reports') },
  { name: 'geofences', path: '/api/geofences', section: 'geofences', expectAccess: (r) => hasSection(r, 'geofences') },
  { name: 'calendar', path: '/api/calendar?limit=5', section: 'calendar', expectAccess: (r) => hasSection(r, 'calendar') },
  { name: 'attendance-sessions', path: '/api/attendance/sessions?limit=5', section: 'attendance', expectAccess: (r) => hasSection(r, 'attendance') },
  { name: 'timetable', path: '/api/timetable?date=2026-07-06', section: 'attendance', expectAccess: (r) => hasAnySection(r, ['attendance', 'masters']) },
  { name: 'timetable-slots', path: '/api/masters/timetable-slots?limit=5', section: 'masters', expectAccess: (r) => hasAnySection(r, ['attendance', 'masters']) },
  { name: 'active-sessions', path: '/api/attendance/active-sessions', section: 'attendance', expectAccess: (r) => hasSection(r, 'attendance') },
];

function collectCookies(res: Response, jar: string[]): string[] {
  const next = [...jar];
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const part = c.split(';')[0]?.trim();
    if (part?.includes('=')) next.push(part);
  }
  if (raw.length === 0) {
    const single = res.headers.get('set-cookie');
    if (single) {
      for (const chunk of single.split(/,(?=\s*[^;,]+=)/)) {
        const part = chunk.trim().split(';')[0]?.trim();
        if (part?.includes('=')) next.push(part);
      }
    }
  }
  return [...new Set(next)];
}

async function login(email: string): Promise<string> {
  let jar: string[] = [];
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar = collectCookies(csrfRes, jar);
  const { csrfToken } = await csrfRes.json();

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.join('; '),
    },
    body: new URLSearchParams({
      email,
      password: 'demo123',
      csrfToken,
      callbackUrl: `${BASE}/`,
      json: 'true',
    }),
    redirect: 'manual',
  });
  jar = collectCookies(loginRes, jar);
  if (loginRes.status !== 200 && loginRes.status !== 302) {
    throw new Error(`login failed ${loginRes.status}`);
  }

  const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: jar.join('; ') } });
  const session = await sessionRes.json();
  if (!session?.user?.email) throw new Error('no session');
  if (session.user.email !== email) throw new Error(`wrong email ${session.user.email}`);

  return jar.join('; ');
}

type Row = { role: string; check: string; ok: boolean; detail: string; ms: number };

async function main() {
  const rows: Row[] = [];

  for (const account of DEMO_ACCOUNTS) {
    const t0 = Date.now();
    let cookie: string;
    try {
      cookie = await login(account.email);
      rows.push({ role: account.label, check: 'login', ok: true, detail: account.role, ms: Date.now() - t0 });
    } catch (e) {
      rows.push({ role: account.label, check: 'login', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 });
      continue;
    }

    for (const ep of ENDPOINTS) {
      const uiHasSection = ep.section ? hasSection(account.role, ep.section) : true;
      const expectOk = ep.expectAccess(account.role);

      const start = Date.now();
      try {
        const res = await fetch(`${BASE}${ep.path}`, { headers: { Cookie: cookie } });
        const ms = Date.now() - start;

        if (expectOk && !res.ok) {
          rows.push({ role: account.label, check: ep.name, ok: false, detail: `expected 200 got ${res.status}`, ms });
          continue;
        }
        if (!expectOk && res.status !== 403) {
          rows.push({ role: account.label, check: ep.name, ok: false, detail: `expected 403 got ${res.status}`, ms });
          continue;
        }

        if (ep.name === 'dashboard' && res.ok) {
          const data = await res.json();
          const scope = data.scope as string;
          const expected: Partial<Record<Role, string>> = {
            super_admin: 'campus', admin: 'campus', hod: 'department',
            faculty: 'instructor', student: 'student', parent: 'parent', visitor: 'visitor',
          };
          const exp = expected[account.role];
          if (exp && scope !== exp) {
            rows.push({ role: account.label, check: ep.name, ok: false, detail: `scope=${scope} want ${exp}`, ms });
            continue;
          }
          if (account.role === 'parent' && !data.ward?.name) {
            rows.push({ role: account.label, check: 'parent-ward', ok: false, detail: 'no ward linked', ms });
            continue;
          }
        }

        const note = expectOk ? '200' : '403';
        const uiNote = ep.section && !uiHasSection ? ' (not in nav)' : '';
        rows.push({ role: account.label, check: ep.name, ok: true, detail: `${note}${uiNote}`, ms });
      } catch (e) {
        rows.push({ role: account.label, check: ep.name, ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
      }
    }

    if (account.role === 'hod') {
      const start = Date.now();
      try {
        const res = await fetch(`${BASE}/api/lms/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ courseId: 'x', title: 'x', dueDate: new Date().toISOString() }),
        });
        if (res.status !== 403) {
          rows.push({ role: account.label, check: 'lms-write-blocked', ok: false, detail: `expected 403 got ${res.status}`, ms: Date.now() - start });
        } else {
          rows.push({ role: account.label, check: 'lms-write-blocked', ok: true, detail: '403', ms: Date.now() - start });
        }
      } catch (e) {
        rows.push({ role: account.label, check: 'lms-write-blocked', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
      }
    }
  }

  console.log('\n=== Role Access Tests (7 demo roles) ===\n');

  let currentRole = '';
  for (const row of rows) {
    if (row.role !== currentRole) {
      currentRole = row.role;
      console.log(`\n[${row.role}]`);
    }
    console.log(`${row.ok ? '  PASS' : '  FAIL'} ${row.check} — ${row.detail} (${row.ms}ms)`);
  }

  const passed = rows.filter((r) => r.ok).length;
  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${passed}/${rows.length} passed`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  - ${f.role} / ${f.check}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
