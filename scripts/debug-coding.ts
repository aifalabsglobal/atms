const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

const TWO_SUM = `var twoSum = function(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (map.has(need)) return [map.get(need), i];
    map.set(nums[i], i);
  }
};`;

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
  return cookie;
}

async function main() {
  const cookie = await login('student.ravi@jntuh.ac.in');
  const qRes = await fetch(`${BASE}/api/lms/quizzes?limit=50`, { headers: { Cookie: cookie } });
  const qData = await qRes.json() as { questions?: { id: string; type: string; question?: string; codingMeta?: { slug?: string } }[] };
  const coding = (qData.questions ?? []).filter((q) => q.type === 'coding');
  console.log('coding count', coding.length);
  for (const q of coding) {
    console.log('---', q.codingMeta?.slug ?? '?', q.question?.slice(0, 50));
    const runRes = await fetch(`${BASE}/api/lms/quizzes/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ questionId: q.id, code: TWO_SUM, language: 'javascript' }),
    });
    const run = await runRes.json() as { status?: string; passed?: number; total?: number; results?: unknown[] };
    console.log('  run:', run.status, `${run.passed}/${run.total}`);
    if (run.results?.[0]) console.log('  first:', JSON.stringify(run.results[0]));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
