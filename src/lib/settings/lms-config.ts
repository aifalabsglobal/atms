import { getGlobalBoolean, getGlobalNumber } from './service';

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
  enrollmentCapacityDefault: number;
  quizNegativeMarking: boolean;
  quizNegativePenaltyPct: number;
  quizShuffleQuestions: boolean;
  applyLatePenaltyOnGrade: boolean;
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
  enrollmentCapacityDefault: 0,
  quizNegativeMarking: false,
  quizNegativePenaltyPct: 25,
  quizShuffleQuestions: false,
  applyLatePenaltyOnGrade: true,
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
    enrollmentCapacityDefault,
    quizNegativeMarking,
    quizNegativePenaltyPct,
    quizShuffleQuestions,
    applyLatePenaltyOnGrade,
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
    getGlobalNumber('lms.enrollment_capacity_default', DEFAULTS.enrollmentCapacityDefault),
    getGlobalBoolean('lms.quiz_negative_marking', DEFAULTS.quizNegativeMarking),
    getGlobalNumber('lms.quiz_negative_penalty_pct', DEFAULTS.quizNegativePenaltyPct),
    getGlobalBoolean('lms.quiz_shuffle_questions', DEFAULTS.quizShuffleQuestions),
    getGlobalBoolean('lms.apply_late_penalty_on_grade', DEFAULTS.applyLatePenaltyOnGrade),
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
    enrollmentCapacityDefault,
    quizNegativeMarking,
    quizNegativePenaltyPct,
    quizShuffleQuestions,
    applyLatePenaltyOnGrade,
  };
}

export { DEFAULTS as DEFAULT_LMS_SETTINGS };
