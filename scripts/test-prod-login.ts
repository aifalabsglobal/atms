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
  console.log('Testing login at', BASE);
  const jar = new Map<string, string>();

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { signal: AbortSignal.timeout(30000) });
  console.log('csrf status:', csrfRes.status);
  collectCookies(csrfRes, jar);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  const body = new URLSearchParams({
    email: 'vice.chancellor@aimscs.ac.in',
    password: 'demo123',
    csrfToken,
    callbackUrl: `${BASE}/`,
    json: 'true',
  });

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

  console.log('login status:', loginRes.status);
  collectCookies(loginRes, jar);
  console.log('cookies after login:', [...jar.keys()]);

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: cookieHeader() },
    signal: AbortSignal.timeout(30000),
  });
  const sessionText = await sessionRes.text();
  console.log('session status:', sessionRes.status);
  console.log('session body:', sessionText);

  const homeRes = await fetch(`${BASE}/`, {
    headers: { Cookie: cookieHeader() },
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  });
  console.log('home status:', homeRes.status, 'location:', homeRes.headers.get('location') ?? '(none)');

  if (!sessionText.includes('vice.chancellor@aimscs.ac.in')) {
    process.exitCode = 1;
    console.error('FAIL: session not established');
  } else {
    console.log('PASS: session established');
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
