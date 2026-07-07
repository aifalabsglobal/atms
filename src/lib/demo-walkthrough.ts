/** 5-minute demo script — only paths that work reliably with seeded data. */

export const DEMO_PREP_STEPS = [
  'npm install',
  'npm run demo:prep   # migrate + seed + coding enrollments',
  'npm run dev',
  'Open http://localhost:3000/login — password: demo123',
] as const;

export const DEMO_FLOW = [
  {
    role: 'Admin',
    email: 'registrar@aimscs.ac.in',
    minutes: 2,
    steps: [
      'Dashboard → campus overview stats',
      'Masters → Subjects → Import → R22 CSE catalog into CSE dept',
      'Optional: check "Auto-publish imported subjects as LMS courses"',
      'LMS → Courses — show linked course cards',
    ],
    avoid: 'Do not delete masters records live.',
  },
  {
    role: 'Faculty',
    email: 'faculty.venkat@aimscs.ac.in',
    minutes: 1,
    steps: [
      'LMS → Assignments → edit or delete a draft assignment',
      'LMS → Quizzes → Coding Practice (preview problems)',
      'LMS → Manage Modules → toggle publish + edit lessons',
    ],
    avoid: 'Skip custom test-case authoring — use bundled templates only.',
  },
  {
    role: 'Student',
    email: 'student.ravi@aimscs.ac.in',
    minutes: 2,
    steps: [
      'LMS → Quizzes → Coding Practice → Two Sum',
      'Paste solution → Run (sample tests) → Submit (full grade)',
      'LMS → My Assignments → submit one assignment',
      'LMS → My Grades / Reports → personal attendance & grades',
    ],
    avoid: 'Say "JavaScript judge" — Python is not enabled yet.',
  },
  {
    role: 'Parent',
    email: 'parent.rajesh@aimscs.ac.in',
    minutes: 0.5,
    steps: [
      'LMS → "My Ward\'s Learning" — read-only ward courses & grades',
    ],
    avoid: 'Parent cannot submit on behalf of ward.',
  },
  {
    role: 'HOD',
    email: 'hod.cse@aimscs.ac.in',
    minutes: 0.5,
    steps: [
      'Masters → read-only badge, dept-scoped subjects view',
      'Violations / Reports — department context',
    ],
    avoid: 'HOD cannot edit masters (by design).',
  },
] as const;

export const DEMO_TWO_SUM_SOLUTION = `var twoSum = function(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (map.has(need)) return [map.get(need), i];
    map.set(nums[i], i);
  }
};`;

/** Slug → working JS solution for live demos */
export const DEMO_SOLUTIONS: Record<string, string> = {
  'two-sum': DEMO_TWO_SUM_SOLUTION,
  'valid-parentheses': `var isValid = function(s) {
  const stack = [];
  const pairs = { ')': '(', '}': '{', ']': '[' };
  for (const ch of s) {
    if (ch === '(' || ch === '{' || ch === '[') stack.push(ch);
    else if (!stack.length || stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
};`,
  'maximum-subarray': `var maxSubArray = function(nums) {
  let best = nums[0], cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);
    best = Math.max(best, cur);
  }
  return best;
};`,
  'maximum-depth-binary-tree': `var maxDepth = function(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
};`,
};

export const DEMO_TALKING_POINTS = [
  'Position as a pilot / MVP — AIMSCS R22 masters + attendance + LMS in one portal.',
  'Role-based access: student sees only their data; admin sees campus-wide.',
  'Coding practice is LeetCode-style UI with auto-graded JS problems (pilot judge).',
  'Use avatar menu → Switch demo role — no logout between roles.',
] as const;

export const DEMO_DO_NOT_SHOW = [
  'Custom coding problems from scratch (no test-case builder UI)',
  'Python / C++ execution',
  'Production security / scale claims',
] as const;

export function buildDemoWalkthroughText(baseUrl?: string): string {
  const url = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const lines: string[] = [
    '═══ AIMSCS — 5-MIN DEMO SCRIPT ═══',
    '',
    'BEFORE THE DEMO (run once):',
    ...DEMO_PREP_STEPS.map((s) => `  • ${s}`),
    '',
    'LOGIN: ' + url + '/login  |  Password: demo123',
    'TIP: Avatar menu → Switch demo role (no re-login)',
    '',
    '── DEMO FLOW ──',
  ];

  for (const block of DEMO_FLOW) {
    lines.push('');
    lines.push(`${block.role} (${block.email}) ~${block.minutes} min`);
    block.steps.forEach((s) => lines.push(`  → ${s}`));
    lines.push(`  ✗ Avoid: ${block.avoid}`);
  }

  lines.push('');
  lines.push('── TWO SUM BACKUP (if live coding stalls) ──');
  lines.push(DEMO_TWO_SUM_SOLUTION);
  lines.push('');
  lines.push('── SAY THIS ──');
  DEMO_TALKING_POINTS.forEach((s) => lines.push(`  • ${s}`));
  lines.push('');
  lines.push('── DO NOT SHOW ──');
  DEMO_DO_NOT_SHOW.forEach((s) => lines.push(`  • ${s}`));

  return lines.join('\n');
}
