export type CodingLanguage = 'javascript' | 'python';

export interface CodingExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface CodingTestCase {
  args: unknown[][];
  expected: unknown;
  isSample?: boolean;
}

export interface CodingProblemMeta {
  slug: string;
  title: string;
  topics: string[];
  constraints: string;
  examples: CodingExample[];
  starterCode: Partial<Record<CodingLanguage, string>>;
  functionName: string;
  testCases: CodingTestCase[];
  timeLimitMs: number;
  compareMode?: 'deep' | 'unordered-array';
}

export interface TestCaseResult {
  index: number;
  passed: boolean;
  isSample: boolean;
  input: string;
  expected: string;
  actual: string;
  runtimeMs: number;
  error?: string;
}

export interface JudgeResult {
  passed: number;
  total: number;
  allPassed: boolean;
  results: TestCaseResult[];
  totalRuntimeMs: number;
}

export function parseCodingMeta(options: string | null): CodingProblemMeta | null {
  if (!options) return null;
  try {
    const parsed = JSON.parse(options);
    if (parsed && typeof parsed === 'object' && parsed.functionName && Array.isArray(parsed.testCases)) {
      return parsed as CodingProblemMeta;
    }
  } catch {
    return null;
  }
  return null;
}

/** Strip hidden test cases for student-facing API responses. */
export function sanitizeCodingMeta(meta: CodingProblemMeta): CodingProblemMeta {
  return {
    ...meta,
    testCases: meta.testCases.filter((tc) => tc.isSample),
  };
}

export function resolveFunctionArgs(args: unknown[][]): unknown[] {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0] as unknown[];
  }
  return args as unknown as unknown[];
}

export function formatArgs(args: unknown[][]): string {
  const fnArgs = resolveFunctionArgs(args);
  return fnArgs.map((a) => JSON.stringify(a)).join(', ');
}
