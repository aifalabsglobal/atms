export interface DashboardStats {
  totalStudents: number;
  totalFaculty: number;
  totalCourses: number;
  totalSessions: number;
  activeSessions: number;
  pendingViolations: number;
  totalEnrollments: number;
  overallAttendance: number;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
}

export interface CourseAttendance {
  id: string;
  name: string;
  code: string;
  attendance: number;
  expected: number;
  percentage: number;
}

export interface WeeklyTrend {
  date: string;
  present: number;
  absent: number;
  late: number;
}

export interface RecentActivity {
  id: string;
  status: string;
  captureMethod: string;
  markedAt: string | null;
  student: { name: string; department: string };
  session: { course: { name: string; code: string }; sessionDate: string };
}

export interface ActiveSession {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string | null;
  captureMethod: string;
  expectedCount: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  status: string;
  course: { name: string; code: string };
  creator: { name: string };
  geofence: { name: string } | null;
  timetableSlot: { roomNumber: string | null; building: string | null } | null;
}

export interface AttendanceSessionItem {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string | null;
  captureMethod: string;
  status: string;
  expectedCount: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  course: { name: string; code: string };
  creator: { name: string };
  geofence: { name: string } | null;
  timetableSlot: { roomNumber: string | null; building: string | null } | null;
  _count: { records: number };
}

export interface ViolationItem {
  id: string;
  type: string;
  severity: string;
  description: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  createdAt: string;
  violator: { name: string; email: string; department: string; employeeId: string | null };
  reviewer: { name: string } | null;
  record: { status: string; captureMethod: string; session: { sessionDate: string; course: { name: string } } };
}

export interface CourseItem {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  type: string;
  description: string | null;
  isActive: boolean;
  program: { name: string; code: string };
  instructor: { name: string; email: string } | null;
  _count: { enrollments: number; modules: number; assignments: number; attendanceSessions: number };
  modules: { id: string; title: string; orderIndex: number; isPublished: boolean; _count: { lessons: number } }[];
}

export interface AssignmentItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  maxScore: number;
  dueDate: string;
  status: string;
  course: { name: string; code: string };
  _count: { submissions: number };
  stats: { totalSubmissions: number; avgScore: number | null; gradedCount: number };
}

export interface UserItem {
  id: string;
  email: string;
  name: string;
  employeeId: string | null;
  department: string | null;
  departmentId: string | null;
  phone: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
  linkedStudentId: string | null;
  linkedStudent?: { id: string; name: string; email: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { attendanceRecords: number; courseEnrollments: number; submissions: number; taughtCourses: number };
  knuctWallet?: {
    did: string | null;
    status: string;
    lastError?: string | null;
    updatedAt?: string | Date | null;
    createdAt?: string | Date | null;
  } | null;
}

export interface GeofenceItem {
  id: string;
  name: string;
  type: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusMtrs: number | null;
  polygonData?: string | null;
  building: string | null;
  floor: string | null;
  isActive: boolean;
  _count: { attendanceSessions: number };
}
