import { db } from '@/lib/db';

async function main() {
  console.log('🌱 Seeding UoH SCMS database...');

  // Clean existing data (order matters for FK constraints)
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.attendanceViolation.deleteMany();
  await db.attendanceRecord.deleteMany();
  await db.attendanceSession.deleteMany();
  await db.gradeBook.deleteMany();
  await db.quizAttempt.deleteMany();
  await db.quizQuestion.deleteMany();
  await db.submission.deleteMany();
  await db.assignment.deleteMany();
  await db.lesson.deleteMany();
  await db.module.deleteMany();
  await db.courseEnrollment.deleteMany();
  await db.timetableSlot.deleteMany();
  await db.course.deleteMany();
  await db.program.deleteMany();
  await db.biometricRecord.deleteMany();
  await db.faceEmbedding.deleteMany();
  await db.geofence.deleteMany();
  await db.user.deleteMany();

  // ==========================================
  // 1. USERS (9 roles as per document)
  // ==========================================
  const users = await Promise.all([
    db.user.create({ data: { email: 'admin@uohyd.ac.in', name: 'Dr. Ramesh Kumar', employeeId: 'UOH001', department: 'IT Department', role: 'super_admin', status: 'active', phone: '+91-9876543210' } }),
    db.user.create({ data: { email: 'dean.it@uohyd.ac.in', name: 'Prof. Anitha Sharma', employeeId: 'UOH002', department: 'Computer Science', role: 'admin', status: 'active', phone: '+91-9876543211' } }),
    db.user.create({ data: { email: 'hod.cs@uohyd.ac.in', name: 'Dr. Venkat Reddy', employeeId: 'UOH003', department: 'Computer Science', role: 'hod', status: 'active', phone: '+91-9876543212' } }),
    db.user.create({ data: { email: 'faculty.suresh@uohyd.ac.in', name: 'Dr. Suresh Babu', employeeId: 'UOH004', department: 'Computer Science', role: 'faculty', status: 'active', phone: '+91-9876543213' } }),
    db.user.create({ data: { email: 'faculty.priya@uohyd.ac.in', name: 'Dr. Priya Menon', employeeId: 'UOH005', department: 'Mathematics', role: 'faculty', status: 'active', phone: '+91-9876543214' } }),
    db.user.create({ data: { email: 'lab.ravi@uohyd.ac.in', name: 'Ravi Teja', employeeId: 'UOH006', department: 'Computer Science', role: 'lab_assistant', status: 'active', phone: '+91-9876543215' } }),
    db.user.create({ data: { email: 'student.arun@uohyd.ac.in', name: 'Arun Kumar', employeeId: 'STU001', department: 'Computer Science', role: 'student', status: 'active', phone: '+91-9876543216' } }),
    db.user.create({ data: { email: 'student.bhavya@uohyd.ac.in', name: 'Bhavya Sri', employeeId: 'STU002', department: 'Computer Science', role: 'student', status: 'active', phone: '+91-9876543217' } }),
    db.user.create({ data: { email: 'student.chaitanya@uohyd.ac.in', name: 'Chaitanya Rao', employeeId: 'STU003', department: 'Computer Science', role: 'student', status: 'active', phone: '+91-9876543218' } }),
    db.user.create({ data: { email: 'student.deepa@uohyd.ac.in', name: 'Deepa Nair', employeeId: 'STU004', department: 'Mathematics', role: 'student', status: 'active', phone: '+91-9876543219' } }),
    db.user.create({ data: { email: 'student.eshwar@uohyd.ac.in', name: 'Eshwar Prasad', employeeId: 'STU005', department: 'Computer Science', role: 'student', status: 'active', phone: '+91-9876543220' } }),
    db.user.create({ data: { email: 'student.fatima@uohyd.ac.in', name: 'Fatima Begum', employeeId: 'STU006', department: 'Electronics', role: 'student', status: 'active', phone: '+91-9876543221' } }),
    db.user.create({ data: { email: 'student.ganesh@uohyd.ac.in', name: 'Ganesh Patil', employeeId: 'STU007', department: 'Computer Science', role: 'student', status: 'active', phone: '+91-9876543222' } }),
    db.user.create({ data: { email: 'student.harika@uohyd.ac.in', name: 'Harika Devi', employeeId: 'STU008', department: 'Mathematics', role: 'student', status: 'active', phone: '+91-9876543223' } }),
    db.user.create({ data: { email: 'student.irfan@uohyd.ac.in', name: 'Irfan Khan', employeeId: 'STU009', department: 'Computer Science', role: 'student', status: 'suspended', phone: '+91-9876543224' } }),
    db.user.create({ data: { email: 'parent.arun@uohyd.ac.in', name: 'Mr. Rajesh Kumar', department: 'N/A', role: 'parent', status: 'active', phone: '+91-9876543225' } }),
    db.user.create({ data: { email: 'visitor.john@uohyd.ac.in', name: 'John Smith', department: 'External', role: 'visitor', status: 'active', phone: '+91-9876543226' } }),
    db.user.create({ data: { email: 'security.murthy@uohyd.ac.in', name: 'Murthy Garu', employeeId: 'SEC001', department: 'Security', role: 'security', status: 'active', phone: '+91-9876543227' } }),
    db.user.create({ data: { email: 'faculty.rao@uohyd.ac.in', name: 'Prof. Lakshmi Rao', employeeId: 'UOH007', department: 'Electronics', role: 'faculty', status: 'active', phone: '+91-9876543228' } }),
    db.user.create({ data: { email: 'student.jaya@uohyd.ac.in', name: 'Jaya Lakshmi', employeeId: 'STU010', department: 'Electronics', role: 'student', status: 'active', phone: '+91-9876543229' } }),
  ]);

  const [admin, , hod, faculty1, faculty2, , s1, s2, s3, s4, s5, s6, s7, s8, , , , , faculty3, s10] = users;
  const students = users.filter(u => u.role === 'student' && u.status === 'active');

  // ==========================================
  // 2. GEOFENCES
  // ==========================================
  const geofences = await Promise.all([
    db.geofence.create({ data: { name: 'School of Computer Science', type: 'circle', centerLat: 17.4563, centerLng: 78.6698, radiusMtrs: 200, building: 'CSE Building', isActive: true } }),
    db.geofence.create({ data: { name: 'School of Mathematics', type: 'circle', centerLat: 17.4575, centerLng: 78.6710, radiusMtrs: 150, building: 'Math Building', isActive: true } }),
    db.geofence.create({ data: { name: 'Central Library', type: 'circle', centerLat: 17.4550, centerLng: 78.6685, radiusMtrs: 100, building: 'Main Library', isActive: true } }),
    db.geofence.create({ data: { name: 'Science Auditorium', type: 'polygon', polygonData: JSON.stringify([{lat:17.4540,lng:78.6670},{lat:17.4540,lng:78.6690},{lat:17.4555,lng:78.6690},{lat:17.4555,lng:78.6670}]), building: 'Auditorium Block', isActive: true } }),
    db.geofence.create({ data: { name: 'Electronics Lab Complex', type: 'circle', centerLat: 17.4580, centerLng: 78.6720, radiusMtrs: 120, building: 'ECE Building', isActive: true } }),
  ]);

  // ==========================================
  // 3. PROGRAMS & COURSES (LMS)
  // ==========================================
  const programs = await Promise.all([
    db.program.create({ data: { name: 'M.Tech Computer Science', code: 'MTCS', department: 'Computer Science', duration: 2, type: 'pg', description: 'Master of Technology in Computer Science', isActive: true } }),
    db.program.create({ data: { name: 'M.Sc Mathematics', code: 'MSMA', department: 'Mathematics', duration: 2, type: 'pg', description: 'Master of Science in Mathematics', isActive: true } }),
    db.program.create({ data: { name: 'M.Tech Electronics', code: 'MTEC', department: 'Electronics', duration: 2, type: 'pg', description: 'Master of Technology in Electronics', isActive: true } }),
    db.program.create({ data: { name: 'Ph.D Computer Science', code: 'PHDCS', department: 'Computer Science', duration: 5, type: 'phd', description: 'Doctor of Philosophy in Computer Science', isActive: true } }),
  ]);

  const courses = await Promise.all([
    db.course.create({ data: { programId: programs[0].id, code: 'CS501', name: 'Advanced Algorithms', credits: 4, semester: 1, type: 'core', description: 'Design and analysis of advanced algorithms', instructorId: faculty1.id, syllabus: '## Unit 1: Graph Algorithms\n- Shortest paths\n- Network flow\n- Matching\n\n## Unit 2: NP-Completeness\n- P vs NP\n- NP-complete problems\n- Approximation algorithms', isActive: true } }),
    db.course.create({ data: { programId: programs[0].id, code: 'CS502', name: 'Machine Learning', credits: 4, semester: 1, type: 'core', description: 'Foundations and applications of machine learning', instructorId: faculty1.id, syllabus: '## Unit 1: Supervised Learning\n- Linear regression\n- Classification\n- Neural networks\n\n## Unit 2: Unsupervised Learning\n- Clustering\n- Dimensionality reduction', isActive: true } }),
    db.course.create({ data: { programId: programs[0].id, code: 'CS503', name: 'Database Systems', credits: 3, semester: 1, type: 'core', description: 'Advanced database concepts and systems', instructorId: faculty3.id, syllabus: '## Unit 1: Relational Model\n- SQL\n- Normalization\n\n## Unit 2: Transaction Processing\n- ACID properties\n- Concurrency control', isActive: true } }),
    db.course.create({ data: { programId: programs[1].id, code: 'MA501', name: 'Linear Algebra', credits: 4, semester: 1, type: 'core', description: 'Advanced linear algebra for applications', instructorId: faculty2.id, isActive: true } }),
    db.course.create({ data: { programId: programs[1].id, code: 'MA502', name: 'Probability & Statistics', credits: 3, semester: 1, type: 'core', description: 'Probability theory and statistical methods', instructorId: faculty2.id, isActive: true } }),
    db.course.create({ data: { programId: programs[2].id, code: 'EC501', name: 'Digital Signal Processing', credits: 4, semester: 1, type: 'core', description: 'DSP fundamentals and applications', instructorId: faculty3.id, isActive: true } }),
    db.course.create({ data: { programId: programs[0].id, code: 'CS504', name: 'Computer Networks', credits: 3, semester: 2, type: 'elective', description: 'Network architectures and protocols', instructorId: faculty3.id, isActive: true } }),
    db.course.create({ data: { programId: programs[0].id, code: 'CS505', name: 'AI Lab', credits: 2, semester: 1, type: 'lab', description: 'Hands-on AI/ML experiments', instructorId: faculty1.id, isActive: true } }),
  ]);

  // ==========================================
  // 4. COURSE ENROLLMENTS
  // ==========================================
  const enrollmentData: {courseId: string; studentId: string; status: string}[] = [];
  for (const student of students) {
    // Each student enrolls in 3-5 courses based on department
    let courseIndices: number[];
    if (student.department === 'Computer Science') {
      courseIndices = [0, 1, 2, 4, 7]; // CS501, CS502, CS503, MA502, CS505
    } else if (student.department === 'Mathematics') {
      courseIndices = [3, 4]; // MA501, MA502
    } else {
      courseIndices = [5]; // EC501
    }
    for (const idx of courseIndices) {
      enrollmentData.push({ courseId: courses[idx].id, studentId: student.id, status: 'enrolled' });
    }
  }
  await db.courseEnrollment.createMany({ data: enrollmentData });

  // ==========================================
  // 5. MODULES & LESSONS
  // ==========================================
  const modulesData = [
    { courseId: courses[0].id, title: 'Graph Algorithms', orderIndex: 0 },
    { courseId: courses[0].id, title: 'Network Flow', orderIndex: 1 },
    { courseId: courses[0].id, title: 'NP-Completeness', orderIndex: 2 },
    { courseId: courses[1].id, title: 'Supervised Learning', orderIndex: 0 },
    { courseId: courses[1].id, title: 'Unsupervised Learning', orderIndex: 1 },
    { courseId: courses[1].id, title: 'Deep Learning', orderIndex: 2 },
    { courseId: courses[2].id, title: 'Relational Model & SQL', orderIndex: 0 },
    { courseId: courses[2].id, title: 'Transaction Processing', orderIndex: 1 },
    { courseId: courses[3].id, title: 'Vector Spaces', orderIndex: 0 },
    { courseId: courses[3].id, title: 'Eigenvalues & Eigenvectors', orderIndex: 1 },
    { courseId: courses[4].id, title: 'Probability Foundations', orderIndex: 0 },
    { courseId: courses[4].id, title: 'Statistical Inference', orderIndex: 1 },
    { courseId: courses[5].id, title: 'Discrete-Time Signals', orderIndex: 0 },
    { courseId: courses[5].id, title: 'Z-Transform', orderIndex: 1 },
  ];

  const modules = await Promise.all(modulesData.map(m =>
    db.module.create({ data: { ...m, isPublished: true, description: `Module covering ${m.title}` } })
  ));

  const lessonsData: {moduleId: string; title: string; type: string; orderIndex: number; duration: number; isPublished: boolean}[] = [];
  modules.forEach((mod, idx) => {
    lessonsData.push(
      { moduleId: mod.id, title: `Introduction to ${mod.title}`, type: 'video', orderIndex: 0, duration: 45, isPublished: true },
      { moduleId: mod.id, title: `${mod.title} - Core Concepts`, type: 'video', orderIndex: 1, duration: 60, isPublished: true },
      { moduleId: mod.id, title: `${mod.title} - Practice Problems`, type: 'document', orderIndex: 2, duration: 30, isPublished: true },
      { moduleId: mod.id, title: `${mod.title} - Quiz`, type: 'quiz', orderIndex: 3, duration: 20, isPublished: true },
    );
  });
  await db.lesson.createMany({ data: lessonsData });

  // ==========================================
  // 6. TIMETABLE SLOTS
  // ==========================================
  const timetableSlots = await Promise.all([
    db.timetableSlot.create({ data: { courseId: courses[0].id, dayOfWeek: 1, startTime: '09:00', endTime: '10:30', roomNumber: 'CSE-301', building: 'CSE Building', semester: '1', academicYear: '2025-26', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[1].id, dayOfWeek: 1, startTime: '11:00', endTime: '12:30', roomNumber: 'CSE-302', building: 'CSE Building', semester: '1', academicYear: '2025-26', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[2].id, dayOfWeek: 2, startTime: '09:00', endTime: '10:30', roomNumber: 'CSE-303', building: 'CSE Building', semester: '1', academicYear: '2025-26', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[3].id, dayOfWeek: 2, startTime: '14:00', endTime: '15:30', roomNumber: 'MATH-201', building: 'Math Building', semester: '1', academicYear: '2025-26', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[4].id, dayOfWeek: 3, startTime: '09:00', endTime: '10:30', roomNumber: 'MATH-202', building: 'Math Building', semester: '1', academicYear: '2025-26', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[0].id, dayOfWeek: 3, startTime: '14:00', endTime: '15:30', roomNumber: 'CSE-301', building: 'CSE Building', semester: '1', academicYear: '2025-26', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[5].id, dayOfWeek: 4, startTime: '09:00', endTime: '10:30', roomNumber: 'ECE-LAB1', building: 'ECE Building', semester: '1', academicYear: '2025-26', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[7].id, dayOfWeek: 4, startTime: '14:00', endTime: '17:00', roomNumber: 'AI-LAB1', building: 'CSE Building', semester: '1', academicYear: '2025-26', isActive: true } }),
  ]);

  // ==========================================
  // 7. ATTENDANCE SESSIONS & RECORDS
  // ==========================================
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const sessions: Awaited<ReturnType<typeof db.attendanceSession.create>>[] = [];
  const captureMethods = ['manual', 'face', 'gps', 'qrcode', 'biometric'];

  // Create sessions for past dates
  for (let i = 0; i < Math.min(dates.length, 10); i++) {
    const dateStr = dates[i];
    const slotIdx = i % timetableSlots.length;
    const slot = timetableSlots[slotIdx];
    const method = captureMethods[i % captureMethods.length];
    const expectedCount = 8 + Math.floor(Math.random() * 5);
    const presentCount = Math.floor(expectedCount * (0.65 + Math.random() * 0.3));
    const lateCount = Math.floor(Math.random() * 3);
    const absentCount = expectedCount - presentCount - lateCount;

    const session = await db.attendanceSession.create({
      data: {
        timetableSlotId: slot.id,
        courseId: slot.courseId,
        createdBy: faculty1.id,
        geofenceId: geofences[0].id,
        sessionDate: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: i === 0 ? 'active' : 'completed',
        captureMethod: method,
        expectedCount,
        presentCount: Math.max(0, presentCount),
        absentCount: Math.max(0, absentCount),
        lateCount,
      }
    });
    sessions.push(session);

    // Create attendance records for this session
    const enrolledStudents = students.slice(0, expectedCount);
    for (const student of enrolledStudents) {
      const rand = Math.random();
      let status: string;
      if (rand < 0.75) status = 'present';
      else if (rand < 0.88) status = 'late';
      else status = 'absent';

      await db.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId: student.id,
          status,
          markedAt: status !== 'absent' ? new Date(`${dateStr}T${slot.startTime}:00`) : null,
          captureMethod: method,
          confidence: method === 'face' ? 0.85 + Math.random() * 0.13 : null,
          gpsLat: method === 'gps' ? 17.4563 + (Math.random() - 0.5) * 0.002 : null,
          gpsLng: method === 'gps' ? 78.6698 + (Math.random() - 0.5) * 0.002 : null,
        }
      });
    }
  }

  // Create a live "active" session for today
  const liveSession = await db.attendanceSession.create({
    data: {
      timetableSlotId: timetableSlots[0].id,
      courseId: courses[0].id,
      createdBy: faculty1.id,
      geofenceId: geofences[0].id,
      sessionDate: today.toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:30',
      status: 'active',
      captureMethod: 'face',
      expectedCount: 9,
      presentCount: 6,
      absentCount: 1,
      lateCount: 2,
    }
  });

  // ==========================================
  // 8. ASSIGNMENTS & SUBMISSIONS
  // ==========================================
  const assignments = await Promise.all([
    db.assignment.create({ data: { courseId: courses[0].id, title: 'Dijkstra Algorithm Implementation', description: 'Implement Dijkstra\'s shortest path algorithm with min-heap optimization', type: 'individual', maxScore: 100, dueDate: new Date(today.getTime() + 7 * 86400000), allowLate: true, latePenalty: 10, status: 'published' } }),
    db.assignment.create({ data: { courseId: courses[0].id, title: 'Network Flow Problem Set', description: 'Solve 5 network flow problems from the textbook', type: 'individual', maxScore: 50, dueDate: new Date(today.getTime() + 14 * 86400000), allowLate: true, latePenalty: 15, status: 'published' } }),
    db.assignment.create({ data: { courseId: courses[1].id, title: 'ML Classification Project', description: 'Build a classifier using scikit-learn on the provided dataset', type: 'individual', maxScore: 100, dueDate: new Date(today.getTime() + 10 * 86400000), allowLate: true, latePenalty: 10, status: 'published' } }),
    db.assignment.create({ data: { courseId: courses[1].id, title: 'Neural Network from Scratch', description: 'Implement a 3-layer neural network without using ML frameworks', type: 'individual', maxScore: 100, dueDate: new Date(today.getTime() - 3 * 86400000), allowLate: false, status: 'grading' } }),
    db.assignment.create({ data: { courseId: courses[2].id, title: 'SQL Query Optimization', description: 'Optimize given SQL queries and explain the improvement strategies', type: 'individual', maxScore: 75, dueDate: new Date(today.getTime() + 5 * 86400000), allowLate: true, latePenalty: 20, status: 'published' } }),
    db.assignment.create({ data: { courseId: courses[3].id, title: 'Eigenvalue Problems', description: 'Solve eigenvalue problems from Chapters 5 and 6', type: 'individual', maxScore: 50, dueDate: new Date(today.getTime() - 7 * 86400000), allowLate: false, status: 'closed' } }),
  ]);

  // Submissions for past assignments
  for (const student of students.slice(0, 6)) {
    await db.submission.create({
      data: {
        assignmentId: assignments[3].id,
        studentId: student.id,
        content: 'Neural network implementation with backpropagation',
        score: 65 + Math.floor(Math.random() * 35),
        feedback: 'Good implementation. Consider adding dropout for regularization.',
        status: 'graded',
        gradedAt: new Date(),
      }
    });
    await db.submission.create({
      data: {
        assignmentId: assignments[5].id,
        studentId: student.id,
        content: 'Eigenvalue solutions submitted',
        score: 35 + Math.floor(Math.random() * 15),
        feedback: 'Correct approach on problems 1-4. Review problem 5.',
        status: 'graded',
        gradedAt: new Date(),
      }
    });
  }

  // ==========================================
  // 9. QUIZ QUESTIONS & ATTEMPTS
  // ==========================================
  const quizQuestions = await Promise.all([
    db.quizQuestion.create({ data: { courseId: courses[0].id, question: 'What is the time complexity of Dijkstra\'s algorithm with a binary heap?', type: 'mcq', options: JSON.stringify(['O(V²)', 'O(E log V)', 'O(V log V)', 'O(E + V)']), correctAnswer: 'O(E log V)', points: 2, difficulty: 'medium' } }),
    db.quizQuestion.create({ data: { courseId: courses[0].id, question: 'The Ford-Fulkerson algorithm is used to solve which problem?', type: 'mcq', options: JSON.stringify(['Shortest path', 'Maximum flow', 'Minimum spanning tree', 'Graph coloring']), correctAnswer: 'Maximum flow', points: 2, difficulty: 'easy' } }),
    db.quizQuestion.create({ data: { courseId: courses[0].id, question: 'NP stands for Non-deterministic Polynomial time.', type: 'true_false', options: JSON.stringify(['True', 'False']), correctAnswer: 'True', points: 1, difficulty: 'easy' } }),
    db.quizQuestion.create({ data: { courseId: courses[1].id, question: 'Which activation function is most commonly used in hidden layers of deep networks?', type: 'mcq', options: JSON.stringify(['Sigmoid', 'Tanh', 'ReLU', 'Softmax']), correctAnswer: 'ReLU', points: 2, difficulty: 'easy' } }),
    db.quizQuestion.create({ data: { courseId: courses[1].id, question: 'Overfitting can be reduced by using regularization techniques.', type: 'true_false', options: JSON.stringify(['True', 'False']), correctAnswer: 'True', points: 1, difficulty: 'easy' } }),
    db.quizQuestion.create({ data: { courseId: courses[1].id, question: 'Explain the bias-variance tradeoff.', type: 'short_answer', points: 5, difficulty: 'hard' } }),
    db.quizQuestion.create({ data: { courseId: courses[2].id, question: 'Which normal form eliminates transitive dependencies?', type: 'mcq', options: JSON.stringify(['1NF', '2NF', '3NF', 'BCNF']), correctAnswer: '3NF', points: 2, difficulty: 'medium' } }),
    db.quizQuestion.create({ data: { courseId: courses[3].id, question: 'Every square matrix has at least one eigenvalue over the complex field.', type: 'true_false', options: JSON.stringify(['True', 'False']), correctAnswer: 'True', points: 1, difficulty: 'medium' } }),
  ]);

  // Quiz attempts
  for (const student of students.slice(0, 5)) {
    const csQs = quizQuestions.filter(q => q.courseId === courses[0].id);
    const score = 2 + Math.floor(Math.random() * 3);
    await db.quizAttempt.create({
      data: {
        studentId: student.id,
        courseId: courses[0].id,
        questions: JSON.stringify(csQs.map(q => q.id)),
        answers: JSON.stringify({ [csQs[0]?.id || '']: 'O(E log V)', [csQs[1]?.id || '']: 'Maximum flow', [csQs[2]?.id || '']: 'True' }),
        score,
        totalPoints: 5,
        percentage: (score / 5) * 100,
        timeTaken: 300 + Math.floor(Math.random() * 600),
        status: 'completed',
        completedAt: new Date(),
      }
    });
  }

  // ==========================================
  // 10. GRADE BOOK
  // ==========================================
  const gradeComponents = ['assignment', 'quiz', 'midterm', 'final', 'participation'];
  for (const student of students.slice(0, 6)) {
    for (const course of courses.slice(0, 3)) {
      for (const component of gradeComponents) {
        await db.gradeBook.create({
          data: {
            courseId: course.id,
            studentId: student.id,
            component,
            score: component === 'participation' ? 8 + Math.random() * 2 : 50 + Math.random() * 45,
            maxScore: component === 'participation' ? 10 : 100,
            weightage: component === 'assignment' ? 25 : component === 'quiz' ? 15 : component === 'midterm' ? 20 : component === 'final' ? 30 : 10,
            gradedBy: faculty1.id,
          }
        });
      }
    }
  }

  // ==========================================
  // 11. VIOLATIONS
  // ==========================================
  const violationTypes = ['spoofing', 'proxy', 'out_of_geofence', 'face_mismatch'];
  const severities = ['low', 'medium', 'high', 'critical'];

  for (let i = 0; i < 8; i++) {
    const randomStudent = students[i % students.length];
    const randomSession = sessions[i % Math.min(5, sessions.length)];
    if (!randomSession) continue;

    const record = await db.attendanceRecord.findFirst({
      where: { sessionId: randomSession.id, studentId: randomStudent.id }
    });
    if (!record) continue;

    // Check if violation already exists for this record
    const existing = await db.attendanceViolation.findUnique({ where: { recordId: record.id } });
    if (existing) continue;

    await db.attendanceViolation.create({
      data: {
        recordId: record.id,
        studentId: randomStudent.id,
        type: violationTypes[i % violationTypes.length],
        severity: severities[i % severities.length],
        description: `${violationTypes[i % violationTypes.length]} detected during attendance session on ${randomSession.sessionDate}`,
        reviewStatus: i < 4 ? 'pending' : i < 6 ? 'confirmed' : 'dismissed',
        reviewedBy: i >= 4 ? hod.id : undefined,
        reviewNotes: i >= 4 ? (i < 6 ? 'Violation confirmed after review' : 'False positive - student was present') : undefined,
      }
    });
  }

  // ==========================================
  // 12. NOTIFICATIONS
  // ==========================================
  await db.notification.createMany({
    data: [
      { userId: hod.id, title: 'Attendance Alert', message: 'Low attendance detected for CS501 - Advanced Algorithms (67% average)', type: 'warning', channel: 'in_app', isRead: false },
      { userId: faculty1.id, title: 'Session Completed', message: 'Attendance session for CS501 has been completed. 8/10 present.', type: 'success', channel: 'in_app', isRead: true },
      { userId: admin.id, title: 'Violation Reported', message: '3 new attendance violations require your review', type: 'warning', channel: 'in_app', isRead: false },
      { userId: students[0].id, title: 'Assignment Due', message: 'ML Classification Project is due in 10 days', type: 'info', channel: 'in_app', isRead: false },
      { userId: students[1].id, title: 'Grade Published', message: 'Your Neural Network assignment has been graded: 87/100', type: 'success', channel: 'in_app', isRead: false },
      { userId: faculty1.id, title: 'New Enrollment', message: '2 new students enrolled in Advanced Algorithms', type: 'info', channel: 'in_app', isRead: true },
      { userId: admin.id, title: 'System Update', message: 'Face recognition model updated to ArcFace v3.0', type: 'info', channel: 'in_app', isRead: false },
      { userId: students[2].id, title: 'Low Attendance Warning', message: 'Your attendance in CS502 is below 75%. Please improve attendance.', type: 'warning', channel: 'in_app', isRead: false },
    ]
  });

  // ==========================================
  // 13. AUDIT LOGS
  // ==========================================
  await db.auditLog.createMany({
    data: [
      { userId: admin.id, action: 'CREATE', resource: 'geofence', details: 'Created geofence: School of Computer Science', ipAddress: '192.168.1.100' },
      { userId: faculty1.id, action: 'CREATE', resource: 'attendance_session', details: 'Created attendance session for CS501', ipAddress: '192.168.1.101' },
      { userId: hod.id, action: 'REVIEW', resource: 'violation', details: 'Reviewed violation: confirmed proxy attempt', ipAddress: '192.168.1.102' },
      { userId: admin.id, action: 'UPDATE', resource: 'user', details: 'Updated role for Dr. Priya Menon to faculty', ipAddress: '192.168.1.100' },
      { userId: admin.id, action: 'CONFIG', resource: 'system', details: 'Updated face recognition threshold to 0.92', ipAddress: '192.168.1.100' },
    ]
  });

  // Stats summary
  const userCount = await db.user.count();
  const courseCount = await db.course.count();
  const sessionCount = await db.attendanceSession.count();
  const recordCount = await db.attendanceRecord.count();
  const violationCount = await db.attendanceViolation.count();

  console.log('✅ Seed completed successfully!');
  console.log(`   Users: ${userCount}`);
  console.log(`   Courses: ${courseCount}`);
  console.log(`   Attendance Sessions: ${sessionCount}`);
  console.log(`   Attendance Records: ${recordCount}`);
  console.log(`   Violations: ${violationCount}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
