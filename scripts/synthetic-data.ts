/**
 * Additive synthetic data — run after db:seed.
 * npm run seed:synthetic
 *
 * Env: SYNTH_STUDENTS=50 SYNTH_ATTENDANCE_DAYS=45
 */
import { db } from '../src/lib/db';

const STUDENT_COUNT = Number(process.env.SYNTH_STUDENTS ?? 50);
const ATTENDANCE_DAYS = Number(process.env.SYNTH_ATTENDANCE_DAYS ?? 45);
const PASSWORD_HASH = '$2a$10$placeholder';

const FIRST_NAMES = [
  'Aarav', 'Aditya', 'Ananya', 'Bhavana', 'Charan', 'Deepika', 'Eshwar', 'Farhan',
  'Gayatri', 'Harish', 'Isha', 'Jagan', 'Keerthi', 'Lakshmi', 'Manoj', 'Neha',
  'Omkar', 'Pooja', 'Rahul', 'Sneha', 'Tarun', 'Uma', 'Varun', 'Yasmin', 'Zaid',
  'Akhil', 'Bindu', 'Chaitanya', 'Dinesh', 'Ekta', 'Gopal', 'Harsha', 'Indira',
  'Jyothi', 'Kiran', 'Lavanya', 'Mohan', 'Nikhil', 'Padma', 'Rakesh', 'Swathi',
  'Teja', 'Uday', 'Vamsi', 'Yamini',
];

const LAST_NAMES = [
  'Reddy', 'Rao', 'Kumar', 'Sharma', 'Naidu', 'Prasad', 'Devi', 'Singh', 'Patel',
  'Gupta', 'Verma', 'Iyer', 'Menon', 'Chowdary', 'Babu', 'Lakshmi', 'Srinivas',
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function rand01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log(`\n🧪 Generating synthetic data (${STUDENT_COUNT} students, ${ATTENDANCE_DAYS} attendance days)...\n`);

  const cseDept = await db.department.findFirst({ where: { code: 'CSE' } });
  const eceDept = await db.department.findFirst({ where: { code: 'ECE' } });
  const itDept = await db.department.findFirst({ where: { code: 'IT' } });
  const faculty = await db.user.findFirst({ where: { email: 'faculty.venkat@aimscs.ac.in' } });
  const hod = await db.user.findFirst({ where: { email: 'hod.cse@aimscs.ac.in' } });
  const admin = await db.user.findFirst({ where: { email: 'registrar@aimscs.ac.in' } });

  if (!cseDept || !eceDept || !itDept || !faculty || !hod) {
    throw new Error('Base seed missing — run: npm run db:seed');
  }

  const cseCourses = await db.course.findMany({
    where: { program: { departmentId: cseDept.id }, isActive: true },
    take: 15,
    orderBy: { semester: 'asc' },
  });
  const eceCourses = await db.course.findMany({
    where: { program: { departmentId: eceDept.id }, isActive: true },
    take: 8,
  });
  const codingCourse = await db.course.findFirst({ where: { code: 'CS201ES' } });

  const slots = await db.timetableSlot.findMany({ take: 12 });
  const geofence = await db.geofence.findFirst({ where: { isActive: true } });

  if (!slots.length || !geofence) {
    throw new Error('Timetable/geofence seed missing — run: npm run db:seed');
  }

  // --- Students ---
  const deptCycle = [
    { dept: cseDept, label: 'Computer Science & Engineering', share: 0.6 },
    { dept: eceDept, label: 'Electronics & Communication Engineering', share: 0.25 },
    { dept: itDept, label: 'Information Technology', share: 0.15 },
  ];

  const newStudents: { id: string; departmentId: string }[] = [];
  let createdStudents = 0;
  let skippedStudents = 0;

  const existingSynth = await db.user.findMany({
    where: { email: { startsWith: 'synth.stu' } },
    select: { id: true, email: true, departmentId: true },
  });
  const existingEmails = new Set(existingSynth.map((u) => u.email));
  for (const u of existingSynth) {
    skippedStudents++;
    newStudents.push({ id: u.id, departmentId: u.departmentId ?? cseDept.id });
  }

  const studentRows: {
    email: string;
    name: string;
    employeeId: string;
    departmentId: string;
    department: string;
    role: string;
    status: string;
    phone: string;
    passwordHash: string;
    profileImageUrl: string;
  }[] = [];

  for (let i = 0; i < STUDENT_COUNT; i++) {
    const roll = 100 + i;
    const email = `synth.stu${String(roll).padStart(3, '0')}@aimscs.ac.in`;
    if (existingEmails.has(email)) continue;

    const r = rand01(i);
    const deptEntry = r < 0.6 ? deptCycle[0] : r < 0.85 ? deptCycle[1] : deptCycle[2];
    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i + 7);

    studentRows.push({
      email,
      name: `${first} ${last}`,
      employeeId: `SYN${roll}`,
      departmentId: deptEntry.dept.id,
      department: deptEntry.label,
      role: 'student',
      status: i % 17 === 0 ? 'inactive' : 'active',
      phone: `+91-98${String(76000000 + i).slice(-8)}`,
      passwordHash: PASSWORD_HASH,
      profileImageUrl: i % 2 === 0 ? '/profiles/student-male-1.png' : '/profiles/student-female-1.png',
    });
  }

  if (studentRows.length) {
    const batch = await db.user.createMany({ data: studentRows });
    createdStudents = batch.count;
  }

  const createdSynth = await db.user.findMany({
    where: { email: { startsWith: 'synth.stu' } },
    select: { id: true, departmentId: true },
  });
  for (const u of createdSynth) {
    if (!newStudents.some((s) => s.id === u.id)) {
      newStudents.push({ id: u.id, departmentId: u.departmentId ?? cseDept.id });
    }
  }

  const activeStudents = (
    await db.user.findMany({
      where: { role: 'student', status: 'active' },
      select: { id: true, departmentId: true },
    })
  );

  // --- Enrollments ---
  const enrollmentRows: { courseId: string; studentId: string; status: string }[] = [];
  for (const student of activeStudents) {
    const pool =
      student.departmentId === eceDept.id
        ? eceCourses
        : student.departmentId === itDept.id
          ? cseCourses.slice(0, 8)
          : cseCourses;

    for (const course of pool) {
      enrollmentRows.push({ courseId: course.id, studentId: student.id, status: 'enrolled' });
    }
    if (codingCourse && student.departmentId === cseDept.id) {
      enrollmentRows.push({ courseId: codingCourse.id, studentId: student.id, status: 'enrolled' });
    }
  }

  const enrollResult = await db.courseEnrollment.createMany({
    data: enrollmentRows,
    skipDuplicates: true,
  });
  const enrollments = enrollResult.count;

  // --- Attendance history ---
  const captureMethods = ['manual', 'face', 'gps', 'qrcode', 'biometric', 'self_geo_face'];
  let sessionsCreated = 0;
  let recordsCreated = 0;

  for (let day = 0; day < ATTENDANCE_DAYS; day++) {
    const sessionDate = dateStr(day);
    const slot = slots[day % slots.length];
    const method = captureMethods[day % captureMethods.length];
    const cohort = activeStudents.slice(0, 12 + (day % 8));

    const existing = await db.attendanceSession.findFirst({
      where: { courseId: slot.courseId, sessionDate, startTime: slot.startTime },
    });
    if (existing) continue;

    const session = await db.attendanceSession.create({
      data: {
        timetableSlotId: slot.id,
        courseId: slot.courseId,
        createdBy: faculty.id,
        geofenceId: geofence.id,
        sessionDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: day === 0 ? 'active' : 'completed',
        captureMethod: method,
        expectedCount: cohort.length,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
      },
    });
    sessionsCreated++;

    let present = 0;
    let late = 0;
    let absent = 0;
    const recordRows: {
      sessionId: string;
      studentId: string;
      status: string;
      markedAt: Date | null;
      captureMethod: string;
      confidence: number | null;
      gpsLat: number | null;
      gpsLng: number | null;
      faceVerified: boolean;
      geofenceValidated: boolean;
    }[] = [];

    for (let si = 0; si < cohort.length; si++) {
      const student = cohort[si];
      const r = rand01(day * 100 + si);
      const status = r < 0.72 ? 'present' : r < 0.86 ? 'late' : 'absent';
      if (status === 'present') present++;
      else if (status === 'late') late++;
      else absent++;

      recordRows.push({
        sessionId: session.id,
        studentId: student.id,
        status,
        markedAt: status !== 'absent' ? new Date(`${sessionDate}T${slot.startTime}:00`) : null,
        captureMethod: method,
        confidence: method.includes('face') ? 0.82 + rand01(si) * 0.15 : null,
        gpsLat: method.includes('gps') ? 17.4497 + (rand01(si) - 0.5) * 0.003 : null,
        gpsLng: method.includes('gps') ? 78.6674 + (rand01(si + 1) - 0.5) * 0.003 : null,
      faceVerified: method.includes('face') ? r > 0.15 : false,
      geofenceValidated: method.includes('geo') ? r > 0.1 : false,
      });
    }

    const batch = await db.attendanceRecord.createMany({ data: recordRows });
    recordsCreated += batch.count;

    await db.attendanceSession.update({
      where: { id: session.id },
      data: { presentCount: present, lateCount: late, absentCount: absent },
    });
  }

  // --- Violations (sample) ---
  const violationTypes = ['spoofing', 'proxy', 'out_of_geofence', 'face_mismatch'];
  let violationsCreated = 0;
  const recentRecords = await db.attendanceRecord.findMany({
    take: 30,
    orderBy: { markedAt: 'desc' },
    where: { status: { in: ['present', 'late'] } },
  });

  for (let i = 0; i < Math.min(12, recentRecords.length); i++) {
    const record = recentRecords[i];
    const exists = await db.attendanceViolation.findUnique({ where: { recordId: record.id } });
    if (exists) continue;

    await db.attendanceViolation.create({
      data: {
        recordId: record.id,
        studentId: record.studentId,
        type: pick(violationTypes, i),
        severity: i % 4 === 0 ? 'critical' : i % 3 === 0 ? 'high' : 'medium',
        description: `Synthetic ${pick(violationTypes, i)} flag during session`,
        reviewStatus: i < 5 ? 'pending' : i < 9 ? 'confirmed' : 'dismissed',
        reviewedBy: i >= 5 ? hod.id : undefined,
        reviewNotes: i >= 5 ? 'Auto-reviewed synthetic record' : undefined,
      },
    });
    violationsCreated++;
  }

  // --- Notifications ---
  const notifTemplates = [
    { title: 'Attendance below 75%', type: 'warning', message: 'Your attendance in CS201ES is below threshold' },
    { title: 'Assignment graded', type: 'success', message: 'Your OS assignment scored 78/100' },
    { title: 'New course material', type: 'info', message: 'Unit 3 slides uploaded for Data Structures' },
    { title: 'Exam schedule', type: 'info', message: 'Mid examinations begin next Monday' },
    { title: 'Violation alert', type: 'warning', message: 'Attendance anomaly flagged for review' },
  ];

  let notificationsCreated = 0;
  const notifyUsers = [hod, faculty, admin, ...activeStudents.slice(0, 20)].filter(Boolean) as { id: string }[];
  const notifBatch = await db.notification.createMany({
    data: notifyUsers.map((user, i) => {
      const tpl = pick(notifTemplates, i);
      return {
        userId: user.id,
        title: tpl.title,
        message: tpl.message,
        type: tpl.type,
        channel: 'in_app',
        isRead: i % 3 === 0,
      };
    }),
  });
  notificationsCreated = notifBatch.count;

  const gradeComponents = ['assignment', 'quiz', 'midterm', 'final', 'participation'] as const;
  const gradeStudents = activeStudents.slice(0, 25);
  const gradeCourses = cseCourses.slice(0, 6);

  const gradeRows: {
    courseId: string;
    studentId: string;
    component: string;
    score: number;
    maxScore: number;
    weightage: number;
    gradedBy: string;
  }[] = [];

  for (const student of gradeStudents) {
    for (const course of gradeCourses) {
      for (const component of gradeComponents) {
        const key = `${student.id}-${course.id}-${component}`;
        gradeRows.push({
          courseId: course.id,
          studentId: student.id,
          component,
          score: component === 'participation' ? 6 + rand01(key.length) * 4 : 40 + rand01(key.length + 3) * 55,
          maxScore: component === 'participation' ? 10 : 100,
          weightage:
            component === 'assignment' ? 25 :
            component === 'quiz' ? 15 :
            component === 'midterm' ? 20 :
            component === 'final' ? 30 : 10,
          gradedBy: faculty.id,
        });
      }
    }
  }

  const existingGrades = await db.gradeBook.findMany({
    where: {
      studentId: { in: gradeStudents.map((s) => s.id) },
      courseId: { in: gradeCourses.map((c) => c.id) },
    },
    select: { studentId: true, courseId: true, component: true },
  });
  const gradeKeys = new Set(existingGrades.map((g) => `${g.studentId}|${g.courseId}|${g.component}`));
  const newGradeRows = gradeRows.filter(
    (g) => !gradeKeys.has(`${g.studentId}|${g.courseId}|${g.component}`)
  );
  const gradeBatch = await db.gradeBook.createMany({ data: newGradeRows });
  const gradesCreated = gradeBatch.count;

  // --- Summary ---
  const counts = {
    users: await db.user.count(),
    students: await db.user.count({ where: { role: 'student' } }),
    enrollments: await db.courseEnrollment.count(),
    sessions: await db.attendanceSession.count(),
    records: await db.attendanceRecord.count(),
    violations: await db.attendanceViolation.count(),
    notifications: await db.notification.count(),
    grades: await db.gradeBook.count(),
  };

  console.log('✅ Synthetic data complete\n');
  console.log(`   New students created:     ${createdStudents} (${skippedStudents} already existed)`);
  console.log(`   New enrollments:          ${enrollments}`);
  console.log(`   New attendance sessions:  ${sessionsCreated}`);
  console.log(`   New attendance records:   ${recordsCreated}`);
  console.log(`   New violations:           ${violationsCreated}`);
  console.log(`   New notifications:        ${notificationsCreated}`);
  console.log(`   New grade entries:        ${gradesCreated}`);
  console.log('\n📊 Database totals');
  console.log(`   Users:              ${counts.users}`);
  console.log(`   Students:           ${counts.students}`);
  console.log(`   Enrollments:        ${counts.enrollments}`);
  console.log(`   Attendance sessions:${counts.sessions}`);
  console.log(`   Attendance records: ${counts.records}`);
  console.log(`   Violations:         ${counts.violations}`);
  console.log(`   Notifications:      ${counts.notifications}`);
  console.log(`   Grade book rows:    ${counts.grades}`);
  console.log('\n💡 Sample synthetic logins (password: demo123)');
  for (let i = 0; i < Math.min(5, STUDENT_COUNT); i++) {
    const roll = 100 + i;
    console.log(`   synth.stu${String(roll).padStart(3, '0')}@aimscs.ac.in`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
