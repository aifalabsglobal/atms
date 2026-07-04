import vm from 'vm';
import type { CodingProblemMeta, CodingTestCase, JudgeResult, TestCaseResult } from '@/lib/coding-types';
import { formatArgs, resolveFunctionArgs } from '@/lib/coding-types';

function deepEqual(a: unknown, b: unknown, mode: CodingProblemMeta['compareMode'] = 'deep'): boolean {
  if (mode === 'unordered-array' && Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sa = [...a].map(String).sort();
    const sb = [...b].map(String).sort();
    return sa.every((v, i) => v === sb[i]);
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function runJavaScriptTest(
  code: string,
  functionName: string,
  testCase: CodingTestCase,
  timeLimitMs: number,
  compareMode: CodingProblemMeta['compareMode']
): { passed: boolean; actual: unknown; runtimeMs: number; error?: string } {
  const start = Date.now();
  const fnArgs = resolveFunctionArgs(testCase.args);
  try {
    const argBindings = fnArgs.map((_, i) => `__arg${i}`).join(', ');
    const argDecls = fnArgs.map((_, i) => `const __arg${i} = __fnArgs[${i}];`).join('\n');
    const script = `
      ${argDecls}
      const __fn = (typeof ${functionName} === 'function')
        ? ${functionName}
        : (typeof Solution !== 'undefined' && Solution.prototype?.${functionName})
          ? (new Solution()).${functionName}.bind(new Solution())
          : null;
      if (!__fn) throw new Error('Function ${functionName} not found. Define ${functionName}(...) or class Solution { ${functionName}(...) }');
      __fn(${argBindings});
    `;
    const sandbox: Record<string, unknown> = {
      __fnArgs: fnArgs,
      Map,
      Array,
      Object,
      JSON,
      Math,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
    };
    const context = vm.createContext(sandbox);
    const actual = vm.runInContext(`${code}\n;${script}`, context, {
      timeout: timeLimitMs,
      displayErrors: true,
    });
    const runtimeMs = Date.now() - start;
    const passed = deepEqual(actual, testCase.expected, compareMode);
    return { passed, actual, runtimeMs, error: undefined };
  } catch (err) {
    return {
      passed: false,
      actual: null,
      runtimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function judgeSubmission(
  code: string,
  meta: CodingProblemMeta,
  opts: { sampleOnly?: boolean; language?: string } = {}
): JudgeResult {
  const cases = opts.sampleOnly
    ? meta.testCases.filter((tc) => tc.isSample)
    : meta.testCases;

  if (opts.language && opts.language !== 'javascript') {
    return {
      passed: 0,
      total: cases.length,
      allPassed: false,
      results: cases.map((tc, index) => ({
        index,
        passed: false,
        isSample: !!tc.isSample,
        input: formatArgs(tc.args),
        expected: JSON.stringify(tc.expected),
        actual: '—',
        runtimeMs: 0,
        error: `${opts.language} judging is not enabled yet. Use JavaScript.`,
      })),
      totalRuntimeMs: 0,
    };
  }

  const results: TestCaseResult[] = cases.map((tc, index) => {
    const { passed, actual, runtimeMs, error } = runJavaScriptTest(
      code,
      meta.functionName,
      tc,
      meta.timeLimitMs,
      meta.compareMode
    );
    return {
      index,
      passed,
      isSample: !!tc.isSample,
      input: formatArgs(tc.args),
      expected: JSON.stringify(tc.expected),
      actual: error ? '—' : JSON.stringify(actual),
      runtimeMs,
      error,
    };
  });

  const passed = results.filter((r) => r.passed).length;
  return {
    passed,
    total: results.length,
    allPassed: passed === results.length && results.length > 0,
    results,
    totalRuntimeMs: results.reduce((s, r) => s + r.runtimeMs, 0),
  };
}
