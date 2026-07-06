const BASE = process.env.PROD_URL ?? 'https://atms-three.vercel.app';

async function main() {
  console.log('Testing login at', BASE);

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { signal: AbortSignal.timeout(30000) });
  console.log('csrf status:', csrfRes.status);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const setCookie = csrfRes.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];

  const body = new URLSearchParams({
    email: 'vice.chancellor@jntuh.ac.in',
    password: 'demo123',
    csrfToken,
    callbackUrl: `${BASE}/`,
    json: 'true',
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(120000),
  });

  console.log('login status:', loginRes.status);
  console.log('login headers:', Object.fromEntries(loginRes.headers.entries()));
  const loginText = await loginRes.text();
  console.log('login body:', loginText.slice(0, 500));

  const sessionCookie = [cookie, loginRes.headers.get('set-cookie')?.split(';')[0]]
    .filter(Boolean)
    .join('; ');

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: sessionCookie },
    signal: AbortSignal.timeout(30000),
  });
  console.log('session status:', sessionRes.status);
  console.log('session body:', await sessionRes.text());
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
