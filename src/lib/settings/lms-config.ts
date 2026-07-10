import { getGlobalBoolean, getGlobalNumber } from '@/lib/settings';

export type LmsSettings = {
  codingEnabled: boolean;
  codingDefaultTimeLimitMs: number;
  codingPythonEnabled: boolean;
  codingRunRateLimitPerMin: number;
  codingSubmitRateLimitPerMin: number;
  quizGradeWeightPct: number;
  assignmentGradeWeightPct: number;
  defaultAssignmentMaxScore: number;
  defaultAllowLateSubmissions: boolean;
  defaultLatePenaltyPct: number;
  quizDefaultPointsMcq: number;
  quizDefaultPointsCoding: number;
};

const DEFAULTS: LmsSettings = {
  codingEnabled: true,
  codingDefaultTimeLimitMs: 2000,
  codingPythonEnabled: false,
  codingRunRateLimitPerMin: 40,
  codingSubmitRateLimitPerMin: 15,
  quizGradeWeightPct: 15,
  assignmentGradeWeightPct: 25,
  defaultAssignmentMaxScore: 100,
  defaultAllowLateSubmissions: true,
  defaultLatePenaltyPct: 0,
  quizDefaultPointsMcq: 1,
  quizDefaultPointsCoding: 10,
};

export async function getLmsSettings(): Promise<LmsSettings> {
  const [
    codingEnabled,
    codingDefaultTimeLimitMs,
    codingPythonEnabled,
    codingRunRateLimitPerMin,
    codingSubmitRateLimitPerMin,
    quizGradeWeightPct,
    assignmentGradeWeightPct,
    defaultAssignmentMaxScore,
    defaultAllowLateSubmissions,
    defaultLatePenaltyPct,
    quizDefaultPointsMcq,
    quizDefaultPointsCoding,
  ] = await Promise.all([
    getGlobalBoolean('lms.coding_enabled', DEFAULTS.codingEnabled),
    getGlobalNumber('lms.coding_default_time_limit_ms', DEFAULTS.codingDefaultTimeLimitMs),
    getGlobalBoolean('lms.coding_python_enabled', DEFAULTS.codingPythonEnabled),
    getGlobalNumber('lms.coding_run_rate_limit_per_min', DEFAULTS.codingRunRateLimitPerMin),
    getGlobalNumber('lms.coding_submit_rate_limit_per_min', DEFAULTS.codingSubmitRateLimitPerMin),
    getGlobalNumber('lms.quiz_grade_weight_pct', DEFAULTS.quizGradeWeightPct),
    getGlobalNumber('lms.assignment_grade_weight_pct', DEFAULTS.assignmentGradeWeightPct),
    getGlobalNumber('lms.default_assignment_max_score', DEFAULTS.defaultAssignmentMaxScore),
    getGlobalBoolean('lms.default_allow_late_submissions', DEFAULTS.defaultAllowLateSubmissions),
    getGlobalNumber('lms.default_late_penalty_pct', DEFAULTS.defaultLatePenaltyPct),
    getGlobalNumber('lms.quiz_default_points_mcq', DEFAULTS.quizDefaultPointsMcq),
    getGlobalNumber('lms.quiz_default_points_coding', DEFAULTS.quizDefaultPointsCoding),
  ]);

  return {
    codingEnabled,
    codingDefaultTimeLimitMs,
    codingPythonEnabled,
    codingRunRateLimitPerMin,
    codingSubmitRateLimitPerMin,
    quizGradeWeightPct,
    assignmentGradeWeightPct,
    defaultAssignmentMaxScore,
    defaultAllowLateSubmissions,
    defaultLatePenaltyPct,
    quizDefaultPointsMcq,
    quizDefaultPointsCoding,
  };
}

export { DEFAULTS as DEFAULT_LMS_SETTINGS };
