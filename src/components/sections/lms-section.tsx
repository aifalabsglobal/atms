'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Users, FileText, ClipboardList, Clock, ChevronDown,
  ChevronRight, GraduationCap, Layers, CheckCircle2, AlertCircle,
  PenTool, CalendarDays, BarChart3, Award, Timer, HelpCircle,
  ListChecks, TrendingUp, BookMarked, Search, Filter, Send,
  Eye, Upload, MessageSquare, Star, AlertTriangle, CheckCircle,
  XCircle, Loader2, Trophy, Target, Zap, Plus, Code2, Pencil, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, useCanWriteLms, useCanViewLmsRoster, useSectionWrite, MASTERS_WRITE_ROLES } from '@/lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { CreateCourseDialog, CreateAssignmentDialog, EditAssignmentDialog, SubmitAssignmentDialog, CourseRosterDialog, GradeSubmissionsDialog, CreateQuizDialog, EditQuizDialog, TakeQuizDialog, ManageModulesDialog, CreateCodingProblemDialog } from '@/components/lms/lms-dialogs';
import { CodingWorkspace } from '@/components/lms/coding-workspace';

// ─── Type Definitions ───────────────────────────────────────────────────────

interface Program { name: string; code: string }
interface Instructor { name: string; email: string }
interface ModuleItem { id: string; title: string; orderIndex: number; isPublished: boolean; _count: { lessons: number } }

interface Course {
  id: string; code: string; name: string; credits: number; semester: number;
  type: 'core' | 'elective' | 'lab' | 'project'; description: string; isActive: boolean;
  program: Program | null; instructor: Instructor | null;
  _count: { enrollments: number; modules: number; assignments: number; attendanceSessions: number };
  modules: ModuleItem[];
}

interface CourseResponse { courses: Course[]; total: number }

interface MySubmission {
  id: string; score: number | null; status: string; feedback: string | null;
  submittedAt: string; gradedAt: string | null;
}

interface Assignment {
  id: string; title: string; description: string; type: 'individual' | 'group';
  maxScore: number; dueDate: string; status: 'draft' | 'published' | 'grading' | 'closed';
  allowLate: boolean; latePenalty: number;
  course: { name: string; code: string };
  _count: { submissions: number };
  stats: { totalSubmissions: number; avgScore: number | null; gradedCount: number };
  mySubmission?: MySubmission | null;
  myStatus?: 'not_started' | 'submitted' | 'graded' | 'late' | 'overdue';
}

interface AssignmentResponse { assignments: Assignment[]; total: number }

interface QuizQuestion {
  id: string; question: string; type: 'mcq' | 'true_false' | 'short_answer' | 'coding';
  options: string; correctAnswer: string; points: number; difficulty: 'easy' | 'medium' | 'hard';
  course: { name: string; code: string };
  codingMeta?: { slug: string; title: string; topics: string[] } | null;
}

interface QuizAttempt {
  id: string; studentId: string; courseId: string; score: number; totalPoints: number;
  percentage: number; timeTaken: number; status: 'completed' | 'in_progress' | 'abandoned';
  answers?: string;
  student: { name: string; employeeId: string };
  course: { name: string; code: string };
  startedAt: string;
}

interface QuizResponse {
  questions: QuizQuestion[]; attempts: QuizAttempt[]; total: number;
  summary: {
    totalQuestions: number; totalAttempts: number; avgScore: number; bestScore: number;
    courseBreakdown: { courseId: string; courseCode: string; courseName: string; count: number }[];
  };
}

// ─── Color Maps ─────────────────────────────────────────────────────────────

const courseTypeConfig: Record<string, { label: string; className: string }> = {
  core: { label: 'Core', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  elective: { label: 'Elective', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  lab: { label: 'Lab', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  project: { label: 'Project', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
};

const assignmentStatusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-secondary text-secondary-foreground' },
  published: { label: 'Published', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  grading: { label: 'Grading', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  closed: { label: 'Closed', className: 'bg-destructive/15 text-destructive dark:bg-destructive/30 dark:text-red-300 border-destructive/30' },
};

const myStatusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  not_started: { label: 'Pending', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300 border-slate-200 dark:border-slate-700', icon: Clock },
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800', icon: Send },
  graded: { label: 'Graded', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  late: { label: 'Late', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800', icon: AlertTriangle },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800', icon: XCircle },
};

const difficultyConfig: Record<string, { label: string; className: string }> = {
  easy: { label: 'Easy', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  hard: { label: 'Hard', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800' },
};

const quizTypeIcons: Record<string, React.ElementType> = {
  mcq: ListChecks,
  true_false: CheckCircle2,
  short_answer: PenTool,
  coding: Code2,
};

// ─── Helper Functions ───────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg shrink-0', color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="py-4">
            <CardContent className="flex items-center gap-3 px-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Course Card ────────────────────────────────────────────────────────────

function CourseCard({ course, canManageRoster, canViewRoster, onManageRoster, canManageModules, onManageModules, canDeleteCourse, onDeleteCourse }: {
  course: Course;
  canManageRoster?: boolean;
  canViewRoster?: boolean;
  onManageRoster?: (c: Course) => void;
  canManageModules?: boolean;
  onManageModules?: (c: Course) => void;
  canDeleteCourse?: boolean;
  onDeleteCourse?: (c: Course) => void;
}) {
  const [open, setOpen] = useState(false);
  const typeConf = courseTypeConfig[course.type] || courseTypeConfig.core;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn(
        'transition-all duration-200 hover:shadow-md cursor-pointer py-4',
        open && 'ring-2 ring-[#1A3C6E]/20'
      )}>
        <CollapsibleTrigger asChild>
          <div className="px-4">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className="bg-[#1A3C6E] text-white hover:bg-[#1A3C6E]/90 shrink-0 text-[11px] font-mono">
                    {course.code}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[11px] shrink-0', typeConf.className)}>
                    {typeConf.label}
                  </Badge>
                </div>
                <div className="shrink-0 text-muted-foreground">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </div>
              <CardTitle className="text-base leading-snug mt-1 truncate">{course.name}</CardTitle>
              <CardDescription className="text-xs flex items-center gap-1 mt-0.5" title={course.instructor?.name || 'TBA'}>
                <GraduationCap className="h-3 w-3 shrink-0" />
                <span className="truncate">{course.instructor?.name || 'TBA'}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 space-y-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={course.program ? `${course.program.name} (${course.program.code})` : 'No Program'}>
                <BookMarked className="h-3 w-3 shrink-0" />
                <span className="truncate">{course.program ? `${course.program.name} (${course.program.code})` : 'No Program'}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>Sem {course.semester}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Award className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{course.credits} Credits</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{course._count.enrollments} Enrolled</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{course._count.modules} Modules</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1 border-t">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span>{course._count.assignments} Assignments</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ClipboardList className="h-3 w-3" />
                  <span>{course._count.attendanceSessions} Sessions</span>
                </div>
              </div>
            </CardContent>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pt-3 border-t mt-3 space-y-3">
            {canManageRoster && onManageRoster && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 w-full" onClick={(e) => { e.stopPropagation(); onManageRoster(course); }}>
                <Users className="h-3.5 w-3.5" /> Manage Roster ({course._count.enrollments})
              </Button>
            )}
            {canViewRoster && !canManageRoster && onManageRoster && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 w-full" onClick={(e) => { e.stopPropagation(); onManageRoster(course); }}>
                <Users className="h-3.5 w-3.5" /> View Roster ({course._count.enrollments})
              </Button>
            )}
            {canManageModules && onManageModules && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 w-full" onClick={(e) => { e.stopPropagation(); onManageModules(course); }}>
                <Layers className="h-3.5 w-3.5" /> Manage Modules ({course._count.modules})
              </Button>
            )}
            {canDeleteCourse && onDeleteCourse && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 w-full text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteCourse(course); }}>
                <Trash2 className="h-3.5 w-3.5" /> {course._count.enrollments > 0 ? 'Deactivate Course' : 'Delete Course'}
              </Button>
            )}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Course Modules
            </p>
            {course.modules.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {course.modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="flex items-center justify-between gap-2 rounded-md px-3 py-2 bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex items-center justify-center h-5 w-5 rounded bg-[#1A3C6E]/10 text-[10px] font-bold text-[#1A3C6E] dark:text-[#7BA5E0] shrink-0">
                        {mod.orderIndex + 1}
                      </span>
                      <span className="text-sm truncate">{mod.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {mod._count.lessons}
                      </span>
                      {mod.isPublished ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2">No modules available</p>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Student Assignments Tab ────────────────────────────────────────────────

function StudentAssignmentsTab({ assignments, onSubmit }: { assignments: Assignment[]; onSubmit: (a: Assignment) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending = assignments.filter(a => a.myStatus === 'not_started' || a.myStatus === 'overdue');
  const submitted = assignments.filter(a => a.myStatus === 'submitted' || a.myStatus === 'late');
  const graded = assignments.filter(a => a.myStatus === 'graded');
  const overdueCount = assignments.filter(a => a.myStatus === 'overdue').length;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{pending.length}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Send className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{submitted.length}</p>
              <p className="text-[10px] text-muted-foreground">Submitted</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{graded.length}</p>
              <p className="text-[10px] text-muted-foreground">Graded</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', overdueCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted')}>
              <AlertTriangle className={cn('h-4 w-4', overdueCount > 0 ? 'text-red-600' : 'text-muted-foreground')} />
            </div>
            <div>
              <p className={cn('text-lg font-bold', overdueCount > 0 && 'text-red-600')}>{overdueCount}</p>
              <p className="text-[10px] text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assignments List */}
      <div className="space-y-3">
        {assignments.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No assignments found for your enrolled courses</p>
            </CardContent>
          </Card>
        ) : (
          assignments.map((a) => {
            const statusConf = myStatusConfig[a.myStatus || 'not_started'] || myStatusConfig.not_started;
            const StatusIcon = statusConf.icon;
            const days = daysUntil(a.dueDate);
            const isExpanded = expandedId === a.id;

            return (
              <Card key={a.id} className={cn(
                'py-3 transition-all',
                a.myStatus === 'overdue' && 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10',
                isExpanded && 'ring-1 ring-[#1A3C6E]/20'
              )}>
                <Collapsible open={isExpanded} onOpenChange={(open) => setExpandedId(open ? a.id : null)}>
                  <CollapsibleTrigger asChild>
                    <div className="px-4 cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className="bg-[#1A3C6E] text-white hover:bg-[#1A3C6E]/90 text-[10px] font-mono shrink-0">
                              {a.course.code}
                            </Badge>
                            <Badge variant="outline" className={cn('text-[10px] shrink-0', statusConf.className)}>
                              <StatusIcon className="h-3 w-3 mr-0.5" />
                              {statusConf.label}
                            </Badge>
                            {a.myStatus === 'graded' && a.mySubmission?.score != null && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0">
                                <Star className="h-3 w-3 mr-0.5" />
                                {a.mySubmission.score}/{a.maxScore}
                              </Badge>
                            )}
                          </div>
                          <p className={cn('text-sm font-medium', a.myStatus === 'overdue' && 'text-red-700 dark:text-red-400')}>
                            {a.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(a.dueDate)}
                            </span>
                            {a.myStatus !== 'graded' && days >= 0 && days <= 7 && (
                              <span className={cn('text-[10px] font-medium', days <= 2 ? 'text-red-600' : 'text-amber-600')}>
                                {days === 0 ? 'Due today!' : `${days} day${days > 1 ? 's' : ''} left`}
                              </span>
                            )}
                            {a.myStatus === 'overdue' && (
                              <span className="text-[10px] font-medium text-red-600">
                                {Math.abs(days)} day{Math.abs(days) > 1 ? 's' : ''} overdue
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pt-3 mt-2 border-t space-y-3">
                      {a.description && (
                        <p className="text-xs text-muted-foreground">{a.description}</p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Score</p>
                          <p className="text-sm font-semibold">{a.maxScore}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</p>
                          <p className="text-sm capitalize">{a.type}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Late Allowed</p>
                          <p className="text-sm">{a.allowLate ? `Yes (${a.latePenalty}% penalty)` : 'No'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Submissions</p>
                          <p className="text-sm">{a._count.submissions}</p>
                        </div>
                      </div>

                      {/* Submission details */}
                      {a.mySubmission ? (
                        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold">Your Submission</p>
                            <Badge variant="outline" className={cn('text-[10px]', statusConf.className)}>
                              <StatusIcon className="h-3 w-3 mr-0.5" />
                              {statusConf.label}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Submitted:</span>
                              <span className="ml-1">{new Date(a.mySubmission.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {a.mySubmission.gradedAt && (
                              <div>
                                <span className="text-muted-foreground">Graded:</span>
                                <span className="ml-1">{new Date(a.mySubmission.gradedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                              </div>
                            )}
                            {a.mySubmission.score != null && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground">Score:</span>
                                <span className={cn('ml-1 font-bold text-base', (a.mySubmission.score / a.maxScore) >= 0.8 ? 'text-emerald-600' : (a.mySubmission.score / a.maxScore) >= 0.5 ? 'text-amber-600' : 'text-red-600')}>
                                  {a.mySubmission.score}/{a.maxScore}
                                </span>
                                <Progress value={(a.mySubmission.score / a.maxScore) * 100} className="h-1.5 mt-1" />
                              </div>
                            )}
                            {a.mySubmission.feedback && (
                              <div className="col-span-2 mt-1 p-2 rounded bg-background border">
                                <div className="flex items-center gap-1 mb-1">
                                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] font-semibold text-muted-foreground">Feedback</span>
                                </div>
                                <p className="text-xs">{a.mySubmission.feedback}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          {a.myStatus === 'overdue' ? (
                            <Badge variant="destructive" className="text-[10px]">
                              <XCircle className="h-3 w-3 mr-0.5" /> Deadline passed
                            </Badge>
                          ) : a.status === 'published' ? (
                            <Button size="sm" className="h-7 text-xs bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white gap-1" onClick={() => onSubmit(a)}>
                              <Upload className="h-3 w-3" /> Submit Assignment
                            </Button>
                          ) : null}
                        </div>
                      )}

                      {/* Class average (if graded) */}
                      {a.stats.avgScore !== null && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1 border-t">
                          <BarChart3 className="h-3 w-3" />
                          Class average: {a.stats.avgScore}% • {a.stats.gradedCount} graded out of {a.stats.totalSubmissions} submissions
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Student Quizzes Tab ────────────────────────────────────────────────────

function StudentQuizzesTab({ questions, attempts, summary, onTakeQuiz }: {
  questions: QuizQuestion[]; attempts: QuizAttempt[];
  summary: QuizResponse['summary'];
  onTakeQuiz?: () => void;
}) {
  return (
    <div className="space-y-6">
      {onTakeQuiz && questions.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5 bg-[#1A3C6E] text-white" onClick={onTakeQuiz}>
            <Zap className="h-3.5 w-3.5" /> Take Quiz
          </Button>
        </div>
      )}
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center shrink-0">
              <HelpCircle className="h-4 w-4 text-[#1A3C6E]" />
            </div>
            <div>
              <p className="text-lg font-bold">{summary.totalQuestions}</p>
              <p className="text-[10px] text-muted-foreground">Questions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <ClipboardList className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{summary.totalAttempts}</p>
              <p className="text-[10px] text-muted-foreground">Attempts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Target className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{summary.avgScore}%</p>
              <p className="text-[10px] text-muted-foreground">Avg Score</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{Math.round(summary.bestScore)}%</p>
              <p className="text-[10px] text-muted-foreground">Best Score</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Quiz Attempts */}
      <Card className="py-4">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Timer className="h-4 w-4 text-[#1A3C6E]" />
            My Quiz Attempts
          </CardTitle>
          <CardDescription>{attempts.length} attempts recorded</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pt-2">
          {attempts.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No quiz attempts yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Your quiz attempts will appear here</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {attempts.map((at) => {
                  const pctColor =
                    at.percentage >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                    at.percentage >= 50 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400';
                  const progressColor =
                    at.percentage >= 80 ? '[&>div]:bg-emerald-500' :
                    at.percentage >= 50 ? '[&>div]:bg-amber-500' :
                    '[&>div]:bg-red-500';

                  return (
                    <div key={at.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                        at.percentage >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                        at.percentage >= 50 ? 'bg-amber-100 dark:bg-amber-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      )}>
                        <span className={cn('text-sm font-bold', pctColor)}>{Math.round(at.percentage)}%</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className="text-[10px] font-mono bg-[#1A3C6E] text-white shrink-0">{at.course.code}</Badge>
                          <span className="text-sm font-medium truncate">{at.course.name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1.5 flex-1 min-w-[80px]">
                            <Progress value={at.percentage} className={cn('h-1.5 flex-1', progressColor)} />
                            <span className={cn('text-[10px] font-semibold w-8 text-right', pctColor)}>{at.score}/{at.totalPoints}</span>
                          </div>
                          {at.timeTaken && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />{formatTime(at.timeTaken)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] capitalize shrink-0',
                          at.status === 'completed' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                          at.status === 'in_progress' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                          at.status === 'abandoned' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
                        )}
                      >
                        {at.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Question Bank Preview */}
      {questions.length > 0 && (
        <Card className="py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#1A3C6E]" />
              Practice Questions
            </CardTitle>
            <CardDescription>{questions.length} questions available for practice</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-2">
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {questions.slice(0, 10).map((q, idx) => {
                  const TypeIcon = quizTypeIcons[q.type] || HelpCircle;
                  const diffConf = difficultyConfig[q.difficulty] || difficultyConfig.medium;
                  return (
                    <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="h-6 w-6 rounded bg-[#1A3C6E]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-[#1A3C6E]">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs line-clamp-2">{q.question}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[9px]">
                            <TypeIcon className="h-2.5 w-2.5 mr-0.5" />
                            {q.type === 'true_false' ? 'T/F' : q.type.replace('_', ' ')}
                          </Badge>
                          <Badge className="text-[9px] font-mono bg-[#1A3C6E] text-white">{q.course.code}</Badge>
                          <Badge variant="outline" className={cn('text-[9px]', diffConf.className)}>{diffConf.label}</Badge>
                          <span className="text-[9px] text-muted-foreground">{q.points} pts</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Admin Assignments Tab ──────────────────────────────────────────────────

function AdminAssignmentsTab({ assignments, onGrade, onEdit, onDelete }: {
  assignments: Assignment[];
  onGrade: (a: Assignment) => void;
  onEdit?: (a: Assignment) => void;
  onDelete?: (a: Assignment) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const chartData = assignments
    .filter(a => a.stats.avgScore !== null)
    .map(a => ({
      name: a.title.length > 15 ? a.title.substring(0, 15) + '…' : a.title,
      avgScore: a.stats.avgScore ?? 0,
      submissions: a.stats.totalSubmissions,
    }));

  return (
    <div className="space-y-6">
      {chartData.length > 0 && (
        <Card className="py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#1A3C6E]" />
              Average Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="avgScore" fill="#1A3C6E" radius={[4, 4, 0, 0]} name="Avg Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="py-4">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#1A3C6E]" />
            All Assignments
          </CardTitle>
          <CardDescription>Click a row to view submission stats</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pt-2">
          <ScrollArea className="max-h-[520px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Course</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="text-right">Max Score</TableHead>
                  <TableHead className="hidden sm:table-cell">Due Date</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Submissions</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Avg Score</TableHead>
                  <TableHead>Status</TableHead>
                  {(onEdit || onDelete) && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => {
                  const statusConf = assignmentStatusConfig[a.status] || assignmentStatusConfig.draft;
                  const overdue = a.status !== 'closed' && isOverdue(a.dueDate);
                  const isExpanded = expandedId === a.id;

                  return (
                    <Collapsible key={a.id} open={isExpanded} onOpenChange={(open) => setExpandedId(open ? a.id : null)}>
                      <CollapsibleTrigger asChild>
                        <TableRow className={cn(
                          'cursor-pointer transition-colors',
                          overdue && 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-950/30',
                          isExpanded && 'bg-muted/50'
                        )}>
                          <TableCell>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className={cn('font-medium text-sm', overdue && 'text-destructive')}>{a.title}</span>
                              <span className="text-xs text-muted-foreground sm:hidden">{a.course.code}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-xs font-mono text-muted-foreground">{a.course.code}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className="text-[11px] capitalize">{a.type}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{a.maxScore}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className={cn('text-xs', overdue && 'text-destructive font-medium')}>{formatDate(a.dueDate)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right hidden md:table-cell">
                            <span className="text-sm">{a._count.submissions}</span>
                          </TableCell>
                          <TableCell className="text-right hidden lg:table-cell">
                            <span className="text-sm font-medium">{a.stats.avgScore !== null ? `${a.stats.avgScore}%` : '—'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={cn('text-[11px]', statusConf.className)}>{statusConf.label}</Badge>
                              {overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                            </div>
                          </TableCell>
                          {(onEdit || onDelete) && (
                            <TableCell>
                              <div className="flex gap-0.5">
                                {onEdit && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(a); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(a); }}>
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={onEdit || onDelete ? 10 : 9} className="p-0">
                            <div className="px-6 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Submissions</p>
                                  <p className="text-lg font-bold">{a.stats.totalSubmissions}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Graded</p>
                                  <p className="text-lg font-bold">{a.stats.gradedCount}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Avg Score</p>
                                  <p className="text-lg font-bold">{a.stats.avgScore !== null ? `${a.stats.avgScore}%` : 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Grading Progress</p>
                                  <div className="flex items-center gap-2">
                                    <Progress value={a.stats.totalSubmissions > 0 ? (a.stats.gradedCount / a.stats.totalSubmissions) * 100 : 0} className="h-2 flex-1" />
                                    <span className="text-xs text-muted-foreground">{a.stats.totalSubmissions > 0 ? Math.round((a.stats.gradedCount / a.stats.totalSubmissions) * 100) : 0}%</span>
                                  </div>
                                </div>
                              </div>
                              {a.description && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{a.description}</p>}
                              <div className="flex flex-wrap gap-2 mt-3">
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => onGrade(a)}>
                                  <PenTool className="h-3.5 w-3.5" /> Grade Submissions ({a._count.submissions})
                                </Button>
                                {onEdit && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => onEdit(a)}>
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                  </Button>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin Quizzes Tab ──────────────────────────────────────────────────────

function AdminQuizzesTab({ questions, attempts, onCreateQuiz, onEditQuiz }: {
  questions: QuizQuestion[];
  attempts: QuizAttempt[];
  onCreateQuiz?: () => void;
  onEditQuiz?: (q: QuizQuestion) => void;
}) {
  const qc = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lms/quizzes?id=${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lms-quizzes'] }),
  });

  const attemptChartData = attempts.slice(0, 8).map(at => ({
    name: at.student.name.length > 10 ? at.student.name.substring(0, 10) + '…' : at.student.name,
    score: at.percentage,
  }));

  return (
    <div className="space-y-6">
      {attemptChartData.length > 0 && (
        <Card className="py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#1A3C6E]" />
              Quiz Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-2">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attemptChartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value: number) => [`${value}%`, 'Score']} />
                  <Bar dataKey="score" fill="#1A3C6E" radius={[4, 4, 0, 0]} name="Score %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="py-4">
        <CardHeader className="px-4 pb-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-[#1A3C6E]" />
                Question Bank
              </CardTitle>
              <CardDescription>{questions.length} questions available</CardDescription>
            </div>
            {onCreateQuiz && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onCreateQuiz}>
                <Plus className="h-3 w-3" /> Add Question
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-2">
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Course</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="hidden sm:table-cell">Difficulty</TableHead>
                  {onCreateQuiz && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q, idx) => {
                  const TypeIcon = quizTypeIcons[q.type] || HelpCircle;
                  const diffConf = difficultyConfig[q.difficulty] || difficultyConfig.medium;
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell><span className="text-sm line-clamp-2 max-w-xs">{q.question}</span></TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs capitalize">{q.type === 'true_false' ? 'True/False' : q.type.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell"><span className="text-xs font-mono text-muted-foreground">{q.course.code}</span></TableCell>
                      <TableCell className="text-right"><span className="text-sm font-medium">{q.points}</span></TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className={cn('text-[11px]', diffConf.className)}>{diffConf.label}</Badge>
                      </TableCell>
                      {onCreateQuiz && (
                        <TableCell>
                          <div className="flex gap-0.5">
                            {onEditQuiz && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditQuiz(q)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(q.id)} disabled={deleteMut.isPending}>
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Timer className="h-4 w-4 text-[#1A3C6E]" />
            Recent Attempts
          </CardTitle>
          <CardDescription>{attempts.length} attempts recorded</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pt-2">
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Course</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="hidden md:table-cell">Percentage</TableHead>
                  <TableHead className="hidden lg:table-cell">Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((at) => {
                  const pctColor = at.percentage >= 80 ? 'text-emerald-600 dark:text-emerald-400' : at.percentage >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
                  const progressColor = at.percentage >= 80 ? '[&>div]:bg-emerald-500' : at.percentage >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500';
                  return (
                    <TableRow key={at.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{at.student.name}</span>
                          <span className="text-[11px] text-muted-foreground">{at.student.employeeId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell"><span className="text-xs font-mono text-muted-foreground">{at.course.code}</span></TableCell>
                      <TableCell><span className={cn('text-sm font-semibold', pctColor)}>{at.score}/{at.totalPoints}</span></TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={at.percentage} className={cn('h-2 flex-1', progressColor)} />
                          <span className={cn('text-xs font-medium w-10 text-right', pctColor)}>{at.percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />{formatTime(at.timeTaken ?? 0)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          'text-[11px] capitalize',
                          at.status === 'completed' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                          at.status === 'in_progress' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                          at.status === 'abandoned' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
                        )}>
                          {at.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Gradebook Tab ──────────────────────────────────────────────────────────

interface GradebookRow {
  student: { id: string; name: string; email: string; employeeId: string | null };
  components: { component: string; score: number; maxScore: number; weightage: number; pct: number }[];
  bestQuizPct: number | null;
  overallPct: number | null;
}

function GradebookTab({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['lms-gradebook', courseId],
    queryFn: () => fetch(`/api/lms/gradebook?courseId=${courseId}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load gradebook');
      return r.json();
    }),
    enabled: !!courseId,
  });

  const rows: GradebookRow[] = data?.gradebook ?? [];

  return (
    <Card className="py-4">
      <CardHeader className="px-4 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-[#1A3C6E]" />
          Gradebook
        </CardTitle>
        <CardDescription>Weighted grades per enrolled student</CardDescription>
      </CardHeader>
      <CardContent className="px-4 space-y-4">
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No courses available</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {courses.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={courseId === c.id ? 'default' : 'outline'}
                  className={cn('h-7 text-xs', courseId === c.id && 'bg-[#1A3C6E] text-white')}
                  onClick={() => setCourseId(c.id)}
                >
                  {c.code}
                </Button>
              ))}
            </div>
            {isLoading ? (
              <LoadingSkeleton />
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No enrolled students or grades yet.</p>
            ) : (
              <ScrollArea className="max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="hidden sm:table-cell">ID</TableHead>
                      <TableHead className="text-right">Components</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Best Quiz</TableHead>
                      <TableHead className="text-right">Overall</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.student.id}>
                        <TableCell className="font-medium text-sm">{row.student.name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs font-mono text-muted-foreground">
                          {row.student.employeeId || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {row.components.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : row.components.slice(0, 4).map((c, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] capitalize">
                                {c.component}: {c.pct}%
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell text-sm">
                          {row.bestQuizPct !== null ? `${row.bestQuizPct}%` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.overallPct !== null ? (
                            <span className={cn(
                              'text-sm font-bold',
                              row.overallPct >= 75 ? 'text-emerald-600' : row.overallPct >= 50 ? 'text-amber-600' : 'text-destructive'
                            )}>
                              {row.overallPct}%
                            </span>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StudentGradebookTab({ studentId, courses }: { studentId: string; courses: Course[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['lms-gradebook', courseId, studentId],
    queryFn: () => fetch(`/api/lms/gradebook?courseId=${courseId}&studentId=${studentId}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load grades');
      return r.json();
    }),
    enabled: !!courseId,
  });

  const row: GradebookRow | undefined = data?.gradebook?.[0];

  return (
    <Card className="py-4">
      <CardHeader className="px-4 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-[#1A3C6E]" />
          My Grades
        </CardTitle>
        <CardDescription>Your scores and weighted overall per course</CardDescription>
      </CardHeader>
      <CardContent className="px-4 space-y-4">
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">You are not enrolled in any courses yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {courses.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={courseId === c.id ? 'default' : 'outline'}
                  className={cn('h-7 text-xs', courseId === c.id && 'bg-[#1A3C6E] text-white')}
                  onClick={() => setCourseId(c.id)}
                >
                  {c.code}
                </Button>
              ))}
            </div>
            {isLoading ? (
              <LoadingSkeleton />
            ) : !row ? (
              <p className="text-sm text-muted-foreground text-center py-8">No grades recorded for this course yet.</p>
            ) : (
              <div className="space-y-4">
                {row.overallPct !== null && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-[#1A3C6E]/5 border">
                    <span className="text-sm font-medium">Overall Grade</span>
                    <span className={cn(
                      'text-2xl font-bold',
                      row.overallPct >= 75 ? 'text-emerald-600' : row.overallPct >= 50 ? 'text-amber-600' : 'text-destructive'
                    )}>
                      {row.overallPct}%
                    </span>
                  </div>
                )}
                <div className="grid gap-2">
                  {row.components.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                      <span className="capitalize font-medium">{c.component}</span>
                      <span>{c.score}/{c.maxScore} ({c.pct}%)</span>
                    </div>
                  ))}
                  {row.bestQuizPct !== null && (
                    <div className="flex items-center justify-between p-3 rounded-lg border text-sm">
                      <span className="font-medium">Best Quiz</span>
                      <span>{row.bestQuizPct}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main LMS Section ───────────────────────────────────────────────────────

export default function LmsSection() {
  const [activeTab, setActiveTab] = useState('courses');
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [createAssignmentOpen, setCreateAssignmentOpen] = useState(false);
  const [createQuizOpen, setCreateQuizOpen] = useState(false);
  const [createCodingOpen, setCreateCodingOpen] = useState(false);
  const [quizSubTab, setQuizSubTab] = useState('coding');
  const [takeQuizOpen, setTakeQuizOpen] = useState(false);
  const [submitAssignment, setSubmitAssignment] = useState<Assignment | null>(null);
  const [rosterCourse, setRosterCourse] = useState<Course | null>(null);
  const [modulesCourse, setModulesCourse] = useState<Course | null>(null);
  const [gradeAssignment, setGradeAssignment] = useState<Assignment | null>(null);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [editQuiz, setEditQuiz] = useState<QuizQuestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'assignment' | 'course' | 'coding'; id: string; label: string; hasEnrollments?: boolean } | null
  >(null);
  const { toast } = useToast();
  const { currentUser, sectionContext, setSectionContext } = useAppStore();

  useEffect(() => {
    if (sectionContext?.lmsTab) {
      setActiveTab(sectionContext.lmsTab);
      setSectionContext(null);
    }
  }, [sectionContext, setSectionContext]);

  const canWriteLms = useCanWriteLms();
  const isHodLmsReadOnly = useCanViewLmsRoster() && !canWriteLms;
  const canCreateCourse = useSectionWrite('lms', MASTERS_WRITE_ROLES);
  const canDeleteCourse = useSectionWrite('lms', MASTERS_WRITE_ROLES);
  const canManage = canWriteLms || isHodLmsReadOnly;

  if (!currentUser) return null;
  const isStudent = currentUser.role === 'student';
  const isParent = currentUser.role === 'parent';
  const isLearner = isStudent || isParent;
  const learnerQueryKey = isStudent ? currentUser.id : isParent ? (currentUser.linkedStudentId ?? 'ward') : 'all';
  const learnerStudentId = isStudent ? currentUser.id : currentUser.linkedStudentId;
  const qc = useQueryClient();
  const deleteAssignmentMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lms/assignments?id=${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-assignments'] });
      toast({ title: 'Assignment deleted' });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });
  const deleteCourseMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lms/courses?id=${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      toast({ title: d.deactivated ? 'Course deactivated' : 'Course deleted', description: d.message });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });
  const deleteQuizMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lms/quizzes?id=${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-quizzes'] });
      qc.invalidateQueries({ queryKey: ['lms-coding-problems'] });
      toast({ title: 'Problem deleted' });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const { data: courseData, isLoading: coursesLoading } = useQuery<CourseResponse>({
    queryKey: ['lms-courses'],
    queryFn: () => fetch('/api/lms/courses?page=1&limit=20').then(r => r.json()),
  });

  const { data: assignmentData, isLoading: assignmentsLoading } = useQuery<AssignmentResponse>({
    queryKey: ['lms-assignments', learnerQueryKey],
    queryFn: () => fetch(`/api/lms/assignments?page=1&limit=20${isStudent ? `&studentId=${currentUser.id}` : ''}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load assignments');
      return r.json();
    }),
  });

  const { data: quizData, isLoading: quizzesLoading } = useQuery<QuizResponse>({
    queryKey: ['lms-quizzes', learnerQueryKey],
    queryFn: () => fetch(`/api/lms/quizzes${isStudent ? `?studentId=${currentUser.id}` : ''}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load quizzes');
      return r.json();
    }),
  });

  const courses = courseData?.courses ?? [];
  const assignments = assignmentData?.assignments ?? [];
  const questions = quizData?.questions ?? [];
  const attempts = quizData?.attempts ?? [];

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'assignment') deleteAssignmentMut.mutate(deleteTarget.id);
    else if (deleteTarget.kind === 'course') deleteCourseMut.mutate(deleteTarget.id);
    else deleteQuizMut.mutate(deleteTarget.id);
  };
  const quizSummary = quizData?.summary ?? { totalQuestions: 0, totalAttempts: 0, avgScore: 0, bestScore: 0, courseBreakdown: [] };

  const totalCourses = courseData?.total ?? 0;
  const totalAssignments = assignmentData?.total ?? 0;
  const totalQuizzes = quizData?.total ?? 0;
  const totalEnrollments = courses.reduce((sum, c) => sum + c._count.enrollments, 0);

  // Student-specific stats
  const studentPending = assignments.filter(a => a.myStatus === 'not_started' || a.myStatus === 'overdue').length;
  const studentGraded = assignments.filter(a => a.myStatus === 'graded').length;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#1A3C6E] dark:text-[#7BA5E0] flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            {isLearner ? (isParent ? "My Ward's Learning" : 'My Learning') : 'Learning Management'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isLearner ? (isParent ? "Your ward's courses, assignments, and assessments" : 'Your courses, assignments, and assessments') : isHodLmsReadOnly ? 'View department courses, assignments, and assessments (read-only)' : 'Manage courses, assignments, and assessments'}
          </p>
          {isHodLmsReadOnly && (
            <Badge variant="outline" className="mt-2 text-[10px] border-amber-300 text-amber-700">HOD read-only LMS</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canCreateCourse && (
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-[#1A3C6E] text-white" onClick={() => setCreateCourseOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Course
            </Button>
          )}
          {canWriteLms && !isLearner && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setCreateAssignmentOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Assignment
            </Button>
          )}
          {canWriteLms && !isLearner && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setCreateCodingOpen(true)}>
              <Code2 className="h-3.5 w-3.5" /> Add Coding Problem
            </Button>
          )}
          {canWriteLms && !isLearner && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setCreateQuizOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add MCQ
            </Button>
          )}
          {isLearner && (
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-[#1A3C6E] text-white" onClick={() => { setActiveTab('quizzes'); setQuizSubTab('coding'); }}>
              <Code2 className="h-3.5 w-3.5" /> Code Practice
            </Button>
          )}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label={isLearner ? 'Enrolled Courses' : 'Total Courses'} value={totalCourses} color="bg-[#1A3C6E]" />
        <StatCard icon={isLearner ? ClipboardList : Users} label={isLearner ? 'Pending Assignments' : 'Enrollments'} value={isLearner ? studentPending : totalEnrollments} color={isLearner ? 'bg-amber-600' : 'bg-emerald-600'} />
        <StatCard icon={isLearner ? CheckCircle2 : FileText} label={isLearner ? 'Graded' : 'Assignments'} value={isLearner ? studentGraded : totalAssignments} color={isLearner ? 'bg-emerald-600' : 'bg-amber-600'} />
        <StatCard icon={isLearner ? Trophy : HelpCircle} label={isLearner ? 'Quiz Best' : 'Quiz Questions'} value={isLearner ? `${Math.round(quizSummary.bestScore)}%` : totalQuizzes} color="bg-purple-600" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="courses" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" />
            Courses
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-4 w-4" />
            {isLearner ? (isParent ? "Ward's Assignments" : 'My Assignments') : 'Assignments'}
          </TabsTrigger>
          <TabsTrigger value="quizzes" className="gap-1.5 text-xs sm:text-sm">
            <ClipboardList className="h-4 w-4" />
            {isLearner ? (isParent ? "Ward's Quizzes" : 'My Quizzes') : 'Quizzes'}
          </TabsTrigger>
          {(canWriteLms || isHodLmsReadOnly) && !isLearner && (
            <TabsTrigger value="rosters" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              Rosters
            </TabsTrigger>
          )}
          {(canManage || isLearner) && (
            <TabsTrigger value="gradebook" className="gap-1.5 text-xs sm:text-sm">
              <Award className="h-4 w-4" />
              {isLearner ? (isParent ? "Ward's Grades" : 'My Grades') : 'Gradebook'}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Courses Tab */}
        <TabsContent value="courses">
          {coursesLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {courses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map(course => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      canManageRoster={canWriteLms && !isLearner}
                      canViewRoster={isHodLmsReadOnly && !isLearner}
                      onManageRoster={setRosterCourse}
                      canManageModules={canWriteLms && !isLearner}
                      onManageModules={setModulesCourse}
                      canDeleteCourse={canDeleteCourse}
                      onDeleteCourse={(c) => setDeleteTarget({
                        kind: 'course',
                        id: c.id,
                        label: c.code,
                        hasEnrollments: c._count.enrollments > 0,
                      })}
                    />
                  ))}
                </div>
              ) : (
                <Card className="py-12">
                  <CardContent className="flex flex-col items-center justify-center text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No courses found</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Courses will appear here once they are created</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments">
          {assignmentsLoading ? (
            <LoadingSkeleton />
          ) : isLearner ? (
            <StudentAssignmentsTab assignments={assignments} onSubmit={setSubmitAssignment} />
          ) : (
            <AdminAssignmentsTab
              assignments={assignments}
              onGrade={setGradeAssignment}
              onEdit={canWriteLms ? setEditAssignment : undefined}
              onDelete={canWriteLms ? (a) => setDeleteTarget({ kind: 'assignment', id: a.id, label: a.title }) : undefined}
            />
          )}
        </TabsContent>

        {(canWriteLms || isHodLmsReadOnly) && !isLearner && (
          <TabsContent value="rosters">
            <Card className="py-4">
              <CardHeader className="px-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#1A3C6E]" />
                  Class Rosters
                </CardTitle>
                <CardDescription>
                  {isHodLmsReadOnly ? 'View enrolled students per course (read-only)' : 'View and manage enrolled students per course'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                {coursesLoading ? (
                  <LoadingSkeleton />
                ) : courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No courses available</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Instructor</TableHead>
                        <TableHead className="text-right">Enrolled</TableHead>
                        <TableHead className="w-28" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs font-semibold">{c.code}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{c.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.instructor?.name || 'TBA'}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{c._count.enrollments}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRosterCourse(c)}>
                              {isHodLmsReadOnly ? 'View' : 'Manage'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Quizzes Tab */}
        <TabsContent value="quizzes">
          {quizzesLoading ? (
            <LoadingSkeleton />
          ) : (
            <div className="space-y-4">
              <Tabs value={quizSubTab} onValueChange={setQuizSubTab}>
                <TabsList>
                  <TabsTrigger value="coding" className="gap-1.5 text-xs">
                    <Code2 className="h-3.5 w-3.5" /> Coding Practice
                  </TabsTrigger>
                  <TabsTrigger value="mcq" className="gap-1.5 text-xs">
                    <ClipboardList className="h-3.5 w-3.5" /> {isLearner ? 'MCQ Quizzes' : 'MCQ Bank'}
                  </TabsTrigger>
                  <TabsTrigger value="submissions" className="gap-1.5 text-xs">
                    <Trophy className="h-3.5 w-3.5" /> Submissions
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="coding" className="mt-4">
                  <CodingWorkspace
                    learnerMode={isLearner || canManage}
                    onEditProblem={canWriteLms && !isLearner ? (p) => setEditQuiz({
                      id: p.id,
                      question: p.question,
                      type: 'coding',
                      options: '',
                      correctAnswer: '',
                      points: p.points,
                      difficulty: p.difficulty,
                      course: p.course,
                      codingMeta: p.codingMeta,
                    }) : undefined}
                    onDeleteProblem={canWriteLms && !isLearner ? (id) => {
                      const p = questions.find((q) => q.id === id);
                      setDeleteTarget({ kind: 'coding', id, label: p?.codingMeta?.slug ?? p?.question?.slice(0, 30) ?? 'problem' });
                    } : undefined}
                  />
                </TabsContent>
                <TabsContent value="mcq" className="mt-4">
                  {isLearner ? (
                    <StudentQuizzesTab
                      questions={questions.filter((q) => q.type !== 'coding')}
                      attempts={attempts}
                      summary={quizSummary}
                      onTakeQuiz={() => setTakeQuizOpen(true)}
                    />
                  ) : (
                    <AdminQuizzesTab
                      questions={questions.filter((q) => q.type !== 'coding')}
                      attempts={attempts}
                      onCreateQuiz={() => setCreateQuizOpen(true)}
                      onEditQuiz={setEditQuiz}
                    />
                  )}
                </TabsContent>
                <TabsContent value="submissions" className="mt-4">
                  <Card className="py-4">
                    <CardHeader className="px-4 pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Timer className="h-4 w-4 text-[#1A3C6E]" />
                        Recent Submissions
                      </CardTitle>
                      <CardDescription>{attempts.length} attempts (coding + MCQ)</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4">
                      {attempts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No submissions yet.</p>
                      ) : (
                        <ScrollArea className="max-h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {canManage && !isLearner && <TableHead>Student</TableHead>}
                                <TableHead>Course</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Time</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {attempts.map((at) => {
                                let statusLabel = at.status.replace('_', ' ');
                                try {
                                  const ans = typeof at.answers === 'string' ? JSON.parse(at.answers) : at.answers;
                                  if (ans?.status) statusLabel = ans.status;
                                } catch { /* mcq attempt */ }
                                return (
                                  <TableRow key={at.id}>
                                    {canWriteLms && !isLearner && (
                                      <TableCell className="text-sm">{at.student.name}</TableCell>
                                    )}
                                    <TableCell className="font-mono text-xs">{at.course.code}</TableCell>
                                    <TableCell className="text-sm font-semibold">{Math.round(at.percentage)}%</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={cn(
                                        'text-[10px]',
                                        statusLabel === 'Accepted' && 'text-emerald-600 border-emerald-300',
                                        statusLabel === 'Wrong Answer' && 'text-red-600 border-red-300',
                                      )}>
                                        {statusLabel}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {at.timeTaken ? formatTime(at.timeTaken) : '—'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </TabsContent>

        <TabsContent value="gradebook">
          {isLearner && learnerStudentId ? (
            <StudentGradebookTab studentId={learnerStudentId} courses={courses} />
          ) : isLearner ? (
            <Card className="py-12"><CardContent className="text-center text-sm text-muted-foreground">No linked student for this parent account.</CardContent></Card>
          ) : (
            <GradebookTab courses={courses} />
          )}
        </TabsContent>
      </Tabs>

      <CreateCourseDialog open={createCourseOpen} onOpenChange={setCreateCourseOpen} role={currentUser.role} />
      <CreateAssignmentDialog open={createAssignmentOpen} onOpenChange={setCreateAssignmentOpen} courses={courses.map((c) => ({ id: c.id, code: c.code, name: c.name }))} />
      <EditAssignmentDialog open={!!editAssignment} onOpenChange={(o) => !o && setEditAssignment(null)} assignment={editAssignment} />
      <CreateQuizDialog open={createQuizOpen} onOpenChange={setCreateQuizOpen} courses={courses.map((c) => ({ id: c.id, code: c.code, name: c.name }))} />
      <EditQuizDialog open={!!editQuiz} onOpenChange={(o) => !o && setEditQuiz(null)} question={editQuiz} />
      <CreateCodingProblemDialog open={createCodingOpen} onOpenChange={setCreateCodingOpen} courses={courses.map((c) => ({ id: c.id, code: c.code, name: c.name }))} />
      <TakeQuizDialog open={takeQuizOpen} onOpenChange={setTakeQuizOpen} courses={courses.map((c) => ({ id: c.id, code: c.code, name: c.name }))} />
      <SubmitAssignmentDialog open={!!submitAssignment} onOpenChange={(o) => !o && setSubmitAssignment(null)} assignment={submitAssignment ? { id: submitAssignment.id, title: submitAssignment.title } : null} />
      <CourseRosterDialog
        open={!!rosterCourse}
        onOpenChange={(o) => !o && setRosterCourse(null)}
        course={rosterCourse ? { id: rosterCourse.id, code: rosterCourse.code, name: rosterCourse.name } : null}
        campusWide={['super_admin', 'admin'].includes(currentUser.role)}
        readOnly={isHodLmsReadOnly}
      />
      <ManageModulesDialog open={!!modulesCourse} onOpenChange={(o) => !o && setModulesCourse(null)} course={modulesCourse ? { id: modulesCourse.id, code: modulesCourse.code, name: modulesCourse.name } : null} />
      <GradeSubmissionsDialog open={!!gradeAssignment} onOpenChange={(o) => !o && setGradeAssignment(null)} assignment={gradeAssignment ? { id: gradeAssignment.id, title: gradeAssignment.title, maxScore: gradeAssignment.maxScore } : null} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === 'course' && deleteTarget.hasEnrollments ? 'Deactivate course?' : 'Delete permanently?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'course' && deleteTarget.hasEnrollments
                ? `"${deleteTarget?.label}" has enrollments — it will be deactivated, not removed.`
                : `This will remove "${deleteTarget?.label}". This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAssignmentMut.isPending || deleteCourseMut.isPending || deleteQuizMut.isPending}
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
            >
              {(deleteAssignmentMut.isPending || deleteCourseMut.isPending || deleteQuizMut.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
