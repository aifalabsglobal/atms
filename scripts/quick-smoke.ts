/**
 * Fast smoke checks for CI (~30s) — run: npm run smoke:quick
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

async function check(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    console.log(`PASS ${name} (${Date.now() - start}ms)`);
  } catch (e) {
    console.error(`FAIL ${name}:`, e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

async function main() {
  await check('GET /api/health', async () => {
    const res = await fetch(`${BASE}/api/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(JSON.stringify(data));
  });

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

  let cookie = '';
  await check('POST login (Student)', async () => {
    let jar: string[] = [];
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    jar = (csrfRes.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).filter(Boolean);
    const { csrfToken } = await csrfRes.json();

    const body = new URLSearchParams({
      email: 'student.ravi@jntuh.ac.in',
      password: 'demo123',
      csrfToken,
      callbackUrl: `${BASE}/`,
      json: 'true',
    });

    const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.join('; ') },
      body,
    });
    jar = [...jar, ...(loginRes.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).filter(Boolean)];
    cookie = [...new Set(jar)].join('; ');
    if (loginRes.status !== 200) throw new Error(`login ${loginRes.status}`);
    const sess = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookie } }).then((r) => r.json());
    if (!sess?.user?.email) throw new Error('session empty after login');
  });

  await check('GET /api/dashboard', async () => {
    const res = await fetch(`${BASE}/api/dashboard`, { headers: { Cookie: cookie } });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (data.scope !== 'student') throw new Error(`scope=${data.scope}`);
  });

  console.log('\nQuick smoke: 5/5 passed');
}

main();
