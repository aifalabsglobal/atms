import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo-accounts';
import { buildDemoWalkthroughText } from '@/lib/demo-walkthrough';

export function buildDemoShareText(baseUrl?: string) {
  const url = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const lines = [
    'JNTUH SCMS — Smart Campus Management System',
    `Try it: ${url}/login`,
    '',
    `Password for all demo accounts: ${DEMO_PASSWORD}`,
    '',
    'Demo logins (click any role on the login page):',
    ...DEMO_ACCOUNTS.map((a) => `• ${a.label}: ${a.email}`),
    '',
    'Tip: After login, use the avatar menu to switch between roles instantly.',
    '',
    'Before first try: npm run demo:prep && npm run dev',
  ];
  return lines.join('\n');
}

export async function copyDemoWalkthrough(baseUrl?: string): Promise<boolean> {
  const text = buildDemoWalkthroughText(baseUrl);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyDemoShareKit(baseUrl?: string): Promise<boolean> {
  const text = buildDemoShareText(baseUrl);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
