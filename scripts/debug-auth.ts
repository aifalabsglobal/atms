const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

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
      // Multiple cookies are comma-separated; split before cookie names
      for (const chunk of single.split(/,(?=\s*[^;,]+=)/)) {
        const part = chunk.trim().split(';')[0]?.trim();
        if (part?.includes('=')) next.push(part);
      }
    }
  }
  return [...new Set(next)];
}

async function main() {
  const jar: string[] = [];
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar = collectCookies(csrfRes, jar);
  console.log('csrf cookies', jar.length);
  const { csrfToken } = await csrfRes.json();
  console.log('csrfToken', csrfToken?.slice(0, 8) + '...');

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.join('; '),
    },
    body: new URLSearchParams({
      email: 'vice.chancellor@jntuh.ac.in',
      password: 'demo123',
      csrfToken,
      callbackUrl: `${BASE}/`,
      json: 'true',
    }),
    redirect: 'manual',
  });
  jar = collectCookies(loginRes, jar);
  const loginBody = await loginRes.text();
  console.log('login', loginRes.status, 'cookies', jar.length, jar.map((c) => c.split('=')[0]));
  console.log('login body', loginBody.slice(0, 300));

  const sessRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: jar.join('; ') } });
  const sess = await sessRes.json();
  console.log('session user', sess?.user?.email, sess?.user?.role);

  const dashRes = await fetch(`${BASE}/api/dashboard`, { headers: { Cookie: jar.join('; ') } });
  console.log('dashboard', dashRes.status, dashRes.headers.get('content-type'));
  if (dashRes.ok && dashRes.headers.get('content-type')?.includes('json')) {
    const d = await dashRes.json();
    console.log('  keys', Object.keys(d), 'knuct', !!d.knuct);
  }
}

main().catch(console.error);
