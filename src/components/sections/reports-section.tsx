'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { exportStaffReportCsv, exportStudentReportCsv } from '@/lib/report-export';
import { Button } from '@/components/ui/button';
import {
  BarChart3, Users, BookOpen, ShieldAlert, TrendingUp, TrendingDown,
  FileText, Calendar, Clock, CheckCircle2, AlertTriangle, XCircle,
  GraduationCap, Award, Target, Trophy, Send, Star, MessageSquare,
  HelpCircle, ClipboardList, Zap, Download,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const COLORS = ['#1A3C6E', '#2E7D32', '#E65100', '#6A1B9A', '#C62828', '#00838F', '#F9A825'];

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#1A3C6E',
  admin: '#2C5F8A',
  hod: '#1B6B4A',
  faculty: '#7C3AED',
  lab_assistant: '#B45309',
  student: '#0E7490',
  parent: '#BE185D',
  visitor: '#6B7280',
  security: '#991B1B',
};

// ─── Student Report View ─────────────────────────────────────────────

interface StudentReportData {
  isStudent: true;
  isParent?: boolean;
  student: { id: string; name: string; email: string; employeeId: string | null; department: string | null };
  enrolledCourses: { id: string; name: string; code: string; credits: number; type: string; semester: number; instructor: { name: string } | null; _count: { assignments: number; modules: number; enrollments: number } }[];
  attendance: {
    totalSessions: number; presentCount: number; absentCount: number; lateCount: number;
    overallPercentage: number;
    courseAttendance: { course: { id: string; name: string; code: string }; present: number; absent: number; late: number; total: number; percentage: number }[];
    recentSessions: { id: string; sessionDate: string; presentCount: number; expectedCount: number; absentCount: number; lateCount: number; course: { name: string; code: string } }[];
    weeklyTrend?: { week: string; present: number; absent: number; late: number; sessions: number; rate: number }[];
  };
  analyticsScope?: 'student';
  riskStatus?: 'on_track' | 'watch' | 'at_risk' | 'no_data';
  assignments: {
    total: number; graded: number; pending: number; avgScore: number | null;
    recent: { id: string; title: string; course: { id: string; name: string; code: string }; score: number | null; maxScore: number; status: string; feedback: string | null; submittedAt: string; gradedAt: string | null }[];
  };
  quizzes: {
    totalAttempts: number; avgScore: number; bestScore: number; codingAttempts?: number;
    recent: { id: string; score: number; totalPoints: number; percentage: number; timeTaken: number | null; status: string; course: { name: string; code: string }; startedAt: string }[];
  };
  grades: {
    distribution: Record<string, number>;
    courseGrades: { courseId: string; course: { id: string; name: string; code: string }; grades: { component: string; score: number; maxScore: number; weightage: number }[]; overallScore: number }[];
    totalEntries: number;
  };
  violations: { id: string; type: string; severity: string; reviewStatus: string; description: string | null; record: { session: { sessionDate: string; course: { name: string; code: string } } } }[];
}

function StudentReportView({ data }: { data: StudentReportData }) {
  const { student, enrolledCourses, attendance, assignments, quizzes, grades, violations, riskStatus } = data;
  const isWardView = !!data.isParent;

  const riskBadge = {
    on_track: { label: 'On track', className: 'bg-emerald-100 text-emerald-800' },
    watch: { label: 'Watch list', className: 'bg-amber-100 text-amber-800' },
    at_risk: { label: 'At risk (<75%)', className: 'bg-red-100 text-red-800' },
    no_data: { label: 'No attendance yet', className: 'bg-muted text-muted-foreground' },
  }[riskStatus ?? 'no_data'];

  // Grade distribution chart data
  const gradeData = Object.entries(grades.distribution).map(([grade, count]) => ({
    name: `${grade} (${count})`,
    value: count,
    grade,
  }));

  // Attendance trend chart data (per course)
  const attendanceChartData = attendance.courseAttendance.map(ca => ({
    name: ca.course.code,
    fullName: ca.course.name,
    percentage: ca.percentage,
  }));

  return (
    <div className="space-y-6">
      {/* Student Profile Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Avatar className="h-14 w-14 border-2" style={{ borderColor: ROLE_COLORS.student }}>
          <AvatarFallback className="text-white text-lg" style={{ backgroundColor: ROLE_COLORS.student }}>
            {student.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-[#1A3C6E]">
            {isWardView ? `${student.name}'s Report` : student.name}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            {student.employeeId && <span className="font-mono">{student.employeeId}</span>}
            {student.department && <span>{student.department}</span>}
            {isWardView ? (
              <Badge className="text-[10px] text-white" style={{ backgroundColor: ROLE_COLORS.parent }}>Parent view</Badge>
            ) : (
              <Badge className="text-[10px] text-white" style={{ backgroundColor: ROLE_COLORS.student }}>Student</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportStudentReportCsv(data)}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Badge className={cn('text-[10px]', riskBadge.className)}>{riskBadge.label}</Badge>
          <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" /> Academic Year 2025-26</Badge>
          <Badge variant="outline" className="gap-1"><BookOpen className="h-3 w-3" /> {enrolledCourses.length} Courses</Badge>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
              attendance.overallPercentage >= 75 ? 'bg-emerald-100 dark:bg-emerald-900/30' :
              attendance.overallPercentage >= 65 ? 'bg-amber-100 dark:bg-amber-900/30' :
              'bg-red-100 dark:bg-red-900/30'
            )}>
              <TrendingUp className={cn(
                'h-4 w-4',
                attendance.overallPercentage >= 75 ? 'text-emerald-600' :
                attendance.overallPercentage >= 65 ? 'text-amber-600' :
                'text-red-600'
              )} />
            </div>
            <div>
              <p className={cn(
                'text-lg font-bold',
                attendance.overallPercentage >= 75 ? 'text-emerald-600' :
                attendance.overallPercentage >= 65 ? 'text-amber-600' :
                'text-red-600'
              )}>{attendance.overallPercentage}%</p>
              <p className="text-[10px] text-muted-foreground">Attendance</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center shrink-0">
              <GraduationCap className="h-4 w-4 text-[#1A3C6E]" />
            </div>
            <div>
              <p className="text-lg font-bold">{assignments.avgScore ?? '—'}{assignments.avgScore ? '%' : ''}</p>
              <p className="text-[10px] text-muted-foreground">Avg Assignment</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{Math.round(quizzes.bestScore)}%</p>
              <p className="text-[10px] text-muted-foreground">Best Quiz</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-3">
            <div className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
              violations.length > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
            )}>
              <ShieldAlert className={cn('h-4 w-4', violations.length > 0 ? 'text-red-600' : 'text-emerald-600')} />
            </div>
            <div>
              <p className={cn('text-lg font-bold', violations.length > 0 && 'text-red-600')}>{violations.length}</p>
              <p className="text-[10px] text-muted-foreground">Violations</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Warning */}
      {attendance.overallPercentage < 75 && attendance.totalSessions > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                Attendance Below Minimum Requirement
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-300/80 mt-0.5">
                Your attendance is {attendance.overallPercentage}%, below the JNTUH mandated 75% minimum.
                You may be detained from appearing for examinations. Please attend classes regularly.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={attendance.overallPercentage} className="h-2 flex-1 max-w-48" />
                <span className="text-xs font-bold text-red-600">{attendance.overallPercentage}% / 75%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {attendance.overallPercentage >= 75 && attendance.totalSessions > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Attendance Requirement Met
              </p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-300/80 mt-0.5">
                Your attendance is {attendance.overallPercentage}%, meeting the JNTUH 75% requirement. Keep it up!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
        </TabsList>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          {/* Attendance Overview */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#1A3C6E]" /> My Attendance Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Sessions</span>
                  <span className="text-sm font-bold">{attendance.totalSessions}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Present
                  </span>
                  <span className="text-sm font-bold text-emerald-600">{attendance.presentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" /> Absent
                  </span>
                  <span className="text-sm font-bold text-red-600">{attendance.absentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-500" /> Late
                  </span>
                  <span className="text-sm font-bold text-amber-600">{attendance.lateCount}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Attendance</span>
                  <span className={cn('text-sm font-bold', 
                    attendance.overallPercentage >= 75 ? 'text-emerald-600' : 
                    attendance.overallPercentage >= 65 ? 'text-amber-600' : 'text-red-600'
                  )}>{attendance.overallPercentage}%</span>
                </div>
                <Progress value={attendance.overallPercentage} className="h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#1A3C6E]" /> Course-wise Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {attendanceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={attendanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={11} />
                      <RechartsTooltip formatter={(value: number) => [`${value}%`, 'Attendance']} />
                      <Bar dataKey="percentage" fill="#1A3C6E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                    No attendance data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {attendance.weeklyTrend && attendance.weeklyTrend.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#1A3C6E]" /> Weekly attendance trend
                </CardTitle>
                <CardDescription>Your present rate over the last {attendance.weeklyTrend.length} weeks</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={attendance.weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" fontSize={10} tickFormatter={(v) => v.slice(5)} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <RechartsTooltip
                      formatter={(v: number, name: string) => {
                        if (name === 'rate') return [`${v}%`, 'Present rate'];
                        return [v, name];
                      }}
                    />
                    <Line type="monotone" dataKey="rate" stroke="#1A3C6E" strokeWidth={2} dot={{ r: 3 }} name="rate" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Course Attendance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance by Course</CardTitle>
              <CardDescription>Your attendance breakdown per enrolled course</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Late</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead>Attendance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.courseAttendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                          No attendance records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendance.courseAttendance.map((ca) => (
                        <TableRow key={ca.course.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className="text-[10px] font-mono bg-[#1A3C6E] text-white shrink-0">{ca.course.code}</Badge>
                              <span className="text-sm truncate max-w-[150px]" title={ca.course.name}>{ca.course.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-emerald-600 font-medium">{ca.present}</TableCell>
                          <TableCell className="text-center text-red-600">{ca.absent}</TableCell>
                          <TableCell className="text-center text-amber-600">{ca.late}</TableCell>
                          <TableCell className="text-center">{ca.total}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={ca.percentage} className="h-2 w-16" />
                              <span className={cn(
                                'text-sm font-medium',
                                ca.percentage >= 75 ? 'text-emerald-600' :
                                ca.percentage >= 65 ? 'text-amber-600' : 'text-red-600'
                              )}>{ca.percentage}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card className="py-3">
              <CardContent className="flex items-center gap-3 px-3">
                <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-[#1A3C6E]" />
                </div>
                <div>
                  <p className="text-lg font-bold">{assignments.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="flex items-center gap-3 px-3">
                <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Send className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{assignments.pending}</p>
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="flex items-center gap-3 px-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{assignments.graded}</p>
                  <p className="text-[10px] text-muted-foreground">Graded</p>
                </div>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="flex items-center gap-3 px-3">
                <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Award className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{assignments.avgScore ?? '—'}{assignments.avgScore ? '%' : ''}</p>
                  <p className="text-[10px] text-muted-foreground">Avg Score</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#1A3C6E]" /> My Assignment Submissions
              </CardTitle>
              <CardDescription>Your graded and pending assignments</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.recent.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                          No assignment submissions yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      assignments.recent.map((a) => {
                        const isGraded = a.score !== null;
                        const scorePct = isGraded && a.maxScore > 0 ? (a.score! / a.maxScore) * 100 : 0;
                        return (
                          <TableRow key={a.id}>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">{a.title}</p>
                                {a.feedback && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{a.feedback}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className="text-[10px] font-mono bg-[#1A3C6E] text-white">{a.course.code}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-[10px]',
                                isGraded ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200'
                              )}>
                                {isGraded ? <><Star className="h-3 w-3 mr-0.5" /> Graded</> : <><Send className="h-3 w-3 mr-0.5" /> Submitted</>}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {isGraded ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Progress value={scorePct} className="h-1.5 w-12" />
                                  <span className={cn('text-sm font-bold',
                                    scorePct >= 80 ? 'text-emerald-600' :
                                    scorePct >= 50 ? 'text-amber-600' : 'text-red-600'
                                  )}>{a.score}/{a.maxScore}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quizzes Tab */}
        <TabsContent value="quizzes" className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card className="py-3">
              <CardContent className="flex items-center gap-3 px-3">
                <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center shrink-0">
                  <HelpCircle className="h-4 w-4 text-[#1A3C6E]" />
                </div>
                <div>
                  <p className="text-lg font-bold">{quizzes.totalAttempts}</p>
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
                  <p className="text-lg font-bold">{quizzes.avgScore}%</p>
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
                  <p className="text-lg font-bold">{Math.round(quizzes.bestScore)}%</p>
                  <p className="text-[10px] text-muted-foreground">Best Score</p>
                </div>
              </CardContent>
            </Card>
            <Card className="py-3">
              <CardContent className="flex items-center gap-3 px-3">
                <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 text-[#1A3C6E]" />
                </div>
                <div>
                  <p className="text-lg font-bold">{quizzes.avgScore >= 80 ? 'A' : quizzes.avgScore >= 60 ? 'B' : quizzes.avgScore >= 40 ? 'C' : quizzes.avgScore > 0 ? 'D' : '—'}</p>
                  <p className="text-[10px] text-muted-foreground">Grade</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[#1A3C6E]" /> My Quiz Attempts
              </CardTitle>
              <CardDescription>{quizzes.recent.length} quiz attempts recorded</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pt-2">
              {quizzes.recent.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No quiz attempts yet</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {quizzes.recent.map((at) => {
                      const pctColor =
                        at.percentage >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                        at.percentage >= 50 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400';
                      const bgColor =
                        at.percentage >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                        at.percentage >= 50 ? 'bg-amber-100 dark:bg-amber-900/30' :
                        'bg-red-100 dark:bg-red-900/30';
                      const progressColor =
                        at.percentage >= 80 ? '[&>div]:bg-emerald-500' :
                        at.percentage >= 50 ? '[&>div]:bg-amber-500' :
                        '[&>div]:bg-red-500';

                      return (
                        <div key={at.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', bgColor)}>
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
                                <span className={cn('text-[10px] font-semibold', pctColor)}>{at.score}/{at.totalPoints}</span>
                              </div>
                              {at.timeTaken && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />{Math.floor(at.timeTaken / 60)}m {at.timeTaken % 60}s
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] capitalize shrink-0',
                              at.status === 'completed' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
                              at.status === 'in_progress' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                              at.status === 'abandoned' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
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
        </TabsContent>

        {/* Grades Tab */}
        <TabsContent value="grades" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grade Distribution</CardTitle>
                <CardDescription>Your grade distribution across all courses</CardDescription>
              </CardHeader>
              <CardContent>
                {gradeData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={gradeData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={5} dataKey="value" label={({ grade, value }) => `${grade}: ${value}`}>
                        {gradeData.map((_: unknown, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
                    No grade data available yet
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grade Scale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { grade: 'A', range: '90-100%', color: 'bg-green-500' },
                    { grade: 'B', range: '75-89%', color: 'bg-blue-500' },
                    { grade: 'C', range: '60-74%', color: 'bg-amber-500' },
                    { grade: 'D', range: '40-59%', color: 'bg-orange-500' },
                    { grade: 'F', range: '0-39%', color: 'bg-red-500' },
                  ].map(g => {
                    const count = grades.distribution[g.grade] || 0;
                    const total = gradeData.reduce((s: number, d: { value: number }) => s + d.value, 0);
                    return (
                      <div key={g.grade} className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded flex items-center justify-center text-white font-bold text-sm ${g.color}`}>{g.grade}</div>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{g.range}</span>
                            <span className="font-medium">{count} {count === 1 ? 'entry' : 'entries'}</span>
                          </div>
                          <Progress value={total > 0 ? (count / total) * 100 : 0} className="h-2" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Course-wise Grades */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Course-wise Performance</CardTitle>
              <CardDescription>Your overall score in each enrolled course</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Components</TableHead>
                      <TableHead>Overall Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades.courseGrades.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                          No grade entries available yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      grades.courseGrades.map((cg) => (
                        <TableRow key={cg.courseId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className="text-[10px] font-mono bg-[#1A3C6E] text-white shrink-0">{cg.course.code}</Badge>
                              <span className="text-sm truncate max-w-[150px]" title={cg.course.name}>{cg.course.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {cg.grades.map((g, i) => (
                                <Badge key={i} variant="outline" className="text-[9px]">
                                  {g.component}: {g.score}/{g.maxScore}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={cg.overallScore} className="h-2 w-16" />
                              <span className={cn('text-sm font-bold',
                                cg.overallScore >= 80 ? 'text-emerald-600' :
                                cg.overallScore >= 50 ? 'text-amber-600' : 'text-red-600'
                              )}>{cg.overallScore}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Violations (if any) */}
          {violations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-600" /> My Violations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {violations.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="capitalize text-sm">{v.type?.replace(/_/g, ' ')}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{v.severity}</Badge></TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{v.reviewStatus}</Badge></TableCell>
                          <TableCell className="text-sm">{v.record?.session?.course?.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{v.record?.session?.sessionDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Admin / General Report View ─────────────────────────────────────

interface StaffReportData {
  isStudent: false;
  analyticsScope: 'campus' | 'department' | 'instructor';
  scopeLabel: string;
  role: string;
  kpis: {
    totalStudents: number;
    totalCourses: number;
    totalEnrollments: number;
    completedSessions: number;
    avgAttendancePct: number;
    atRiskCount: number;
    pendingViolations: number;
    avgGradePct: number;
    quizAttempts: number;
    avgQuizScore: number;
    submissions: number;
  };
  weeklyAttendanceTrend: { week: string; present: number; absent: number; late: number; sessions: number; rate: number }[];
  departmentAnalytics: { department: string; students: number; avgAttendance: number; atRisk: number }[];
  atRiskStudents: { id: string; name: string; employeeId: string | null; department: string | null; stats: { percentage: number; total: number } }[];
  topPerformers: { id: string; name: string; employeeId: string | null; department: string | null; stats: { percentage: number; total: number } }[];
  violationAnalytics: { byType: Record<string, number>; bySeverity: Record<string, number>; pending: number; confirmed: number; dismissed: number; total: number };
  captureMethodBreakdown: Record<string, number>;
  lmsEngagement: {
    coursesWithGrades: number;
    topCourses: { id: string; code: string; name: string; enrollments: number; assignments: number; quizAttempts: number; avgGrade: number | null; instructor: string }[];
  };
  attendanceSummary: { id: string; sessionDate: string; presentCount: number; expectedCount: number; absentCount: number; lateCount: number; course: { name: string; code: string } }[];
  studentAttendanceReport: { id: string; name: string; employeeId: string | null; department: string | null; stats: { present: number; absent: number; late: number; total: number; percentage: number } }[];
  coursePerfReport: { id: string; code: string; name: string; _count: { enrollments: number }; avgGrade: number | null }[];
  violationReport: { id: string; type: string; severity: string; reviewStatus: string; violator: { name: string }; record: { session: { sessionDate: string; course: { name: string } } } }[];
  gradeDistribution: Record<string, number>;
}

function StaffAnalyticsView({ data }: { data: StaffReportData }) {
  const {
    kpis, weeklyAttendanceTrend, departmentAnalytics, atRiskStudents, topPerformers,
    violationAnalytics, captureMethodBreakdown, lmsEngagement, scopeLabel, analyticsScope,
    attendanceSummary, studentAttendanceReport, coursePerfReport, violationReport, gradeDistribution,
  } = data;

  // Grade distribution chart data
  const gradeData = Object.entries(gradeDistribution || {}).map(([grade, count]) => ({
    name: `${grade} (${count})`,
    value: count,
    grade,
  }));

  // Course performance chart data
  const coursePerfData = (coursePerfReport || []).filter((c) => c.avgGrade !== null).map((c) => ({
    name: c.code,
    fullName: c.name,
    avgGrade: c.avgGrade,
  }));

  const captureData = Object.entries(captureMethodBreakdown || {}).map(([method, count]) => ({
    name: method.replace(/_/g, ' '),
    value: count,
  }));

  const violationTypeData = Object.entries(violationAnalytics?.byType ?? {}).map(([type, count]) => ({
    name: type.replace(/_/g, ' '),
    value: count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3C6E]">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Role-scoped depth analytics — attendance, academics, LMS, compliance
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportStaffReportCsv({
              scopeLabel: data.scopeLabel,
              analyticsScope: data.analyticsScope,
              kpis: data.kpis,
              weeklyAttendanceTrend: data.weeklyAttendanceTrend,
              departmentAnalytics: data.departmentAnalytics,
              atRiskStudents: data.atRiskStudents,
              studentAttendanceReport: data.studentAttendanceReport,
              lmsEngagement: { topCourses: data.lmsEngagement.topCourses },
            })}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Badge className="bg-[#1A3C6E] text-white">{scopeLabel}</Badge>
          <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" /> AY 2025-26</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full max-w-3xl grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="courses">Academic</TabsTrigger>
          <TabsTrigger value="lms">LMS</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
            {[
              { label: 'Students', value: kpis.totalStudents, icon: Users },
              { label: 'Avg attendance', value: `${kpis.avgAttendancePct}%`, icon: TrendingUp },
              { label: 'At risk (<75%)', value: kpis.atRiskCount, icon: AlertTriangle },
              { label: 'Avg grade', value: `${kpis.avgGradePct}%`, icon: Award },
              { label: 'Quiz attempts', value: kpis.quizAttempts, icon: HelpCircle },
            ].map((k) => (
              <Card key={k.label} className="py-3">
                <CardContent className="flex items-center gap-3 px-3">
                  <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center shrink-0">
                    <k.icon className="h-4 w-4 text-[#1A3C6E]" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{k.value}</p>
                    <p className="text-[10px] text-muted-foreground">{k.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly attendance trend</CardTitle>
                <CardDescription>Present rate by week (scoped to your role)</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyAttendanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" fontSize={10} tickFormatter={(v) => v.slice(5)} />
                    <YAxis domain={[0, 100]} fontSize={12} />
                    <RechartsTooltip formatter={(v: number) => [`${v}%`, 'Rate']} />
                    <Line type="monotone" dataKey="rate" stroke="#1A3C6E" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {analyticsScope === 'campus' && departmentAnalytics.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Department breakdown</CardTitle>
                  <CardDescription>Avg attendance & at-risk count by department</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={departmentAnalytics.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" fontSize={9} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis domain={[0, 100]} fontSize={12} />
                      <RechartsTooltip />
                      <Bar dataKey="avgAttendance" fill="#1B6B4A" name="Avg %" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top performers</CardTitle>
                  <CardDescription>Highest attendance % in your scope</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topPerformers.slice(0, 6).map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <span className="font-medium truncate">{i + 1}. {s.name}</span>
                      <Badge variant="secondary">{s.stats.percentage}%</Badge>
                    </div>
                  ))}
                  {topPerformers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No attendance data yet</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="lms" className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card className="py-3"><CardContent className="px-3"><p className="text-lg font-bold">{kpis.totalEnrollments}</p><p className="text-[10px] text-muted-foreground">Enrollments</p></CardContent></Card>
            <Card className="py-3"><CardContent className="px-3"><p className="text-lg font-bold">{kpis.submissions}</p><p className="text-[10px] text-muted-foreground">Submissions</p></CardContent></Card>
            <Card className="py-3"><CardContent className="px-3"><p className="text-lg font-bold">{kpis.avgQuizScore}%</p><p className="text-[10px] text-muted-foreground">Avg quiz score</p></CardContent></Card>
            <Card className="py-3"><CardContent className="px-3"><p className="text-lg font-bold">{lmsEngagement.coursesWithGrades}</p><p className="text-[10px] text-muted-foreground">Graded courses</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top courses by enrollment</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Quizzes</TableHead>
                    <TableHead>Avg grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lmsEngagement.topCourses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{c.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.instructor}</TableCell>
                      <TableCell>{c.enrollments}</TableCell>
                      <TableCell>{c.quizAttempts}</TableCell>
                      <TableCell>{c.avgGrade !== null ? `${c.avgGrade}%` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card className="py-3"><CardContent className="px-3"><p className="text-lg font-bold">{violationAnalytics.total}</p><p className="text-[10px] text-muted-foreground">Total violations</p></CardContent></Card>
            <Card className="py-3"><CardContent className="px-3"><p className="text-lg font-bold text-amber-600">{violationAnalytics.pending}</p><p className="text-[10px] text-muted-foreground">Pending review</p></CardContent></Card>
            <Card className="py-3"><CardContent className="px-3"><p className="text-lg font-bold text-red-600">{violationAnalytics.confirmed}</p><p className="text-[10px] text-muted-foreground">Confirmed</p></CardContent></Card>
            <Card className="py-3"><CardContent className="px-3"><p className="text-lg font-bold">{violationAnalytics.dismissed}</p><p className="text-[10px] text-muted-foreground">Dismissed</p></CardContent></Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Violations by type</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={violationTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {violationTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Capture methods</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={captureData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={12} />
                    <Bar dataKey="value" fill="#6A1B9A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Attendance Report Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-[#1A3C6E]" /></div>
                  <div><p className="text-xs text-muted-foreground">Total Sessions</p><p className="text-xl font-bold">{attendanceSummary?.length || 0}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-green-600" /></div>
                  <div><p className="text-xs text-muted-foreground">Avg Attendance</p><p className="text-xl font-bold">{attendanceSummary?.length > 0 ? Math.round(attendanceSummary.reduce((s: number, a: { presentCount: number; expectedCount: number }) => s + (a.expectedCount > 0 ? (a.presentCount / a.expectedCount) * 100 : 0), 0) / attendanceSummary.length) : 0}%</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><Users className="h-5 w-5 text-amber-600" /></div>
                  <div><p className="text-xs text-muted-foreground">Violations</p><p className="text-xl font-bold">{violationReport?.length || 0}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-red-600" /></div>
                  <div><p className="text-xs text-muted-foreground">Below 75%</p><p className="text-xl font-bold">{(studentAttendanceReport || []).filter((s: { stats: { percentage: number } }) => s.stats.percentage < 75).length}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Session Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Session Summary</CardTitle>
              <CardDescription>Recent attendance sessions overview</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(attendanceSummary || []).slice(0, 15).map((s: { id: string; sessionDate: string; presentCount: number; expectedCount: number; absentCount: number; lateCount: number; course: { name: string; code: string } }, i: number) => {
                      const rate = s.expectedCount > 0 ? Math.round((s.presentCount / s.expectedCount) * 100) : 0;
                      return (
                        <TableRow key={s.id || i}>
                          <TableCell className="text-sm">{s.sessionDate}</TableCell>
                          <TableCell className="text-sm font-medium">{s.course?.code} - {s.course?.name}</TableCell>
                          <TableCell>{s.expectedCount}</TableCell>
                          <TableCell className="text-green-600 font-medium">{s.presentCount}</TableCell>
                          <TableCell className="text-red-600">{s.absentCount}</TableCell>
                          <TableCell className="text-amber-600">{s.lateCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={rate} className="h-2 w-16" />
                              <span className={`text-sm font-medium ${rate >= 75 ? 'text-green-600' : rate >= 65 ? 'text-amber-600' : 'text-red-600'}`}>{rate}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-4">
          {atRiskStudents.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-4 w-4" /> At-risk students ({atRiskStudents.length})
                </CardTitle>
                <CardDescription>Below 75% attendance — JNTUH minimum threshold</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Dept</TableHead>
                        <TableHead>Sessions</TableHead>
                        <TableHead>%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {atRiskStudents.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-sm">{s.name}</TableCell>
                          <TableCell className="text-xs">{s.department}</TableCell>
                          <TableCell>{s.stats.total}</TableCell>
                          <TableCell className="text-red-600 font-semibold">{s.stats.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student Attendance Report</CardTitle>
              <CardDescription>Individual student attendance performance</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Attendance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(studentAttendanceReport || []).map((s: { id: string; name: string; employeeId: string | null; department: string | null; stats: { present: number; absent: number; late: number; total: number; percentage: number } }) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.employeeId}</TableCell>
                        <TableCell className="text-sm">{s.department}</TableCell>
                        <TableCell className="text-green-600">{s.stats.present}</TableCell>
                        <TableCell className="text-red-600">{s.stats.absent}</TableCell>
                        <TableCell className="text-amber-600">{s.stats.late}</TableCell>
                        <TableCell>{s.stats.total}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={s.stats.percentage} className="h-2 w-16" />
                            <span className={`text-sm font-medium ${s.stats.percentage >= 75 ? 'text-green-600' : s.stats.percentage >= 65 ? 'text-amber-600' : 'text-red-600'}`}>
                              {s.stats.percentage}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Course Performance</CardTitle>
                <CardDescription>Average grade by course</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={coursePerfData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis domain={[0, 100]} fontSize={12} />
                    <RechartsTooltip formatter={(value: number) => [`${value}%`, 'Avg Grade']} />
                    <Bar dataKey="avgGrade" fill="#1A3C6E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Course Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Enrollments</TableHead>
                        <TableHead>Avg Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(coursePerfReport || []).map((c: { id: string; code: string; name: string; _count: { enrollments: number }; avgGrade: number | null }) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.code}</TableCell>
                          <TableCell className="text-sm">{c.name}</TableCell>
                          <TableCell>{c._count?.enrollments || 0}</TableCell>
                          <TableCell>
                            <span className={`font-medium ${c.avgGrade && c.avgGrade >= 75 ? 'text-green-600' : 'text-amber-600'}`}>
                              {c.avgGrade ? `${c.avgGrade}%` : 'N/A'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grade Distribution</CardTitle>
                <CardDescription>Overall grade distribution across all courses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={gradeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ grade, value }) => `${grade}: ${value}`}>
                      {gradeData.map((_: unknown, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Grade Scale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { grade: 'A', range: '90-100%', color: 'bg-green-500' },
                    { grade: 'B', range: '75-89%', color: 'bg-blue-500' },
                    { grade: 'C', range: '60-74%', color: 'bg-amber-500' },
                    { grade: 'D', range: '40-59%', color: 'bg-orange-500' },
                    { grade: 'F', range: '0-39%', color: 'bg-red-500' },
                  ].map(g => {
                    const count = gradeDistribution?.[g.grade] || 0;
                    return (
                      <div key={g.grade} className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded flex items-center justify-center text-white font-bold text-sm ${g.color}`}>{g.grade}</div>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{g.range}</span>
                            <span className="font-medium">{count} entries</span>
                          </div>
                          <Progress value={gradeData.length > 0 ? (count / gradeData.reduce((s: number, d: { value: number }) => s + d.value, 0)) * 100 : 0} className="h-2" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Violation Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Violation Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(violationReport || []).slice(0, 10).map((v: { id: string; type: string; severity: string; reviewStatus: string; violator: { name: string }; record: { session: { sessionDate: string; course: { name: string } } } }) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium text-sm">{v.violator?.name}</TableCell>
                        <TableCell className="capitalize text-sm">{v.type?.replace(/_/g, ' ')}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{v.severity}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{v.reviewStatus}</Badge></TableCell>
                        <TableCell className="text-sm">{v.record?.session?.course?.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.record?.session?.sessionDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Reports Section ─────────────────────────────────────────────

export default function ReportsSection() {
  const { currentUser } = useAppStore();
  if (!currentUser) return null;

  const { data, isLoading } = useQuery({
    queryKey: ['reports', currentUser.id],
    queryFn: () => fetch('/api/reports').then((r) => {
      if (!r.ok) throw new Error('Failed to load reports');
      return r.json();
    }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#1A3C6E]">Reports & Analytics</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><div className="h-32 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (data.isStudent) {
    return <StudentReportView data={data} />;
  }

  return <StaffAnalyticsView data={data} />;
}
