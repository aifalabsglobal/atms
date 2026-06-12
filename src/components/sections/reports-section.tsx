'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart3, Users, BookOpen, ShieldAlert, TrendingUp, TrendingDown,
  FileText, Download, Calendar
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#1A3C6E', '#2E7D32', '#E65100', '#6A1B9A', '#C62828', '#00838F', '#F9A825'];

export default function ReportsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => fetch('/api/reports').then(r => r.json()),
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

  const { attendanceSummary, studentAttendanceReport, coursePerfReport, violationReport, gradeDistribution } = data || {};

  // Grade distribution chart data
  const gradeData = gradeDistribution ? Object.entries(gradeDistribution).map(([grade, count]) => ({
    name: `${grade} (${count})`,
    value: count as number,
    grade,
  })) : [];

  // Course performance chart data
  const coursePerfData = (coursePerfReport || []).filter((c: { avgGrade: number | null }) => c.avgGrade !== null).map((c: { name: string; code: string; avgGrade: number }) => ({
    name: c.code,
    fullName: c.name,
    avgGrade: c.avgGrade,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3C6E]">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Comprehensive analytics for attendance, academics, and compliance</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" /> Academic Year 2025-26</Badge>
        </div>
      </div>

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
        </TabsList>

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
        </TabsContent>

        {/* Grades Tab */}
        <TabsContent value="grades" className="space-y-4">
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
