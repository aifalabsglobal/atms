import { judgeSubmission } from '../src/lib/coding-judge';
import { BUNDLED_CODING_PROBLEMS } from '../src/data/leetcode-problems';

const code = `var twoSum = function(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (map.has(need)) return [map.get(need), i];
    map.set(nums[i], i);
  }
};`;

const meta = BUNDLED_CODING_PROBLEMS[0].meta;
const result = judgeSubmission(code, meta, { sampleOnly: true });
console.log('two-sum sample:', result.allPassed, `${result.passed}/${result.total}`);

for (const prob of BUNDLED_CODING_PROBLEMS) {
  const sol = prob.meta.slug === 'two-sum' ? code : null;
  if (!sol) continue;
}

// Full bundled check via demo solutions
import { DEMO_SOLUTIONS } from '../src/lib/demo-walkthrough';

let failed = 0;
for (const prob of BUNDLED_CODING_PROBLEMS) {
  const sol = DEMO_SOLUTIONS[prob.meta.slug];
  if (!sol) { console.log('skip', prob.meta.slug); continue; }
  const r = judgeSubmission(sol, prob.meta, { sampleOnly: true });
  console.log(prob.meta.slug, r.allPassed ? 'OK' : 'FAIL', `${r.passed}/${r.total}`);
  if (!r.allPassed) failed++;
}
if (failed) process.exit(1);
