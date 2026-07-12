/**
 * Live E2E: Divya (watch band) → submit → HOD CSE approve → verify Cleared.
 *   npx tsx --env-file=.env scripts/e2e-condonation.ts
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

type Step = { name: string; ok: boolean; detail: string };

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
    throw new Error(`login failed ${loginRes.status} for ${email}`);
  }

  const sessionRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: jar.join('; ') } });
  const session = await sessionRes.json();
  if (!session?.user?.email) throw new Error(`no session for ${email}`);
  return jar.join('; ');
}

async function main() {
  const steps: Step[] = [];
  const reason =
    'E2E medical/leave documentation for mid-semester absences requiring condonation review.';

  // 0) Ensure Divya is in watch band
  try {
    const { execSync } = await import('node:child_process');
    execSync('npx tsx --env-file=.env scripts/seed-condonation-demo.ts', {
      stdio: 'pipe',
      cwd: process.cwd(),
    });
    steps.push({ name: 'seed Divya watch band', ok: true, detail: '~70%' });
  } catch (e) {
    steps.push({
      name: 'seed Divya watch band',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 1) Student login + records
  let studentCookie = '';
  try {
    studentCookie = await login('student.divya@aimscs.ac.in');
    const rec = await fetch(`${BASE}/api/attendance/my-records`, {
      headers: { Cookie: studentCookie },
    });
    const body = await rec.json();
    const pct = body?.summary?.percentage;
    const total = body?.summary?.total;
    const inBand = typeof pct === 'number' && pct >= 65 && pct < 75;
    steps.push({
      name: 'student my-records (watch band)',
      ok: rec.ok && inBand,
      detail: rec.ok ? `${pct}% of ${total} sessions` : `HTTP ${rec.status}`,
    });
  } catch (e) {
    steps.push({
      name: 'student login/records',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 2) Withdraw any pending so create can succeed
  try {
    const list = await fetch(`${BASE}/api/attendance/condonation?status=pending&limit=5`, {
      headers: { Cookie: studentCookie },
    });
    const data = await list.json();
    for (const req of data.requests ?? []) {
      await fetch(`${BASE}/api/attendance/condonation/${req.id}`, {
        method: 'DELETE',
        headers: { Cookie: studentCookie },
      });
    }
    steps.push({
      name: 'clear prior pending',
      ok: true,
      detail: `${(data.requests ?? []).length} withdrawn`,
    });
  } catch (e) {
    steps.push({
      name: 'clear prior pending',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 3) Submit request
  let requestId = '';
  try {
    const res = await fetch(`${BASE}/api/attendance/condonation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: studentCookie },
      body: JSON.stringify({ reason }),
    });
    const body = await res.json();
    requestId = body.id || body.existingRequestId || '';
    steps.push({
      name: 'student POST condonation',
      ok: (res.status === 201 || res.status === 409) && !!requestId,
      detail: `${res.status} id=${requestId || 'none'} ${body.error ?? ''}`.trim(),
    });
  } catch (e) {
    steps.push({
      name: 'student POST condonation',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 4) Faculty cannot decide
  try {
    const facCookie = await login('faculty.venkat@aimscs.ac.in');
    const res = await fetch(`${BASE}/api/attendance/condonation/${requestId || 'missing'}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: facCookie },
      body: JSON.stringify({ decision: 'approved' }),
    });
    steps.push({
      name: 'faculty decide blocked',
      ok: res.status === 403 || res.status === 404,
      detail: `HTTP ${res.status}`,
    });
  } catch (e) {
    steps.push({
      name: 'faculty decide blocked',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 5) HOD approve
  try {
    const hodCookie = await login('hod.cse@aimscs.ac.in');
    const res = await fetch(`${BASE}/api/attendance/condonation/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: hodCookie },
      body: JSON.stringify({ decision: 'approved', notes: 'E2E approved — cleared for term' }),
    });
    const body = await res.json();
    steps.push({
      name: 'HOD approve & clear',
      ok: res.ok && body.status === 'approved' && body.clearedForTerm === true,
      detail: res.ok
        ? `status=${body.status} cleared=${body.clearedForTerm} year=${body.academicYearId ?? 'null'}`
        : `HTTP ${res.status} ${body.error ?? ''}`,
    });
  } catch (e) {
    steps.push({
      name: 'HOD approve & clear',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 6) Student sees clearance
  try {
    studentCookie = await login('student.divya@aimscs.ac.in');
    const rec = await fetch(`${BASE}/api/attendance/my-records`, {
      headers: { Cookie: studentCookie },
    });
    const body = await rec.json();
    const cleared = body?.condonationClearance?.clearedForTerm === true;
    steps.push({
      name: 'student clearance on my-records',
      ok: rec.ok && cleared,
      detail: JSON.stringify(body?.condonationClearance ?? null),
    });

    const dash = await fetch(`${BASE}/api/dashboard`, { headers: { Cookie: studentCookie } });
    const dashBody = await dash.json();
    steps.push({
      name: 'student examEligible on dashboard',
      ok: dash.ok && dashBody.examEligible === true,
      detail: `examEligible=${dashBody.examEligible} cleared=${dashBody.condonationClearance?.clearedForTerm}`,
    });
  } catch (e) {
    steps.push({
      name: 'student clearance verify',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 7) Security blocked
  try {
    const secCookie = await login('security.murthy@aimscs.ac.in');
    const res = await fetch(`${BASE}/api/attendance/condonation?status=pending&limit=1`, {
      headers: { Cookie: secCookie },
    });
    steps.push({
      name: 'security condonation 403',
      ok: res.status === 403,
      detail: `HTTP ${res.status}`,
    });
  } catch (e) {
    steps.push({
      name: 'security condonation 403',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  console.log('\n=== Condonation E2E ===\n');
  for (const s of steps) {
    console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.name} — ${s.detail}`);
  }
  const failed = steps.filter((s) => !s.ok);
  console.log(`\n${steps.length - failed.length}/${steps.length} passed\n`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
