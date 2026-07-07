const BASE = process.env.PROD_URL ?? 'https://atms-three.vercel.app';

function collectCookies(res: Response, jar: Map<string, string>) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(';')[0]?.trim();
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

async function main() {
  const jar = new Map<string, string>();
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { signal: AbortSignal.timeout(30000) });
  console.log('csrf', csrfRes.status);
  collectCookies(csrfRes, jar);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  // Browser signIn() does NOT send json=true
  const body = new URLSearchParams({
    email: 'vice.chancellor@jntuh.ac.in',
    password: 'demo123',
    csrfToken,
    callbackUrl: `${BASE}/`,
  });

  const t0 = Date.now();
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(),
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
  });
  collectCookies(loginRes, jar);
  console.log('login', loginRes.status, `${Date.now() - t0}ms`, 'location:', loginRes.headers.get('location') ?? '(none)');
  if (loginRes.status >= 500) {
    console.log('body:', (await loginRes.text()).slice(0, 500));
    process.exitCode = 1;
    return;
  }

  const homeRes = await fetch(`${BASE}/`, {
    headers: { Cookie: cookieHeader() },
    redirect: 'manual',
    signal: AbortSignal.timeout(60000),
  });
  console.log('home', homeRes.status, 'location:', homeRes.headers.get('location') ?? '(none)');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
