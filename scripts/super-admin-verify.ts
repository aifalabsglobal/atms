/**
 * Super admin verification checklist — run: npx tsx scripts/super-admin-verify.ts
 * Requires dev server at BASE_URL (default http://localhost:3000)
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const SUPER_EMAIL = 'vice.chancellor@aimscs.ac.in';
const SUPER_PASSWORD = 'demo123';

type Result = { step: string; ok: boolean; detail?: string };

const results: Result[] = [];

function record(step: string, ok: boolean, detail?: string) {
  results.push({ step, ok, detail });
  const icon = ok ? 'PASS' : 'FAIL';
  console.log(`${icon}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function waitForServer(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Server not reachable at ${BASE}`);
}

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

async function login(email: string, password: string): Promise<string> {
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
      password,
      csrfToken,
      callbackUrl: `${BASE}/`,
      json: 'true',
    }),
    redirect: 'manual',
  });
  jar = collectCookies(loginRes, jar);

  const sessRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: jar.join('; ') } });
  const sess = await sessRes.json();
  if (!sess?.user?.email) {
    throw new Error(`Login failed — session empty (body: ${JSON.stringify(sess).slice(0, 100)})`);
  }
  return jar.join('; ');
}

async function api(cookie: string, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Cookie: cookie },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { res, json };
}

async function main() {
  console.log(`\nSuper Admin Verification — ${BASE}\n${'='.repeat(50)}\n`);

  await waitForServer();
  record('0. Server health', true, `${BASE}/api/health OK`);

  // 1. Login as super admin
  let cookie: string;
  try {
    cookie = await login(SUPER_EMAIL, SUPER_PASSWORD);
    record('1. Login super_admin', true, SUPER_EMAIL);
  } catch (e) {
    record('1. Login super_admin', false, e instanceof Error ? e.message : String(e));
    printSummary();
    process.exit(1);
  }

  // Session check
  const session = await api(cookie, '/api/auth/session');
  const role = (session.json as { user?: { role?: string } })?.user?.role;
  record('1b. Session role', role === 'super_admin', `role=${role ?? 'none'}`);

  const rbac = await api(cookie, '/api/settings/rbac');
  const matrix = (rbac.json as { matrix?: Record<string, unknown> })?.matrix;
  const effective = (rbac.json as { effectiveSections?: string[] })?.effectiveSections ?? [];
  record(
    '1c. RBAC matrix load',
    rbac.res.ok && !!matrix && effective.includes('settings'),
    `${effective.length} sections`
  );

  const rbacUsers = await api(cookie, '/api/settings/rbac/users/u10');
  record(
    '1d. RBAC user override API',
    rbacUsers.res.ok || rbacUsers.res.status === 404,
    `status ${rbacUsers.res.status}`
  );

  // Dashboard + knuct
  const dash = await api(cookie, '/api/dashboard');
  record(
    '2. Dashboard API',
    dash.res.ok && !!(dash.json as { knuct?: unknown })?.knuct,
    dash.res.ok ? 'knuct block present' : `status ${dash.res.status}`
  );

  // Masters publish — find a subject
  const subjects = await api(cookie, '/api/masters/subjects?limit=5');
  const programs = await api(cookie, '/api/masters/programs?limit=20');
  const subjectList = (subjects.json as { subjects?: { id: string; departmentId?: string }[] })?.subjects ?? [];
  const programList = (programs.json as { programs?: { id: string; departmentId?: string }[] })?.programs ?? [];
  const subject = subjectList[0];
  const program = programList.find((p) => p.departmentId && p.departmentId === subject?.departmentId) ?? programList[0];
  if (subject?.id && program?.id) {
    const pub = await api(cookie, '/api/masters/subjects/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId: subject.id, programId: program.id }),
    });
    const pubErr = (pub.json as { error?: string })?.error;
    record('3. Masters publish to LMS', pub.res.ok || pub.res.status === 200, pubErr ?? `status ${pub.res.status}`);
  } else {
    record('3. Masters publish to LMS', false, 'no subject/program in DB');
  }

  // Active attendance session
  const sessions = await api(cookie, '/api/attendance/sessions?status=active&limit=1');
  const activeSession = (sessions.json as { sessions?: { id: string }[] })?.sessions?.[0];
  if (activeSession?.id) {
    const detail = await api(cookie, `/api/attendance/sessions/${activeSession.id}`);
    record('4a. Session detail GET', detail.res.ok, `session ${activeSession.id.slice(0, 8)}…`);

    const mark = await api(cookie, `/api/attendance/sessions/${activeSession.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    });
    record('4b. Complete session + anchor', mark.res.ok, `status ${mark.res.status}`);

    const audit = await api(cookie, '/api/audit?anchorableOnly=true&limit=5');
    const logs = (audit.json as { logs?: { action: string; anchorHash?: string | null }[] })?.logs ?? [];
    const withHash = logs.filter((l) => l.anchorHash);
    record('4c. Audit log anchorHash', withHash.length > 0, `${withHash.length} anchored events`);

    if (withHash[0]?.anchorHash) {
      const verify = await api(cookie, `/api/verify/anchor?hash=${withHash[0].anchorHash}`);
      const verified = (verify.json as { verified?: boolean })?.verified;
      record('4d. Verify anchor API', verified === true, withHash[0].anchorHash.slice(0, 16) + '…');
    } else {
      record('4d. Verify anchor API', false, 'no hash to verify');
    }
  } else {
    record('4a. Session detail GET', false, 'no active session');
    record('4b. Complete session + anchor', false, 'skipped');
    record('4c. Audit log anchorHash', false, 'skipped');
    record('4d. Verify anchor API', false, 'skipped');
  }

  // Violations review
  const violations = await api(cookie, '/api/attendance/violations?reviewStatus=pending&limit=1');
  const violation = (violations.json as { violations?: { id: string }[] })?.violations?.[0];
  if (violation?.id) {
    const review = await api(cookie, '/api/attendance/violations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: violation.id, reviewStatus: 'confirmed' }),
    });
    record('5. Violation review', review.res.ok, `status ${review.res.status}`);
  } else {
    record('5. Violation review', true, 'no pending violations (OK)');
  }

  // Calendar create
  const calCreate = await api(cookie, '/api/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: (session.json as { user?: { id?: string } })?.user?.id,
      title: 'Verify Test Event',
      type: 'event',
      startDate: new Date().toISOString().slice(0, 10),
    }),
  });
  const calEventId = (calCreate.json as { event?: { id: string } })?.event?.id;
  record('6. Calendar create', calCreate.res.ok || calCreate.res.status === 201, `status ${calCreate.res.status}`);

  if (calEventId) {
    const calDel = await api(cookie, `/api/calendar?id=${calEventId}`, { method: 'DELETE' });
    record('6b. Calendar delete', calDel.res.ok, 'cleanup');
  }

  // Geofences CRUD
  const geoCreate = await api(cookie, '/api/geofences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verify Zone',
      type: 'circle',
      centerLat: 17.4563,
      centerLng: 78.6698,
      radiusMtrs: 50,
      isActive: true,
    }),
  });
  const geoId = (geoCreate.json as { id?: string })?.id;
  record('7a. Geofence create', geoCreate.res.ok || geoCreate.res.status === 201, `status ${geoCreate.res.status}`);

  if (geoId) {
    const geoPatch = await api(cookie, `/api/geofences/${geoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false, name: 'Verify Zone Updated' }),
    });
    record('7b. Geofence PATCH', geoPatch.res.ok, `status ${geoPatch.res.status}`);

    const geoDel = await api(cookie, `/api/geofences/${geoId}`, { method: 'DELETE' });
    record('7c. Geofence DELETE', geoDel.res.ok, `status ${geoDel.res.status}`);
  } else {
    record('7b. Geofence PATCH', false, 'skipped');
    record('7c. Geofence DELETE', false, 'skipped');
  }

  // Users — create + deactivate
  const testEmail = `verify.${Date.now()}@aimscs.ac.in`;
  const userCreate = await api(cookie, '/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verify User',
      email: testEmail,
      role: 'visitor',
      department: 'Test',
    }),
  });
  const newUserId = (userCreate.json as { user?: { id: string } })?.user?.id;
  record('8a. User create', userCreate.res.ok || userCreate.res.status === 201, `status ${userCreate.res.status}`);

  if (newUserId) {
    const userPatch = await api(cookie, `/api/users/${newUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' }),
    });
    record('8b. User PATCH', userPatch.res.ok, `status ${userPatch.res.status}`);

    const userDel = await api(cookie, `/api/users/${newUserId}`, { method: 'DELETE' });
    record('8c. User deactivate', userDel.res.ok, `status ${userDel.res.status}`);
  }

  // LMS grade — find submission
  const subs = await api(cookie, '/api/lms/submissions?limit=1');
  const submission = (subs.json as { submissions?: { id: string }[] })?.submissions?.[0];
  if (submission?.id) {
    const grade = await api(cookie, '/api/lms/submissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: submission.id, score: 85 }),
    });
    record('9. LMS grade submission', grade.res.ok, `status ${grade.res.status}`);
  } else {
    record('9. LMS grade submission', true, 'no submissions to grade (OK)');
  }

  // Knuct anchors + pilot
  const anchors = await api(cookie, '/api/knuct/anchors?limit=5');
  record('10a. Knuct anchors API', anchors.res.ok, `total ${(anchors.json as { total?: number })?.total ?? '?'}`);

  const pilotGet = await api(cookie, '/api/knuct/pilot');
  record('10b. Knuct pilot GET', pilotGet.res.ok, `status ${pilotGet.res.status}`);

  const knuct = await api(cookie, '/api/knuct');
  const hasStats = !!(knuct.json as { stats?: unknown })?.stats;
  record('10c. Knuct status + stats', knuct.res.ok && hasStats, hasStats ? 'stats present' : 'missing stats');

  // Reports
  const reports = await api(cookie, '/api/reports');
  record('11. Reports API', reports.res.ok, `status ${reports.res.status}`);

  // Notifications PATCH
  const notifPatch = await api(cookie, '/api/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ all: true }),
  });
  record('12. Notifications PATCH', notifPatch.res.ok, `status ${notifPatch.res.status}`);

  // Public verify page
  const verifyPage = await fetch(`${BASE}/verify?hash=98ea651c75242057be80b4a86e6f0a3d48fb7b0eafc2cfe0277aa99d4788b657`);
  record('13. Verify page loads', verifyPage.ok, `status ${verifyPage.status}`);

  printSummary();
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Summary: ${passed}/${results.length} passed`);
  if (failed.length > 0) {
    console.log('\nFailed steps:');
    failed.forEach((f) => console.log(`  - ${f.step}${f.detail ? `: ${f.detail}` : ''}`));
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
