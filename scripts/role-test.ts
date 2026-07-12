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
  { name: 'condonation', path: '/api/attendance/condonation?status=all&limit=5', section: 'attendance', expectAccess: (r) =>
    ['super_admin', 'admin', 'hod', 'faculty', 'student', 'parent'].includes(r) },
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

const VALID_REASON =
  'Medical leave documentation attached for the mid-semester absence period.';

async function runStudentCondonationChecks(label: string, cookie: string, rows: Row[]) {
  // Cannot submit on behalf of another student (body studentId ignored / rejected).
  {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/api/attendance/condonation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ reason: VALID_REASON, studentId: 'someone-else' }),
      });
      if (res.status !== 403) {
        rows.push({ role: label, check: 'condonation-no-proxy', ok: false, detail: `expected 403 got ${res.status}`, ms: Date.now() - start });
      } else {
        rows.push({ role: label, check: 'condonation-no-proxy', ok: true, detail: '403', ms: Date.now() - start });
      }
    } catch (e) {
      rows.push({ role: label, check: 'condonation-no-proxy', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  }

  // Short reason rejected.
  {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/api/attendance/condonation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ reason: 'too short' }),
      });
      if (res.status !== 400) {
        rows.push({ role: label, check: 'condonation-reason-min', ok: false, detail: `expected 400 got ${res.status}`, ms: Date.now() - start });
      } else {
        rows.push({ role: label, check: 'condonation-reason-min', ok: true, detail: '400', ms: Date.now() - start });
      }
    } catch (e) {
      rows.push({ role: label, check: 'condonation-reason-min', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  }

  // GET lists only the caller's requests.
  {
    const start = Date.now();
    try {
      const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } });
      const session = await sessionRes.json();
      const me = session?.user?.id as string | undefined;
      const res = await fetch(`${BASE}/api/attendance/condonation?status=all&limit=50`, { headers: { Cookie: cookie } });
      const ms = Date.now() - start;
      if (!res.ok || !me) {
        rows.push({ role: label, check: 'condonation-own-only', ok: false, detail: `GET ${res.status}`, ms });
      } else {
        const data = await res.json();
        const leaked = (data.requests as { studentId: string }[] | undefined)?.some((r) => r.studentId !== me);
        rows.push({
          role: label,
          check: 'condonation-own-only',
          ok: !leaked,
          detail: leaked ? 'leaked other student requests' : 'scoped',
          ms,
        });
      }
    } catch (e) {
      rows.push({ role: label, check: 'condonation-own-only', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  }

  // Create / band / duplicate / withdraw lifecycle.
  let pendingId: string | undefined;
  {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/api/attendance/condonation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ reason: VALID_REASON }),
      });
      const body = await res.json().catch(() => ({}));
      const ms = Date.now() - start;
      if (res.status === 201 && typeof body.id === 'string') {
        pendingId = body.id;
        rows.push({ role: label, check: 'condonation-create', ok: true, detail: '201 in band', ms });
      } else if (res.status === 409 && typeof body.existingRequestId === 'string') {
        pendingId = body.existingRequestId;
        rows.push({ role: label, check: 'condonation-create', ok: true, detail: '409 duplicate', ms });
        rows.push({ role: label, check: 'condonation-duplicate', ok: true, detail: 'existingRequestId', ms: 0 });
      } else if (res.status === 400 && typeof body.error === 'string') {
        const bandMsg =
          body.error.includes('eligible') || body.error.includes('condonable') || body.error.includes('Below');
        rows.push({
          role: label,
          check: 'condonation-create',
          ok: bandMsg,
          detail: bandMsg ? `out of band: ${body.error}` : `unexpected 400: ${body.error}`,
          ms,
        });
      } else if (res.status === 429) {
        rows.push({
          role: label,
          check: 'condonation-create',
          ok: true,
          detail: '429 rate-limited after prior POSTs',
          ms,
        });
      } else {
        rows.push({ role: label, check: 'condonation-create', ok: false, detail: `unexpected ${res.status}`, ms });
      }

      if (pendingId && res.status === 201) {
        const dupStart = Date.now();
        const dup = await fetch(`${BASE}/api/attendance/condonation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ reason: VALID_REASON }),
        });
        const dupBody = await dup.json().catch(() => ({}));
        rows.push({
          role: label,
          check: 'condonation-duplicate',
          ok: dup.status === 409 && !!dupBody.existingRequestId,
          detail: dup.status === 409 ? '409 existingRequestId' : `got ${dup.status}`,
          ms: Date.now() - dupStart,
        });
      }
    } catch (e) {
      rows.push({ role: label, check: 'condonation-create', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  }

  if (pendingId) {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/api/attendance/condonation/${pendingId}`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      });
      rows.push({
        role: label,
        check: 'condonation-withdraw',
        ok: res.ok,
        detail: res.ok ? 'withdrawn' : `got ${res.status}`,
        ms: Date.now() - start,
      });
    } catch (e) {
      rows.push({ role: label, check: 'condonation-withdraw', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  }

  // Cannot withdraw a non-owned / missing request.
  {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/api/attendance/condonation/not-a-real-request-id`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      });
      rows.push({
        role: label,
        check: 'condonation-withdraw-missing',
        ok: res.status === 404,
        detail: `got ${res.status}`,
        ms: Date.now() - start,
      });
    } catch (e) {
      rows.push({ role: label, check: 'condonation-withdraw-missing', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  }
}

async function runFacultyCondonationChecks(label: string, cookie: string, rows: Row[]) {
  // Faculty cannot create requests.
  {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/api/attendance/condonation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ reason: VALID_REASON }),
      });
      rows.push({
        role: label,
        check: 'condonation-faculty-post',
        ok: res.status === 403,
        detail: `got ${res.status}`,
        ms: Date.now() - start,
      });
    } catch (e) {
      rows.push({ role: label, check: 'condonation-faculty-post', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  }

  // With requireHodForCondonation default true, faculty cannot decide (404 if none, else 403).
  {
    const start = Date.now();
    try {
      const list = await fetch(`${BASE}/api/attendance/condonation?status=pending&limit=1`, {
        headers: { Cookie: cookie },
      });
      const data = list.ok ? await list.json() : { requests: [] };
      const id = (data.requests as { id: string }[] | undefined)?.[0]?.id ?? 'missing-condonation-id';
      const res = await fetch(`${BASE}/api/attendance/condonation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ decision: 'approved' }),
      });
      const ok = res.status === 403 || res.status === 404;
      rows.push({
        role: label,
        check: 'condonation-faculty-decide',
        ok,
        detail: `got ${res.status}`,
        ms: Date.now() - start,
      });
    } catch (e) {
      rows.push({ role: label, check: 'condonation-faculty-decide', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  }
}

async function runAdminCondonationChecks(label: string, cookie: string, rows: Row[]) {
  // Admin/super_admin can list pending (campus scope), including null-department rows if any.
  {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE}/api/attendance/condonation?status=pending&limit=5`, {
        headers: { Cookie: cookie },
      });
      rows.push({
        role: label,
        check: 'condonation-admin-list',
        ok: res.ok,
        detail: res.ok ? '200' : `got ${res.status}`,
        ms: Date.now() - start,
      });
    } catch (e) {
      rows.push({ role: label, check: 'condonation-admin-list', ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start });
    }
  }
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

    if (account.role === 'student') {
      await runStudentCondonationChecks(account.label, cookie, rows);
    }
    if (account.role === 'faculty') {
      await runFacultyCondonationChecks(account.label, cookie, rows);
    }
    if (account.role === 'admin' || account.role === 'super_admin') {
      await runAdminCondonationChecks(account.label, cookie, rows);
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
