import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { CALENDAR_SEED_EVENTS } from './calendar-events-data';
import { DEFAULT_ROLE_SECTIONS } from '../src/lib/rbac-defaults';
import { cloneDefaultSystemConfig } from '../src/lib/system-config-defaults';

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function utcDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00.000Z`).getUTCDay();
}

function pickSlotForDate<T extends { id: string; courseId: string; dayOfWeek: number; startTime: string; endTime: string }>(
  slots: T[],
  dateStr: string,
  courseId?: string,
): T | null {
  const day = utcDayOfWeek(dateStr);
  const matches = slots.filter(s => s.dayOfWeek === day && (!courseId || s.courseId === courseId));
  return matches[0] ?? null;
}

async function createActiveSession(
  usedKeys: Set<string>,
  data: Parameters<typeof db.attendanceSession.create>[0]['data'],
) {
  let payload = { ...data };
  if (payload.timetableSlotId && payload.sessionDate) {
    const key = `${payload.timetableSlotId}:${payload.sessionDate}`;
    if (usedKeys.has(key)) {
      payload = { ...payload, timetableSlotId: null };
    } else {
      usedKeys.add(key);
    }
  }
  return db.attendanceSession.create({ data: payload });
}

async function main() {
  console.log('🌱 Seeding JNTUH SCMS database with R22 Regulation data...');

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
  await db.calendarEvent.deleteMany();
  await db.subject.deleteMany();
  await db.semester.deleteMany();
  await db.academicYear.deleteMany();
  await db.biometricRecord.deleteMany();
  await db.faceEmbedding.deleteMany();
  await db.geofence.deleteMany();
  await db.rbacConfig.deleteMany();
  await db.user.deleteMany();
  await db.department.deleteMany();

  // ==========================================
  // 1. DEPARTMENTS (JNTUH Engineering College)
  // ==========================================
  console.log('📦 Creating departments...');
  const departments = await Promise.all([
    db.department.create({ data: { name: 'Computer Science & Engineering', code: 'CSE', building: 'CSE Block', floor: '1-3', phone: '+91-40-23158661', email: 'cse@jntuh.ac.in', isActive: true } }),
    db.department.create({ data: { name: 'CSE (Artificial Intelligence & Machine Learning)', code: 'CSE-AIML', building: 'CSE Block', floor: '4', phone: '+91-40-23158662', email: 'aiml@jntuh.ac.in', isActive: true } }),
    db.department.create({ data: { name: 'CSE (Data Science)', code: 'CSE-DS', building: 'CSE Block', floor: '4', phone: '+91-40-23158663', email: 'ds@jntuh.ac.in', isActive: true } }),
    db.department.create({ data: { name: 'CSE (Networks)', code: 'CSE-NT', building: 'CSE Block', floor: '3', phone: '+91-40-23158664', email: 'nt@jntuh.ac.in', isActive: true } }),
    db.department.create({ data: { name: 'Electronics & Communication Engineering', code: 'ECE', building: 'ECE Block', floor: '1-3', phone: '+91-40-23158665', email: 'ece@jntuh.ac.in', isActive: true } }),
    db.department.create({ data: { name: 'Electrical & Electronics Engineering', code: 'EEE', building: 'EEE Block', floor: '1-2', phone: '+91-40-23158666', email: 'eee@jntuh.ac.in', isActive: true } }),
    db.department.create({ data: { name: 'Mechanical Engineering', code: 'MECH', building: 'MECH Block', floor: '1-2', phone: '+91-40-23158667', email: 'mech@jntuh.ac.in', isActive: true } }),
    db.department.create({ data: { name: 'Civil Engineering', code: 'CIVIL', building: 'CIVIL Block', floor: '1-2', phone: '+91-40-23158668', email: 'civil@jntuh.ac.in', isActive: true } }),
    db.department.create({ data: { name: 'Information Technology', code: 'IT', building: 'IT Block', floor: '1-2', phone: '+91-40-23158669', email: 'it@jntuh.ac.in', isActive: true } }),
    db.department.create({ data: { name: 'Computer Science & Applied Mathematics', code: 'CSAM', building: 'CSE Block', floor: '5', phone: '+91-40-23158670', email: 'csam@jntuh.ac.in', isActive: true } }),
  ]);

  const [cseDept, aimlDept, dsDept, ntDept, eceDept, eeeDept, mechDept, civilDept, itDept, csamDept] = departments;

  // ==========================================
  // 2. ACADEMIC YEAR
  // ==========================================
  console.log('📦 Creating academic year...');
  const academicYear = await db.academicYear.create({
    data: {
      name: '2025-2026',
      code: 'AY2526',
      startDate: '2025-07-01',
      endDate: '2026-06-30',
      status: 'active',
      regulation: 'R22',
      isActive: true,
    }
  });

  // ==========================================
  // 3. SEMESTERS (8 semesters for 4-year B.Tech)
  // ==========================================
  console.log('📦 Creating semesters...');
  const semestersData = [
    { name: 'I Year I Sem', code: 'I-I', year: 1, semester: 1, startDate: '2025-07-01', endDate: '2025-11-30', status: 'active' },
    { name: 'I Year II Sem', code: 'I-II', year: 1, semester: 2, startDate: '2025-12-01', endDate: '2026-04-30', status: 'upcoming' },
    { name: 'II Year I Sem', code: 'II-I', year: 2, semester: 1, startDate: '2025-07-01', endDate: '2025-11-30', status: 'active' },
    { name: 'II Year II Sem', code: 'II-II', year: 2, semester: 2, startDate: '2025-12-01', endDate: '2026-04-30', status: 'upcoming' },
    { name: 'III Year I Sem', code: 'III-I', year: 3, semester: 1, startDate: '2025-07-01', endDate: '2025-11-30', status: 'active' },
    { name: 'III Year II Sem', code: 'III-II', year: 3, semester: 2, startDate: '2025-12-01', endDate: '2026-04-30', status: 'upcoming' },
    { name: 'IV Year I Sem', code: 'IV-I', year: 4, semester: 1, startDate: '2025-07-01', endDate: '2025-11-30', status: 'active' },
    { name: 'IV Year II Sem', code: 'IV-II', year: 4, semester: 2, startDate: '2025-12-01', endDate: '2026-04-30', status: 'upcoming' },
  ];

  const semesters = await Promise.all(
    semestersData.map(s => db.semester.create({
      data: { ...s, academicYearId: academicYear.id, isActive: true }
    }))
  );

  const [semI1, semI2, semII1, semII2, semIII1, semIII2, semIV1, semIV2] = semesters;

  // ==========================================
  // 4. SUBJECTS (JNTU R22 CSE pattern)
  // ==========================================
  console.log('📦 Creating subjects...');
  const subjectsData = [
    // I Year I Sem (CSE)
    { code: 'MA101BS', name: 'Mathematics-I', departmentId: cseDept.id, semesterId: semI1.id, credits: 3, lectureHours: 3, tutorialHours: 1, labHours: 0, type: 'core', category: 'BS', syllabus: 'Matrices, Eigen values, Eigen vectors, Partial differentiation, Multiple integrals, Special functions', textbooks: JSON.stringify(['Higher Engineering Mathematics by B.S. Grewal', 'Advanced Engineering Mathematics by Erwin Kreyszig']), referenceBooks: JSON.stringify(['Engineering Mathematics by N.P. Bali']) },
    { code: 'AP101BS', name: 'Applied Physics', departmentId: cseDept.id, semesterId: semI1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'BS', syllabus: 'Wave Optics, Lasers, Fiber Optics, Quantum Mechanics, Solid State Physics, Semiconductors', textbooks: JSON.stringify(['Engineering Physics by Avadhanulu & Kshirsagar', 'Physics for Engineers by M.N. Avadhanulu']), referenceBooks: JSON.stringify(['Modern Engineering Physics by A.S. Vasudeva']) },
    { code: 'CS101ES', name: 'Programming for Problem Solving', departmentId: cseDept.id, semesterId: semI1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'ES', syllabus: 'Introduction to C, Variables, Data Types, Operators, Control Structures, Arrays, Strings, Functions, Pointers, Structures, File Handling', textbooks: JSON.stringify(['Let Us C by Yashavant Kanetkar', 'Programming in ANSI C by E. Balaguruswamy']), referenceBooks: JSON.stringify(['C Programming: A Modern Approach by K.N. King']) },
    { code: 'EE101ES', name: 'Basic Electrical Engineering', departmentId: cseDept.id, semesterId: semI1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'ES', syllabus: 'DC Circuits, AC Circuits, Transformers, Electrical Machines, Measuring Instruments', textbooks: JSON.stringify(['Basic Electrical Engineering by V.K. Mehta', 'Electrical Technology by B.L. Theraja']), referenceBooks: JSON.stringify(['Fundamentals of Electrical Engineering by R. Prasad']) },
    { code: 'ME101ES', name: 'Engineering Drawing', departmentId: cseDept.id, semesterId: semI1.id, credits: 3, lectureHours: 2, tutorialHours: 0, labHours: 3, type: 'core', category: 'ES', syllabus: 'Introduction to Engineering Drawing, Conic Sections, Projections of Points, Lines, Planes, Solids, Isometric Projections', textbooks: JSON.stringify(['Engineering Drawing by N.D. Bhatt', 'Engineering Graphics by P.J. Shah']), referenceBooks: JSON.stringify(['Machine Drawing by N.D. Bhatt']) },
    { code: 'AP111BS', name: 'Applied Physics Lab', departmentId: cseDept.id, semesterId: semI1.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'BS' },
    { code: 'CS111ES', name: 'Programming Lab', departmentId: cseDept.id, semesterId: semI1.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'ES' },
    { code: 'MC101BS', name: 'English', departmentId: cseDept.id, semesterId: semI1.id, credits: 2, lectureHours: 2, tutorialHours: 0, labHours: 0, type: 'audit', category: 'HS', syllabus: 'Grammar, Vocabulary, Reading Comprehension, Writing Skills, Communication Skills' },
    { code: 'CS112ES', name: 'IT Workshop', departmentId: cseDept.id, semesterId: semI1.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'ES' },

    // I Year II Sem (CSE)
    { code: 'MA201BS', name: 'Mathematics-II', departmentId: cseDept.id, semesterId: semI2.id, credits: 4, lectureHours: 3, tutorialHours: 1, labHours: 0, type: 'core', category: 'BS', syllabus: 'Ordinary Differential Equations, Laplace Transforms, Vector Calculus, Fourier Series, PDE', textbooks: JSON.stringify(['Higher Engineering Mathematics by B.S. Grewal']), referenceBooks: JSON.stringify(['Advanced Engineering Mathematics by Erwin Kreyszig']) },
    { code: 'CH201BS', name: 'Chemistry', departmentId: cseDept.id, semesterId: semI2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'BS', syllabus: 'Water Technology, Corrosion, Polymers, Fuels, Lubricants, Phase Rule, Chemical Bonding', textbooks: JSON.stringify(['Engineering Chemistry by P.C. Jain & Monika']), referenceBooks: JSON.stringify(['Engineering Chemistry by Shashi Chawla']) },
    { code: 'CS201ES', name: 'Data Structures', departmentId: cseDept.id, semesterId: semI2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'ES', syllabus: 'Arrays, Linked Lists, Stacks, Queues, Trees, Graphs, Sorting, Searching, Hashing', textbooks: JSON.stringify(['Data Structures through C by G.S. Baluja', 'Data Structures and Algorithms by A.V. Aho']), referenceBooks: JSON.stringify(['Data Structures using C by Reema Thareja']) },
    { code: 'EC201ES', name: 'Digital Logic Design', departmentId: cseDept.id, semesterId: semI2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'ES', syllabus: 'Number Systems, Boolean Algebra, Combinational Circuits, Sequential Circuits, Memory, PLA, PAL', textbooks: JSON.stringify(['Digital Design by M. Morris Mano', 'Fundamentals of Digital Logic by Brown & Vranesic']), referenceBooks: JSON.stringify(['Digital Logic and Computer Design by M. Morris Mano']) },
    { code: 'CS211ES', name: 'Data Structures Lab', departmentId: cseDept.id, semesterId: semI2.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'ES' },
    { code: 'CH211BS', name: 'Chemistry Lab', departmentId: cseDept.id, semesterId: semI2.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'BS' },
    { code: 'MC201', name: 'Environmental Science', departmentId: cseDept.id, semesterId: semI2.id, credits: 0, lectureHours: 2, tutorialHours: 0, labHours: 0, type: 'audit', category: 'HS', syllabus: 'Ecosystems, Biodiversity, Environmental Pollution, Natural Resources, Social Issues' },
    { code: 'CS202ES', name: 'Discrete Mathematics', departmentId: cseDept.id, semesterId: semI2.id, credits: 3, lectureHours: 3, tutorialHours: 1, labHours: 0, type: 'core', category: 'BS', syllabus: 'Set Theory, Relations, Functions, Graph Theory, Combinatorics, Logic, Proofs, Algebraic Structures', textbooks: JSON.stringify(['Discrete Mathematics by Kenneth H. Rosen', 'Discrete Mathematical Structures by Kolman & Busby']), referenceBooks: JSON.stringify(['Discrete Mathematics by R. Johnsonbaugh']) },

    // II Year I Sem (CSE)
    { code: 'MA301BS', name: 'Mathematical Foundations of CS', departmentId: cseDept.id, semesterId: semII1.id, credits: 3, lectureHours: 3, tutorialHours: 1, labHours: 0, type: 'core', category: 'BS', syllabus: 'Probability, Statistics, Information Theory, Group Theory, Lattices, Boolean Algebra', textbooks: JSON.stringify(['Mathematical Foundations of Computer Science by J.K. Sharma']), referenceBooks: JSON.stringify(['Discrete Mathematics by Kenneth Rosen']) },
    { code: 'CS301PC', name: 'Computer Organization', departmentId: cseDept.id, semesterId: semII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Basic Computer Organization, Register Transfer, Micro-operations, CPU Design, Control Unit, Memory Organization, I/O Organization, Pipelining', textbooks: JSON.stringify(['Computer Organization by Carl Hamacher', 'Computer System Architecture by M. Morris Mano']), referenceBooks: JSON.stringify(['Computer Organization and Design by Patterson & Hennessy']) },
    { code: 'CS302PC', name: 'Operating Systems', departmentId: cseDept.id, semesterId: semII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Process Management, CPU Scheduling, Process Synchronization, Deadlocks, Memory Management, Virtual Memory, File Systems, I/O Systems', textbooks: JSON.stringify(['Operating System Concepts by Silberschatz, Galvin & Gagne', 'Operating Systems by William Stallings']), referenceBooks: JSON.stringify(['Modern Operating Systems by Andrew S. Tanenbaum']) },
    { code: 'CS303PC', name: 'Database Management Systems', departmentId: cseDept.id, semesterId: semII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'ER Model, Relational Model, SQL, Normalization, Transaction Management, Concurrency Control, Recovery, Indexing, NoSQL', textbooks: JSON.stringify(['Database System Concepts by Silberschatz, Korth & Sudarshan', 'Fundamentals of Database Systems by Elmasri & Navathe']), referenceBooks: JSON.stringify(['Database Management Systems by R. Ramakrishnan']) },
    { code: 'CS304PC', name: 'Object Oriented Programming through Java', departmentId: cseDept.id, semesterId: semII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'OOP Concepts, Java Basics, Inheritance, Polymorphism, Interfaces, Packages, Exception Handling, Multithreading, I/O, Collections, Generics, Applets, Swings, JDBC', textbooks: JSON.stringify(['Java: The Complete Reference by Herbert Schildt', 'Core Java by Cay Horstmann']), referenceBooks: JSON.stringify(['Head First Java by Kathy Sierra']) },
    { code: 'CS311PC', name: 'OS Lab', departmentId: cseDept.id, semesterId: semII1.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },
    { code: 'CS312PC', name: 'DBMS Lab', departmentId: cseDept.id, semesterId: semII1.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },
    { code: 'CS313PC', name: 'Java Programming Lab', departmentId: cseDept.id, semesterId: semII1.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },

    // II Year II Sem (CSE)
    { code: 'CS401PC', name: 'Design and Analysis of Algorithms', departmentId: cseDept.id, semesterId: semII2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Algorithm Design Techniques: Greedy, Dynamic Programming, Backtracking, Branch and Bound, NP-Completeness, Approximation Algorithms', textbooks: JSON.stringify(['Introduction to Algorithms by Cormen, Leiserson, Rivest & Stein', 'Algorithm Design by Jon Kleinberg & Eva Tardos']), referenceBooks: JSON.stringify(['Design and Analysis of Algorithms by Aho, Hopcroft & Ullman']) },
    { code: 'CS402PC', name: 'Computer Networks', departmentId: cseDept.id, semesterId: semII2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'OSI Model, TCP/IP, Data Link Layer, Network Layer, Transport Layer, Application Layer, Network Security', textbooks: JSON.stringify(['Computer Networks by Andrew S. Tanenbaum', 'Data Communications and Networking by Behrouz Forouzan']), referenceBooks: JSON.stringify(['Computer Networking: A Top-Down Approach by Kurose & Ross']) },
    { code: 'CS403PC', name: 'Software Engineering', departmentId: cseDept.id, semesterId: semII2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Software Process Models, Requirements Engineering, Design Patterns, Testing, Project Management, Agile, UML', textbooks: JSON.stringify(['Software Engineering: A Practitioners Approach by Roger Pressman', 'Software Engineering by Ian Sommerville']), referenceBooks: JSON.stringify(['Design Patterns by Gang of Four']) },
    { code: 'CS404PC', name: 'Python Programming', departmentId: cseDept.id, semesterId: semII2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Python Basics, Data Structures in Python, OOP in Python, Modules, File Handling, Regular Expressions, Database Connectivity, Web Scraping, Numpy, Pandas, Matplotlib', textbooks: JSON.stringify(['Python Crash Course by Eric Matthes', 'Automate the Boring Stuff with Python by Al Sweigart']), referenceBooks: JSON.stringify(['Learning Python by Mark Lutz']) },
    { code: 'CS405PC', name: 'Theory of Computation', departmentId: cseDept.id, semesterId: semII2.id, credits: 3, lectureHours: 3, tutorialHours: 1, labHours: 0, type: 'core', category: 'PC', syllabus: 'Finite Automata, Regular Expressions, Context-Free Grammars, Push Down Automata, Turing Machines, Undecidability', textbooks: JSON.stringify(['Introduction to Theory of Computation by Michael Sipser', 'Theory of Computation by Peter Linz']), referenceBooks: JSON.stringify(['Introduction to Automata Theory by Hopcroft, Motwani & Ullman']) },
    { code: 'CS411PC', name: 'Computer Networks Lab', departmentId: cseDept.id, semesterId: semII2.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },
    { code: 'CS412PC', name: 'Python Programming Lab', departmentId: cseDept.id, semesterId: semII2.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },
    { code: 'CS413PC', name: 'Software Engineering Lab', departmentId: cseDept.id, semesterId: semII2.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },

    // III Year I Sem (CSE)
    { code: 'CS501PC', name: 'Compiler Design', departmentId: cseDept.id, semesterId: semIII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Lexical Analysis, Syntax Analysis, Semantic Analysis, Intermediate Code Generation, Code Optimization, Code Generation', textbooks: JSON.stringify(['Compilers: Principles, Techniques & Tools by Aho, Lam, Sethi & Ullman', 'Compiler Design by Aho & Ullman']), referenceBooks: JSON.stringify(['Modern Compiler Implementation by Andrew Appel']) },
    { code: 'CS502PC', name: 'Artificial Intelligence', departmentId: cseDept.id, semesterId: semIII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Search Strategies, Knowledge Representation, Reasoning, Planning, Learning, NLP, Expert Systems, Neural Networks', textbooks: JSON.stringify(['Artificial Intelligence: A Modern Approach by Russell & Norvig', 'AI by Elaine Rich & Kevin Knight']), referenceBooks: JSON.stringify(['Artificial Intelligence by Nils Nilsson']) },
    { code: 'CS503PC', name: 'Machine Learning', departmentId: cseDept.id, semesterId: semIII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Supervised Learning, Unsupervised Learning, Regression, Classification, SVM, Decision Trees, Ensemble Methods, Neural Networks, Reinforcement Learning', textbooks: JSON.stringify(['Machine Learning by Tom Mitchell', 'Pattern Recognition and Machine Learning by Christopher Bishop']), referenceBooks: JSON.stringify(['Elements of Statistical Learning by Hastie, Tibshirani & Friedman']) },
    { code: 'CS504PC', name: 'Web Technologies', departmentId: cseDept.id, semesterId: semIII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'HTML5, CSS3, JavaScript, React/Angular, Node.js, Express, REST APIs, MongoDB, Web Security', textbooks: JSON.stringify(['Web Technologies by Uttam K. Roy', 'Learning Web Design by Jennifer Robbins']), referenceBooks: JSON.stringify(['Eloquent JavaScript by Marijn Haverbeke']) },
    { code: 'CS505PC', name: 'Data Warehousing & Mining', departmentId: cseDept.id, semesterId: semIII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Data Warehouse Architecture, OLAP, Data Preprocessing, Association Rules, Classification, Clustering, Web Mining, Text Mining', textbooks: JSON.stringify(['Data Mining: Concepts and Techniques by Jiawei Han', 'Data Warehousing by W.H. Inmon']), referenceBooks: JSON.stringify(['Introduction to Data Mining by Tan, Steinbach & Kumar']) },
    { code: 'CS511PC', name: 'AI & ML Lab', departmentId: cseDept.id, semesterId: semIII1.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },
    { code: 'CS512PC', name: 'Web Technologies Lab', departmentId: cseDept.id, semesterId: semIII1.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },

    // III Year II Sem (CSE)
    { code: 'CS601PC', name: 'Deep Learning', departmentId: cseDept.id, semesterId: semIII2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Neural Network Fundamentals, CNNs, RNNs, LSTMs, GANs, Autoencoders, Transfer Learning, Attention Mechanisms, Transformers', textbooks: JSON.stringify(['Deep Learning by Ian Goodfellow, Yoshua Bengio & Aaron Courville', 'Dive into Deep Learning']), referenceBooks: JSON.stringify(['Neural Networks and Deep Learning by Michael Nielsen']) },
    { code: 'CS602PC', name: 'Natural Language Processing', departmentId: cseDept.id, semesterId: semIII2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Tokenization, POS Tagging, NER, Parsing, Word Embeddings, Seq2Seq, Attention, BERT, GPT, Text Classification, Sentiment Analysis', textbooks: JSON.stringify(['Speech and Language Processing by Jurafsky & Martin', 'NLP with Python by Bird, Klein & Loper']), referenceBooks: JSON.stringify(['Foundations of Statistical NLP by Manning & Schutze']) },
    { code: 'CS603PC', name: 'Cloud Computing', departmentId: cseDept.id, semesterId: semIII2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Cloud Architecture, Virtualization, AWS, Azure, Google Cloud, Containers, Kubernetes, Serverless, Microservices, Cloud Security', textbooks: JSON.stringify(['Cloud Computing by Thomas Erl', 'Cloud Computing: Concepts, Technology & Architecture']), referenceBooks: JSON.stringify(['Architecting the Cloud by Michael Kavis']) },
    { code: 'CS6XXPE', name: 'Professional Elective-I', departmentId: cseDept.id, semesterId: semIII2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'professional_elective', category: 'PE', syllabus: 'Elective course as per student choice from the offered list' },
    { code: 'CS611PC', name: 'Deep Learning Lab', departmentId: cseDept.id, semesterId: semIII2.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },
    { code: 'CS612PC', name: 'Cloud Computing Lab', departmentId: cseDept.id, semesterId: semIII2.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },
    { code: 'CS613PC', name: 'Comprehensive Viva', departmentId: cseDept.id, semesterId: semIII2.id, credits: 2, lectureHours: 0, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC' },
    { code: 'CS604PC', name: 'Management Science', departmentId: cseDept.id, semesterId: semIII2.id, credits: 2, lectureHours: 2, tutorialHours: 0, labHours: 0, type: 'core', category: 'HS', syllabus: 'Management Concepts, Planning, Organizing, Staffing, Directing, Controlling, Marketing Management, Financial Management', textbooks: JSON.stringify(['Management Science by Aryasri']) },

    // IV Year I Sem (CSE)
    { code: 'CS701PC', name: 'Big Data Analytics', departmentId: cseDept.id, semesterId: semIV1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Big Data Concepts, Hadoop Ecosystem, MapReduce, HDFS, Hive, Pig, Spark, NoSQL, Stream Processing, Big Data Visualization', textbooks: JSON.stringify(['Big Data: Principles and Best Practices of Scalable Realtime Data Systems by Holistic', 'Hadoop: The Definitive Guide by Tom White']), referenceBooks: JSON.stringify(['Spark: The Definitive Guide']) },
    { code: 'CS7XXPE1', name: 'Professional Elective-II', departmentId: cseDept.id, semesterId: semIV1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'professional_elective', category: 'PE' },
    { code: 'CS7XXPE2', name: 'Professional Elective-III', departmentId: cseDept.id, semesterId: semIV1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'professional_elective', category: 'PE' },
    { code: 'CS7XXOE', name: 'Open Elective', departmentId: cseDept.id, semesterId: semIV1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'open_elective', category: 'OE' },
    { code: 'CS711PC', name: 'Big Data Lab', departmentId: cseDept.id, semesterId: semIV1.id, credits: 1, lectureHours: 0, tutorialHours: 0, labHours: 3, type: 'lab', category: 'PC' },
    { code: 'CS712PC', name: 'Project Phase-I', departmentId: cseDept.id, semesterId: semIV1.id, credits: 4, lectureHours: 0, tutorialHours: 0, labHours: 12, type: 'project', category: 'PC' },

    // IV Year II Sem (CSE)
    { code: 'CS8XXPE', name: 'Professional Elective-IV', departmentId: cseDept.id, semesterId: semIV2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'professional_elective', category: 'PE' },
    { code: 'CS8XXOE', name: 'Open Elective-II', departmentId: cseDept.id, semesterId: semIV2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'open_elective', category: 'OE' },
    { code: 'CS811PC', name: 'Project Phase-II', departmentId: cseDept.id, semesterId: semIV2.id, credits: 8, lectureHours: 0, tutorialHours: 0, labHours: 24, type: 'project', category: 'PC' },
    { code: 'CS812PC', name: 'Seminar', departmentId: cseDept.id, semesterId: semIV2.id, credits: 2, lectureHours: 0, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC' },

    // ECE Subjects (for ECE department)
    { code: 'EC101BS', name: 'Mathematics-I (ECE)', departmentId: eceDept.id, semesterId: semI1.id, credits: 3, lectureHours: 3, tutorialHours: 1, labHours: 0, type: 'core', category: 'BS', syllabus: 'Matrices, Eigen values, Partial differentiation, Multiple integrals', textbooks: JSON.stringify(['Higher Engineering Mathematics by B.S. Grewal']) },
    { code: 'EC102ES', name: 'Network Analysis', departmentId: eceDept.id, semesterId: semI1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'ES', syllabus: 'Network Theorems, Transient Analysis, Two-Port Networks, Filters', textbooks: JSON.stringify(['Network Analysis by M.E. Van Valkenburg']) },
    { code: 'EC201PC', name: 'Electronic Devices and Circuits', departmentId: eceDept.id, semesterId: semII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'PN Junction, BJT, FET, Amplifiers, Oscillators, Operational Amplifiers', textbooks: JSON.stringify(['Electronic Devices and Circuit Theory by Boylestad & Nashelsky']) },
    { code: 'EC202PC', name: 'Signals and Systems', departmentId: eceDept.id, semesterId: semII1.id, credits: 3, lectureHours: 3, tutorialHours: 1, labHours: 0, type: 'core', category: 'PC', syllabus: 'Continuous and Discrete Signals, Fourier Series, Fourier Transform, Laplace Transform, Z-Transform, Sampling Theorem', textbooks: JSON.stringify(['Signals and Systems by Alan V. Oppenheim']) },
    { code: 'EC301PC', name: 'Analog Communications', departmentId: eceDept.id, semesterId: semIII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Amplitude Modulation, Frequency Modulation, Receivers, Transmitters, Noise, Pulse Modulation', textbooks: JSON.stringify(['Analog and Digital Communications by H. Taub']) },
    { code: 'EC302PC', name: 'Digital Communications', departmentId: eceDept.id, semesterId: semIII1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'PCM, Delta Modulation, Baseband Transmission, Bandpass Modulation, Spread Spectrum, Information Theory', textbooks: JSON.stringify(['Digital Communications by John Proakis']) },
    { code: 'EC303PC', name: 'VLSI Design', departmentId: eceDept.id, semesterId: semIII2.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'MOS Technology, CMOS Logic Design, Circuit Characterization, Subsystem Design, Testing', textbooks: JSON.stringify(['Principles of CMOS VLSI Design by Weste & Harris']) },
    { code: 'EC401PC', name: 'Embedded Systems', departmentId: eceDept.id, semesterId: semIV1.id, credits: 3, lectureHours: 3, tutorialHours: 0, labHours: 0, type: 'core', category: 'PC', syllabus: 'Embedded System Concepts, ARM Architecture, Real-time Operating Systems, Device Drivers, Communication Protocols, IoT', textbooks: JSON.stringify(['Embedded Systems by Raj Kamal']) },
  ];

  const subjects = await Promise.all(
    subjectsData.map(s => db.subject.create({ data: { ...s, isActive: true } }))
  );

  console.log(`   Created ${subjects.length} subjects`);

  // ==========================================
  // 5. USERS (20+ across roles)
  // ==========================================
  console.log('📦 Creating users...');
  const passwordHash = await bcrypt.hash('demo123', 10);
  const usersData = [
    // Super Admin
    { id: 'u1', email: 'vice.chancellor@jntuh.ac.in', name: 'Dr. K. Sreenivasa Raju', employeeId: 'JNTUH001', departmentId: cseDept.id, department: 'Administration', role: 'super_admin' as const, status: 'active', phone: '+91-9876543201' },
    // Admin
    { id: 'u2', email: 'registrar@jntuh.ac.in', name: 'Prof. M. Manzoor Hussain', employeeId: 'JNTUH002', departmentId: cseDept.id, department: 'Administration', role: 'admin' as const, status: 'active', phone: '+91-9876543202' },
    // HODs (one per dept)
    { id: 'u3', email: 'hod.cse@jntuh.ac.in', name: 'Dr. A. Vinaya Babu', employeeId: 'JNTUH003', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'hod' as const, status: 'active', phone: '+91-9876543203' },
    { id: 'u4', email: 'hod.aiml@jntuh.ac.in', name: 'Dr. B. Rama Devi', employeeId: 'JNTUH004', departmentId: aimlDept.id, department: 'CSE (AIML)', role: 'hod' as const, status: 'active', phone: '+91-9876543204' },
    { id: 'u4b', email: 'hod.ds@jntuh.ac.in', name: 'Dr. C. Shoba Bindu', employeeId: 'JNTUH005', departmentId: dsDept.id, department: 'CSE (Data Science)', role: 'hod' as const, status: 'active', phone: '+91-9876543205' },
    { id: 'u4c', email: 'hod.nt@jntuh.ac.in', name: 'Dr. D. Sreenu Naik', employeeId: 'JNTUH006', departmentId: ntDept.id, department: 'CSE (Networks)', role: 'hod' as const, status: 'active', phone: '+91-9876543206' },
    { id: 'u4d', email: 'hod.ece@jntuh.ac.in', name: 'Dr. E. Nagabhooshanam', employeeId: 'JNTUH007', departmentId: eceDept.id, department: 'Electronics & Communication Engineering', role: 'hod' as const, status: 'active', phone: '+91-9876543207' },
    { id: 'u4e', email: 'hod.eee@jntuh.ac.in', name: 'Dr. F. Suresh Babu', employeeId: 'JNTUH008', departmentId: eeeDept.id, department: 'Electrical & Electronics Engineering', role: 'hod' as const, status: 'active', phone: '+91-9876543208' },
    { id: 'u4f', email: 'hod.mech@jntuh.ac.in', name: 'Dr. G. Krishna Mohana Rao', employeeId: 'JNTUH009', departmentId: mechDept.id, department: 'Mechanical Engineering', role: 'hod' as const, status: 'active', phone: '+91-9876543209' },
    { id: 'u4g', email: 'hod.civil@jntuh.ac.in', name: 'Dr. H. Ramesh Kumar', employeeId: 'JNTUH010', departmentId: civilDept.id, department: 'Civil Engineering', role: 'hod' as const, status: 'active', phone: '+91-9876543210' },
    { id: 'u4h', email: 'hod.it@jntuh.ac.in', name: 'Dr. I. Ramesh Reddy', employeeId: 'JNTUH011', departmentId: itDept.id, department: 'Information Technology', role: 'hod' as const, status: 'active', phone: '+91-9876543211' },
    { id: 'u4i', email: 'hod.csam@jntuh.ac.in', name: 'Dr. J. Srinivasa Rao', employeeId: 'JNTUH012', departmentId: csamDept.id, department: 'Computer Science & Applied Mathematics', role: 'hod' as const, status: 'active', phone: '+91-9876543212' },
    // Faculty
    { id: 'u6', email: 'faculty.venkat@jntuh.ac.in', name: 'Prof. Venkat Ramana', employeeId: 'JNTUH013', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'faculty' as const, status: 'active', phone: '+91-9876543213' },
    { id: 'u6b', email: 'faculty.lakshmi@jntuh.ac.in', name: 'Dr. Lakshmi Devi', employeeId: 'JNTUH014', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'faculty' as const, status: 'active', phone: '+91-9876543214' },
    { id: 'u6c', email: 'faculty.srinivas@jntuh.ac.in', name: 'Dr. Srinivas Reddy', employeeId: 'JNTUH015', departmentId: eceDept.id, department: 'Electronics & Communication Engineering', role: 'faculty' as const, status: 'active', phone: '+91-9876543215' },
    { id: 'u6d', email: 'faculty.padma@jntuh.ac.in', name: 'Prof. Padmavathi', employeeId: 'JNTUH016', departmentId: eceDept.id, department: 'Electronics & Communication Engineering', role: 'faculty' as const, status: 'active', phone: '+91-9876543216' },
    // Lab Assistant
    { id: 'u8', email: 'lab.ravi@jntuh.ac.in', name: 'Ravi Teja K.', employeeId: 'JNTUH017', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'lab_assistant' as const, status: 'active', phone: '+91-9876543217' },
    // Students
    { id: 'u10', email: 'student.ravi@jntuh.ac.in', name: 'Arun Kumar', employeeId: 'STU001', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'student' as const, status: 'active', phone: '+91-9876543218', profileImageUrl: '/profiles/student-male-1.png' },
    { id: 'u10b', email: 'student.divya@jntuh.ac.in', name: 'Divya Sri', employeeId: 'STU002', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'student' as const, status: 'active', phone: '+91-9876543219', profileImageUrl: '/profiles/student-female-1.png' },
    { id: 'u10c', email: 'student.sai@jntuh.ac.in', name: 'Sai Prasad', employeeId: 'STU003', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'student' as const, status: 'active', phone: '+91-9876543220' },
    { id: 'u10d', email: 'student.priyanka@jntuh.ac.in', name: 'Priyanka Reddy', employeeId: 'STU004', departmentId: eceDept.id, department: 'Electronics & Communication Engineering', role: 'student' as const, status: 'active', phone: '+91-9876543221' },
    { id: 'u10e', email: 'student.naveen@jntuh.ac.in', name: 'Naveen Kumar', employeeId: 'STU005', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'student' as const, status: 'active', phone: '+91-9876543222' },
    { id: 'u10f', email: 'student.anusha@jntuh.ac.in', name: 'Anusha Devi', employeeId: 'STU006', departmentId: eceDept.id, department: 'Electronics & Communication Engineering', role: 'student' as const, status: 'active', phone: '+91-9876543223' },
    { id: 'u10g', email: 'student.mahesh@jntuh.ac.in', name: 'Mahesh Babu', employeeId: 'STU007', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'student' as const, status: 'active', phone: '+91-9876543224' },
    { id: 'u10h', email: 'student.sireesha@jntuh.ac.in', name: 'Sireesha Kumari', employeeId: 'STU008', departmentId: itDept.id, department: 'Information Technology', role: 'student' as const, status: 'active', phone: '+91-9876543225' },
    { id: 'u10i', email: 'student.irfan@jntuh.ac.in', name: 'Irfan Khan', employeeId: 'STU009', departmentId: cseDept.id, department: 'Computer Science & Engineering', role: 'student' as const, status: 'suspended', phone: '+91-9876543226' },
    // Parent
    { id: 'u18', email: 'parent.rajesh@jntuh.ac.in', name: 'Mr. Rajesh Kumar', department: 'N/A', role: 'parent' as const, status: 'active', phone: '+91-9876543227', linkedStudentId: 'u10' },
    // Visitor
    { id: 'u19', email: 'visitor.john@jntuh.ac.in', name: 'John Smith', department: 'External', role: 'visitor' as const, status: 'active', phone: '+91-9876543228' },
    // Security
    { id: 'u20', email: 'security.murthy@jntuh.ac.in', name: 'Murthy Garu', employeeId: 'SEC001', department: 'Security', role: 'security' as const, status: 'active', phone: '+91-9876543229' },
  ];

  const users = await Promise.all(
    usersData.map(u => db.user.create({ data: { ...u, passwordHash } }))
  );

  const [superAdmin, adminUser, hodCSE, , , , , , , , , , faculty1, faculty2, faculty3, faculty4, labAssist, s1, s2, s3, s4, s5, s6, s7, s8, s9, parentUser, visitorUser, securityUser] = users;
  const students = users.filter(u => u.role === 'student' && u.status === 'active');

  // Set HOD references for all departments
  const hodDeptPairs: Array<[typeof cseDept, string]> = [
    [cseDept, 'hod.cse@jntuh.ac.in'],
    [aimlDept, 'hod.aiml@jntuh.ac.in'],
    [dsDept, 'hod.ds@jntuh.ac.in'],
    [ntDept, 'hod.nt@jntuh.ac.in'],
    [eceDept, 'hod.ece@jntuh.ac.in'],
    [eeeDept, 'hod.eee@jntuh.ac.in'],
    [mechDept, 'hod.mech@jntuh.ac.in'],
    [civilDept, 'hod.civil@jntuh.ac.in'],
    [itDept, 'hod.it@jntuh.ac.in'],
    [csamDept, 'hod.csam@jntuh.ac.in'],
  ];
  for (const [dept, email] of hodDeptPairs) {
    const hod = users.find((u) => u.email === email);
    if (hod) {
      await db.department.update({ where: { id: dept.id }, data: { hodId: hod.id } });
    }
  }

  console.log(`   Created ${users.length} users`);

  // ==========================================
  // 6. PROGRAMS (B.Tech programs)
  // ==========================================
  console.log('📦 Creating programs...');
  const programs = await Promise.all([
    db.program.create({ data: { name: 'B.Tech Computer Science & Engineering', code: 'BT-CSE', departmentId: cseDept.id, duration: 4, type: 'ug', description: 'Bachelor of Technology in Computer Science & Engineering (R22 Regulation)', isActive: true } }),
    db.program.create({ data: { name: 'B.Tech CSE (AI & ML)', code: 'BT-CSEAIML', departmentId: aimlDept.id, duration: 4, type: 'ug', description: 'Bachelor of Technology in CSE with specialization in AI & ML (R22 Regulation)', isActive: true } }),
    db.program.create({ data: { name: 'B.Tech CSE (Data Science)', code: 'BT-CSEDS', departmentId: dsDept.id, duration: 4, type: 'ug', description: 'Bachelor of Technology in CSE with specialization in Data Science (R22 Regulation)', isActive: true } }),
    db.program.create({ data: { name: 'B.Tech Electronics & Communication Engineering', code: 'BT-ECE', departmentId: eceDept.id, duration: 4, type: 'ug', description: 'Bachelor of Technology in Electronics & Communication Engineering (R22 Regulation)', isActive: true } }),
    db.program.create({ data: { name: 'B.Tech Electrical & Electronics Engineering', code: 'BT-EEE', departmentId: eeeDept.id, duration: 4, type: 'ug', description: 'Bachelor of Technology in Electrical & Electronics Engineering (R22 Regulation)', isActive: true } }),
    db.program.create({ data: { name: 'B.Tech Mechanical Engineering', code: 'BT-MECH', departmentId: mechDept.id, duration: 4, type: 'ug', description: 'Bachelor of Technology in Mechanical Engineering (R22 Regulation)', isActive: true } }),
    db.program.create({ data: { name: 'B.Tech Civil Engineering', code: 'BT-CIVIL', departmentId: civilDept.id, duration: 4, type: 'ug', description: 'Bachelor of Technology in Civil Engineering (R22 Regulation)', isActive: true } }),
    db.program.create({ data: { name: 'B.Tech Information Technology', code: 'BT-IT', departmentId: itDept.id, duration: 4, type: 'ug', description: 'Bachelor of Technology in Information Technology (R22 Regulation)', isActive: true } }),
  ]);

  const [btCSE] = programs;

  // ==========================================
  // 7. COURSES (from subjects, linked to B.Tech CSE program)
  // ==========================================
  console.log('📦 Creating courses...');
  const cseSubjects = subjects.filter(s => s.departmentId === cseDept.id);
  const courseData = cseSubjects.map((subject, idx) => {
    // Map subject semester to course semester
    const semMap: Record<string, number> = {
      'I-I': 1, 'I-II': 2, 'II-I': 3, 'II-II': 4,
      'III-I': 5, 'III-II': 6, 'IV-I': 7, 'IV-II': 8,
    };
    let semNum = 1;
    if (subject.semesterId) {
      const sem = semesters.find(s => s.id === subject.semesterId);
      if (sem) semNum = semMap[sem.code] || 1;
    }
    // Assign instructor for some courses
    const instructorId = idx % 3 === 0 ? faculty1.id : idx % 3 === 1 ? faculty2.id : faculty1.id;

    return {
      programId: btCSE.id,
      subjectId: subject.id,
      code: subject.code,
      name: subject.name,
      credits: subject.credits,
      semester: semNum,
      type: subject.type,
      description: `${subject.name} - ${subject.category || 'PC'} course as per JNTUH R22 Regulation`,
      instructorId: subject.type === 'project' || subject.type === 'audit' ? undefined : instructorId,
      syllabus: subject.syllabus,
      isActive: true,
    };
  });

  // Also create ECE courses
  const eceSubjects = subjects.filter(s => s.departmentId === eceDept.id);
  const eceProgram = programs[3]; // BT-ECE
  const eceCourseData = eceSubjects.map((subject) => {
    const semMap: Record<string, number> = {
      'I-I': 1, 'I-II': 2, 'II-I': 3, 'II-II': 4,
      'III-I': 5, 'III-II': 6, 'IV-I': 7, 'IV-II': 8,
    };
    let semNum = 1;
    if (subject.semesterId) {
      const sem = semesters.find(s => s.id === subject.semesterId);
      if (sem) semNum = semMap[sem.code] || 1;
    }
    return {
      programId: eceProgram.id,
      subjectId: subject.id,
      code: subject.code,
      name: subject.name,
      credits: subject.credits,
      semester: semNum,
      type: subject.type,
      description: `${subject.name} - ${subject.category || 'PC'} course as per JNTUH R22 Regulation`,
      instructorId: faculty3.id,
      syllabus: subject.syllabus,
      isActive: true,
    };
  });

  const allCourseData = [...courseData, ...eceCourseData];
  const courses = await Promise.all(
    allCourseData.map(c => db.course.create({ data: c }))
  );

  console.log(`   Created ${courses.length} courses`);

  // ==========================================
  // 8. GEOFENCES (4 campus zones)
  // ==========================================
  console.log('📦 Creating geofences...');
  const geofences = await Promise.all([
    db.geofence.create({ data: { name: 'CSE Block Zone', type: 'circle', centerLat: 17.4497, centerLng: 78.6674, radiusMtrs: 200, building: 'CSE Block', floor: 'All', isActive: true } }),
    db.geofence.create({ data: { name: 'ECE Block Zone', type: 'circle', centerLat: 17.4505, centerLng: 78.6685, radiusMtrs: 180, building: 'ECE Block', floor: 'All', isActive: true } }),
    db.geofence.create({ data: { name: 'Central Library Zone', type: 'circle', centerLat: 17.4485, centerLng: 78.6690, radiusMtrs: 120, building: 'Central Library', isActive: true } }),
    db.geofence.create({ data: { name: 'Main Auditorium Zone', type: 'polygon', polygonData: JSON.stringify([{ lat: 17.4490, lng: 78.6655 }, { lat: 17.4490, lng: 78.6675 }, { lat: 17.4508, lng: 78.6675 }, { lat: 17.4508, lng: 78.6655 }]), building: 'Main Auditorium', isActive: true } }),
  ]);

  // ==========================================
  // 9. COURSE ENROLLMENTS
  // ==========================================
  console.log('📦 Creating course enrollments...');
  const cseStudentIds = students.filter(s => s.departmentId === cseDept.id || s.department === 'Computer Science & Engineering').map(s => s.id);
  const eceStudentIds = students.filter(s => s.departmentId === eceDept.id || s.department === 'Electronics & Communication Engineering').map(s => s.id);
  const itStudentIds = students.filter(s => s.departmentId === itDept.id || s.department === 'Information Technology').map(s => s.id);

  // CSE courses (first batch)
  const cseCourses = courses.filter(c => c.programId === btCSE.id);
  const eceCourses = courses.filter(c => c.programId === eceProgram.id);

  const enrollmentData: { courseId: string; studentId: string; status: string }[] = [];
  // CSE students enroll in CSE courses (first 10 courses for semester I-I and II-I)
  const cseCourseSubset = cseCourses.slice(0, 10);
  for (const studentId of cseStudentIds) {
    for (const course of cseCourseSubset) {
      enrollmentData.push({ courseId: course.id, studentId, status: 'enrolled' });
    }
  }
  // ECE students enroll in ECE courses
  for (const studentId of eceStudentIds) {
    for (const course of eceCourses) {
      enrollmentData.push({ courseId: course.id, studentId, status: 'enrolled' });
    }
  }
  // IT students also enroll in some CSE courses
  for (const studentId of itStudentIds) {
    for (const course of cseCourseSubset.slice(0, 5)) {
      enrollmentData.push({ courseId: course.id, studentId, status: 'enrolled' });
    }
  }

  // Coding practice problems are on CS201ES — must be outside the first-10 slice
  const codingCourse = courses.find((c) => c.code === 'CS201ES');
  if (codingCourse) {
    for (const studentId of cseStudentIds) {
      const exists = enrollmentData.some(
        (e) => e.courseId === codingCourse.id && e.studentId === studentId
      );
      if (!exists) {
        enrollmentData.push({ courseId: codingCourse.id, studentId, status: 'enrolled' });
      }
    }
  }

  await db.courseEnrollment.createMany({ data: enrollmentData });

  // ==========================================
  // 10. MODULES & LESSONS
  // ==========================================
  console.log('📦 Creating modules and lessons...');
  const modulesData: { courseId: string; title: string; description: string; orderIndex: number; isPublished: boolean }[] = [];
  // Create modules for first few courses
  const courseSubsetForModules = courses.slice(0, 8);
  for (const course of courseSubsetForModules) {
    modulesData.push(
      { courseId: course.id, title: `Unit 1: Introduction to ${course.name}`, description: `Introduction and fundamentals of ${course.name}`, orderIndex: 0, isPublished: true },
      { courseId: course.id, title: `Unit 2: Core Concepts`, description: `Core concepts and principles of ${course.name}`, orderIndex: 1, isPublished: true },
      { courseId: course.id, title: `Unit 3: Advanced Topics`, description: `Advanced topics in ${course.name}`, orderIndex: 2, isPublished: true },
      { courseId: course.id, title: `Unit 4: Applications & Practice`, description: `Applications and practice problems for ${course.name}`, orderIndex: 3, isPublished: false },
    );
  }

  const modules = await Promise.all(
    modulesData.map(m => db.module.create({ data: m }))
  );

  const lessonsData: { moduleId: string; title: string; type: string; contentBody: string; orderIndex: number; duration: number; isPublished: boolean }[] = [];
  for (const mod of modules) {
    lessonsData.push(
      { moduleId: mod.id, title: `Introduction`, type: 'video', contentBody: `Video lecture on ${mod.title}`, orderIndex: 0, duration: 45, isPublished: true },
      { moduleId: mod.id, title: `Detailed Explanation`, type: 'video', contentBody: `Detailed explanation of ${mod.title}`, orderIndex: 1, duration: 60, isPublished: true },
      { moduleId: mod.id, title: `Practice Problems`, type: 'document', contentBody: `Practice problems for ${mod.title}`, orderIndex: 2, duration: 30, isPublished: true },
      { moduleId: mod.id, title: `Quiz`, type: 'quiz', contentBody: `Assessment quiz for ${mod.title}`, orderIndex: 3, duration: 20, isPublished: true },
    );
  }
  await db.lesson.createMany({ data: lessonsData });

  // ==========================================
  // 11. TIMETABLE SLOTS
  // ==========================================
  console.log('📦 Creating timetable slots...');
  const timetableSlots = await Promise.all([
    db.timetableSlot.create({ data: { courseId: courses[0].id, semesterId: semI1.id, dayOfWeek: 1, startTime: '09:00', endTime: '09:50', roomNumber: 'CSE-301', building: 'CSE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[1].id, semesterId: semI1.id, dayOfWeek: 1, startTime: '10:00', endTime: '10:50', roomNumber: 'CSE-302', building: 'CSE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[2].id, semesterId: semI1.id, dayOfWeek: 1, startTime: '11:00', endTime: '11:50', roomNumber: 'CSE-303', building: 'CSE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[3].id, semesterId: semI1.id, dayOfWeek: 2, startTime: '09:00', endTime: '09:50', roomNumber: 'CSE-304', building: 'CSE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[4].id, semesterId: semI1.id, dayOfWeek: 2, startTime: '10:00', endTime: '10:50', roomNumber: 'CSE-305', building: 'CSE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[5].id, semesterId: semI1.id, dayOfWeek: 2, startTime: '14:00', endTime: '16:50', roomNumber: 'PHY-LAB', building: 'Physics Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[6].id, semesterId: semI1.id, dayOfWeek: 3, startTime: '14:00', endTime: '16:50', roomNumber: 'CSE-LAB1', building: 'CSE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[10].id, semesterId: semII1.id, dayOfWeek: 3, startTime: '09:00', endTime: '09:50', roomNumber: 'CSE-401', building: 'CSE Block', semester: 'II-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[11].id, semesterId: semII1.id, dayOfWeek: 3, startTime: '10:00', endTime: '10:50', roomNumber: 'CSE-402', building: 'CSE Block', semester: 'II-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[12].id, semesterId: semII1.id, dayOfWeek: 4, startTime: '09:00', endTime: '09:50', roomNumber: 'CSE-403', building: 'CSE Block', semester: 'II-I', academicYear: '2025-2026', isActive: true } }),
    // ECE timetable
    db.timetableSlot.create({ data: { courseId: eceCourses[0]?.id || courses[0].id, semesterId: semI1.id, dayOfWeek: 1, startTime: '14:00', endTime: '14:50', roomNumber: 'ECE-201', building: 'ECE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: eceCourses[1]?.id || courses[0].id, semesterId: semI1.id, dayOfWeek: 2, startTime: '14:00', endTime: '14:50', roomNumber: 'ECE-202', building: 'ECE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    // Weekend demo slots (Saturday) — Prof. Venkat's courses for same-day timetable testing
    db.timetableSlot.create({ data: { courseId: courses[0].id, semesterId: semI1.id, dayOfWeek: 6, startTime: '09:00', endTime: '09:50', roomNumber: 'CSE-301', building: 'CSE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
    db.timetableSlot.create({ data: { courseId: courses[2].id, semesterId: semI1.id, dayOfWeek: 6, startTime: '11:00', endTime: '11:50', roomNumber: 'CSE-303', building: 'CSE Block', semester: 'I-I', academicYear: '2025-2026', isActive: true } }),
  ]);

  // ==========================================
  // 12. ATTENDANCE SESSIONS & RECORDS
  // ==========================================
  console.log('📦 Creating attendance sessions...');
  const today = new Date();
  const todayStr = localDateStr(today);
  const dates: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(localDateStr(d));
  }

  const sessions: Awaited<ReturnType<typeof db.attendanceSession.create>>[] = [];
  const captureMethods = ['manual', 'face', 'gps', 'qrcode', 'biometric'];

  for (let i = 0; i < Math.min(dates.length, 10); i++) {
    const dateStr = dates[i];
    const dayMatches = timetableSlots.filter(s => s.dayOfWeek === utcDayOfWeek(dateStr));
    const slot = dayMatches[i % Math.max(dayMatches.length, 1)] ?? null;
    const method = captureMethods[i % captureMethods.length];
    const expectedCount = 6 + Math.floor(Math.random() * 5);
    const presentCount = Math.floor(expectedCount * (0.65 + Math.random() * 0.3));
    const lateCount = Math.floor(Math.random() * 3);
    const absentCount = Math.max(0, expectedCount - presentCount - lateCount);

    const session = await db.attendanceSession.create({
      data: {
        timetableSlotId: slot?.id ?? null,
        courseId: slot?.courseId ?? courses[i % courses.length].id,
        createdBy: faculty1.id,
        geofenceId: geofences[0].id,
        sessionDate: dateStr,
        startTime: slot?.startTime ?? '09:00',
        endTime: slot?.endTime ?? '09:50',
        status: 'completed',
        captureMethod: method,
        expectedCount,
        presentCount: Math.max(0, presentCount),
        absentCount,
        lateCount,
      }
    });
    sessions.push(session);

    // Create attendance records
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
          markedAt: status !== 'absent' ? new Date(`${dateStr}T${(slot?.startTime ?? '09:00')}:00`) : null,
          captureMethod: method,
          confidence: method === 'face' ? 0.85 + Math.random() * 0.13 : null,
          gpsLat: method === 'gps' ? 17.4497 + (Math.random() - 0.5) * 0.002 : null,
          gpsLng: method === 'gps' ? 78.6674 + (Math.random() - 0.5) * 0.002 : null,
        }
      });
    }
  }

  // Live sessions — one active session per timetable slot + date (matches production DB constraint)
  const activeSlotKeys = new Set<string>();
  const liveSlot = pickSlotForDate(timetableSlots, todayStr, courses[0].id);
  const liveSession = await createActiveSession(activeSlotKeys, {
    timetableSlotId: liveSlot?.id ?? null,
    courseId: liveSlot?.courseId ?? courses[0].id,
    createdBy: faculty1.id,
    geofenceId: geofences[0].id,
    sessionDate: todayStr,
    startTime: liveSlot?.startTime ?? '09:00',
    endTime: liveSlot?.endTime ?? '09:50',
    status: 'active',
    captureMethod: 'face',
    expectedCount: 7,
    presentCount: 5,
    absentCount: 1,
    lateCount: 1,
  });

  const selfSlot1 = pickSlotForDate(timetableSlots, todayStr, courses[1]?.id);
  const selfMarkSession1 = await createActiveSession(activeSlotKeys, {
    timetableSlotId: selfSlot1?.id ?? null,
    courseId: selfSlot1?.courseId ?? courses[1 % courses.length].id,
    createdBy: faculty1.id,
    geofenceId: geofences[0].id,
    sessionDate: todayStr,
    startTime: selfSlot1?.startTime ?? '10:00',
    endTime: selfSlot1?.endTime ?? '10:50',
    status: 'active',
    captureMethod: 'self_geo_face',
    expectedCount: 8,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
  });

  const selfSlot2 = pickSlotForDate(timetableSlots, todayStr, courses[2]?.id);
  const selfMarkSession2 = await createActiveSession(activeSlotKeys, {
    timetableSlotId: selfSlot2?.id ?? null,
    courseId: selfSlot2?.courseId ?? courses[2 % courses.length].id,
    createdBy: faculty2.id,
    geofenceId: geofences[1 % geofences.length]?.id,
    sessionDate: todayStr,
    startTime: selfSlot2?.startTime ?? '11:00',
    endTime: selfSlot2?.endTime ?? '11:50',
    status: 'active',
    captureMethod: 'self_geo_face',
    expectedCount: 6,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
  });

  // Mark u10 (Arun Kumar) as present in liveSession with geo+face data
  await db.attendanceRecord.create({
    data: {
      sessionId: liveSession.id,
      studentId: s1.id,
      status: 'present',
      markedAt: new Date(),
      captureMethod: 'self_geo_face',
      gpsLat: 17.4497,
      gpsLng: 78.6674,
      faceVerified: true,
      geofenceValidated: true,
      distanceFromCenter: 25.5,
      confidence: 0.92,
    }
  });

  // Sync session counts from actual attendance records
  const allSessions = [...sessions, liveSession, selfMarkSession1, selfMarkSession2];
  for (const sess of allSessions) {
    const records = await db.attendanceRecord.findMany({
      where: { sessionId: sess.id },
      select: { status: true },
    });
    const presentCount = records.filter((r) => r.status === 'present').length;
    const lateCount = records.filter((r) => r.status === 'late').length;
    const absentCount = records.filter((r) => r.status === 'absent').length;
    await db.attendanceSession.update({
      where: { id: sess.id },
      data: {
        presentCount,
        lateCount,
        absentCount,
        expectedCount: Math.max(sess.expectedCount, records.length),
      },
    });
  }

  // ==========================================
  // 13. ASSIGNMENTS & SUBMISSIONS
  // ==========================================
  console.log('📦 Creating assignments...');
  const assignments = await Promise.all([
    db.assignment.create({ data: { courseId: courses[0].id, title: 'Matrices and Eigen Values Problem Set', description: 'Solve problems on matrices, eigen values and eigen vectors from Chapter 1', type: 'individual', maxScore: 100, dueDate: new Date(today.getTime() + 7 * 86400000), allowLate: true, latePenalty: 10, status: 'published' } }),
    db.assignment.create({ data: { courseId: courses[2].id, title: 'C Programming Lab Exercises', description: 'Write C programs for arrays, strings, and functions as discussed in class', type: 'individual', maxScore: 50, dueDate: new Date(today.getTime() + 14 * 86400000), allowLate: true, latePenalty: 15, status: 'published' } }),
    db.assignment.create({ data: { courseId: courses[10].id, title: 'Mathematical Foundations Assignment', description: 'Solve problems on probability and information theory', type: 'individual', maxScore: 100, dueDate: new Date(today.getTime() + 10 * 86400000), allowLate: true, latePenalty: 10, status: 'published' } }),
    db.assignment.create({ data: { courseId: courses[11].id, title: 'Computer Organization Assignment', description: 'Design a simple CPU datapath and control unit', type: 'individual', maxScore: 100, dueDate: new Date(today.getTime() - 3 * 86400000), allowLate: false, status: 'grading' } }),
    db.assignment.create({ data: { courseId: courses[12].id, title: 'OS Scheduling Simulation', description: 'Implement FCFS, SJF, Round Robin scheduling algorithms', type: 'individual', maxScore: 75, dueDate: new Date(today.getTime() + 5 * 86400000), allowLate: true, latePenalty: 20, status: 'published' } }),
    db.assignment.create({ data: { courseId: courses[13].id, title: 'SQL Query Optimization', description: 'Optimize given SQL queries and explain the improvement strategies', type: 'individual', maxScore: 50, dueDate: new Date(today.getTime() - 7 * 86400000), allowLate: false, status: 'closed' } }),
  ]);

  // Submissions for past assignments
  for (const student of students.slice(0, 5)) {
    await db.submission.create({
      data: {
        assignmentId: assignments[3].id,
        studentId: student.id,
        content: 'CPU datapath design with control signals',
        score: 65 + Math.floor(Math.random() * 35),
        feedback: 'Good design. Consider pipelining for better throughput.',
        status: 'graded',
        gradedAt: new Date(),
      }
    });
    await db.submission.create({
      data: {
        assignmentId: assignments[5].id,
        studentId: student.id,
        content: 'SQL optimization solutions submitted',
        score: 35 + Math.floor(Math.random() * 15),
        feedback: 'Correct approach on queries 1-3. Review query 4.',
        status: 'graded',
        gradedAt: new Date(),
      }
    });
  }

  // ==========================================
  // 14. QUIZ QUESTIONS & ATTEMPTS
  // ==========================================
  console.log('📦 Creating quiz questions...');
  const quizQuestions = await Promise.all([
    db.quizQuestion.create({ data: { courseId: courses[2].id, question: 'Which header file is required for printf() in C?', type: 'mcq', options: JSON.stringify(['<stdio.h>', '<conio.h>', '<math.h>', '<string.h>']), correctAnswer: '<stdio.h>', points: 2, difficulty: 'easy' } }),
    db.quizQuestion.create({ data: { courseId: courses[2].id, question: 'An array index in C starts from 0.', type: 'true_false', options: JSON.stringify(['True', 'False']), correctAnswer: 'True', points: 1, difficulty: 'easy' } }),
    db.quizQuestion.create({ data: { courseId: courses[10].id, question: 'What is the time complexity of binary search?', type: 'mcq', options: JSON.stringify(['O(n)', 'O(log n)', 'O(n log n)', 'O(1)']), correctAnswer: 'O(log n)', points: 2, difficulty: 'medium' } }),
    db.quizQuestion.create({ data: { courseId: courses[10].id, question: 'Bayes theorem is used for computing conditional probabilities.', type: 'true_false', options: JSON.stringify(['True', 'False']), correctAnswer: 'True', points: 1, difficulty: 'easy' } }),
    db.quizQuestion.create({ data: { courseId: courses[12].id, question: 'Which scheduling algorithm may cause starvation?', type: 'mcq', options: JSON.stringify(['FCFS', 'SJF', 'Round Robin', 'All of the above']), correctAnswer: 'SJF', points: 2, difficulty: 'medium' } }),
    db.quizQuestion.create({ data: { courseId: courses[12].id, question: 'A deadlock requires four conditions to hold simultaneously.', type: 'true_false', options: JSON.stringify(['True', 'False']), correctAnswer: 'True', points: 1, difficulty: 'easy' } }),
    db.quizQuestion.create({ data: { courseId: courses[13].id, question: 'Which normal form eliminates transitive dependencies?', type: 'mcq', options: JSON.stringify(['1NF', '2NF', '3NF', 'BCNF']), correctAnswer: '3NF', points: 2, difficulty: 'medium' } }),
    db.quizQuestion.create({ data: { courseId: courses[14].id, question: 'Java supports multiple inheritance through classes.', type: 'true_false', options: JSON.stringify(['True', 'False']), correctAnswer: 'False', points: 1, difficulty: 'easy' } }),
  ]);

  // LeetCode-style coding problems
  console.log('📦 Creating coding problems...');
  const { BUNDLED_CODING_PROBLEMS } = await import('../src/data/leetcode-problems');
  for (const prob of BUNDLED_CODING_PROBLEMS) {
    const course = courses.find((c) => c.code === prob.courseCode);
    if (!course) continue;
    await db.quizQuestion.create({
      data: {
        courseId: course.id,
        question: prob.statement,
        type: 'coding',
        options: JSON.stringify(prob.meta),
        correctAnswer: null,
        points: prob.points,
        difficulty: prob.difficulty,
        explanation: `Reference: hash-map / stack / Kadane / DFS approaches for ${prob.meta.title}`,
      },
    });
  }

  // Quiz attempts
  for (const student of students.slice(0, 5)) {
    const csQs = quizQuestions.filter(q => q.courseId === courses[2].id);
    const score = 1 + Math.floor(Math.random() * 2);
    await db.quizAttempt.create({
      data: {
        studentId: student.id,
        courseId: courses[2].id,
        questions: JSON.stringify(csQs.map(q => q.id)),
        answers: JSON.stringify({ [csQs[0]?.id || '']: '<stdio.h>', [csQs[1]?.id || '']: 'True' }),
        score,
        totalPoints: 3,
        percentage: (score / 3) * 100,
        timeTaken: 180 + Math.floor(Math.random() * 300),
        status: 'completed',
        completedAt: new Date(),
      }
    });
  }

  // ==========================================
  // 15. GRADE BOOK
  // ==========================================
  console.log('📦 Creating grade book entries...');
  const gradeComponents = ['assignment', 'quiz', 'midterm', 'final', 'participation'];
  for (const student of students.slice(0, 6)) {
    for (const course of courses.slice(0, 5)) {
      for (const component of gradeComponents) {
        await db.gradeBook.create({
          data: {
            courseId: course.id,
            studentId: student.id,
            component,
            score: component === 'participation' ? 7 + Math.random() * 3 : 45 + Math.random() * 50,
            maxScore: component === 'participation' ? 10 : 100,
            weightage: component === 'assignment' ? 25 : component === 'quiz' ? 15 : component === 'midterm' ? 20 : component === 'final' ? 30 : 10,
            gradedBy: faculty1.id,
          }
        });
      }
    }
  }

  // ==========================================
  // 16. VIOLATIONS
  // ==========================================
  console.log('📦 Creating violations...');
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
        reviewedBy: i >= 4 ? hodCSE.id : undefined,
        reviewNotes: i >= 4 ? (i < 6 ? 'Violation confirmed after review' : 'False positive - student was present') : undefined,
      }
    });
  }

  // ==========================================
  // 17. CALENDAR EVENTS (Academic Calendar)
  // ==========================================
  console.log('📦 Creating calendar events...');
  await db.calendarEvent.createMany({
    data: CALENDAR_SEED_EVENTS.map((event) => ({
      userId: superAdmin.id,
      academicYearId: academicYear.id,
      title: event.title,
      description: event.description ?? null,
      type: event.type,
      startDate: event.startDate,
      endDate: event.endDate ?? null,
      startTime: event.startTime ?? null,
      endTime: event.endTime ?? null,
      location: event.location ?? null,
      color: event.color ?? null,
      isAllDay: !event.startTime,
    })),
  });

  // ==========================================
  // 18. NOTIFICATIONS
  // ==========================================
  console.log('📦 Creating notifications...');
  await db.notification.createMany({
    data: [
      { userId: hodCSE.id, title: 'Attendance Alert', message: 'Low attendance detected for MA101BS Mathematics-I (67% average)', type: 'warning', channel: 'in_app', isRead: false },
      { userId: faculty1.id, title: 'Session Completed', message: 'Attendance session for CS101ES has been completed. 8/10 present.', type: 'success', channel: 'in_app', isRead: true },
      { userId: adminUser.id, title: 'Violation Reported', message: '3 new attendance violations require your review', type: 'warning', channel: 'in_app', isRead: false },
      { userId: s1.id, title: 'Assignment Due', message: 'C Programming Lab Exercises due in 14 days', type: 'info', channel: 'in_app', isRead: false },
      { userId: s2.id, title: 'Grade Published', message: 'Your Computer Organization assignment has been graded: 87/100', type: 'success', channel: 'in_app', isRead: false },
      { userId: faculty1.id, title: 'New Enrollment', message: '2 new students enrolled in Programming for Problem Solving', type: 'info', channel: 'in_app', isRead: true },
      { userId: adminUser.id, title: 'System Update', message: 'Face recognition model updated to ArcFace v3.0', type: 'info', channel: 'in_app', isRead: false },
      { userId: s3.id, title: 'Low Attendance Warning', message: 'Your attendance in CS201ES Data Structures is below 75%. Please improve attendance.', type: 'warning', channel: 'in_app', isRead: false },
      { userId: superAdmin.id, title: 'Academic Calendar Published', message: 'Academic Calendar for AY 2025-2026 has been published under R22 regulation', type: 'info', channel: 'in_app', isRead: true },
      { userId: parentUser.id, title: 'Attendance Update', message: 'Your ward Arun Kumar has 82% attendance this month', type: 'info', channel: 'in_app', isRead: false },
      { userId: securityUser.id, title: 'Security Alert', message: 'Unauthorized entry attempt detected at ECE Block entrance', type: 'warning', channel: 'in_app', isRead: false },
    ]
  });

  // ==========================================
  // 19. AUDIT LOGS
  // ==========================================
  console.log('📦 Creating audit logs...');
  await db.auditLog.createMany({
    data: [
      { userId: superAdmin.id, action: 'CREATE', resource: 'academic_year', details: 'Created Academic Year 2025-2026 with R22 regulation', ipAddress: '192.168.1.100' },
      { userId: adminUser.id, action: 'CREATE', resource: 'department', details: 'Created 10 departments for JNTUH Engineering College', ipAddress: '192.168.1.100' },
      { userId: adminUser.id, action: 'CREATE', resource: 'semester', details: 'Created 8 semesters for AY 2025-2026', ipAddress: '192.168.1.100' },
      { userId: adminUser.id, action: 'CREATE', resource: 'subject', details: 'Created subjects as per JNTU R22 Regulation CSE pattern', ipAddress: '192.168.1.100' },
      { userId: hodCSE.id, action: 'CREATE', resource: 'program', details: 'Created B.Tech CSE program under R22 Regulation', ipAddress: '192.168.1.102' },
      { userId: faculty1.id, action: 'CREATE', resource: 'attendance_session', details: 'Created attendance session for CS101ES', ipAddress: '192.168.1.101' },
      { userId: hodCSE.id, action: 'REVIEW', resource: 'violation', details: 'Reviewed violation: confirmed proxy attempt', ipAddress: '192.168.1.102' },
      { userId: adminUser.id, action: 'UPDATE', resource: 'user', details: 'Updated role for Dr. Lakshmi Devi to faculty', ipAddress: '192.168.1.100' },
      { userId: superAdmin.id, action: 'CONFIG', resource: 'system', details: 'Updated face recognition threshold to 0.92', ipAddress: '192.168.1.100' },
      { userId: adminUser.id, action: 'CREATE', resource: 'calendar_event', details: 'Published academic calendar events for AY 2025-2026', ipAddress: '192.168.1.100' },
    ]
  });

  // ==========================================
  // STATS SUMMARY
  // ==========================================
  const deptCount = await db.department.count();
  const userCount = await db.user.count();
  const subjectCount = await db.subject.count();
  const semesterCount = await db.semester.count();
  const courseCount = await db.course.count();
  const sessionCount = await db.attendanceSession.count();
  const recordCount = await db.attendanceRecord.count();
  const violationCount = await db.attendanceViolation.count();
  const eventCount = await db.calendarEvent.count();
  const programCount = await db.program.count();

  console.log('📦 Seeding RBAC configuration...');
  await db.rbacConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', matrix: DEFAULT_ROLE_SECTIONS },
    update: { matrix: DEFAULT_ROLE_SECTIONS },
  });

  console.log('✅ JNTUH SCMS Seed completed successfully!');
  console.log(`   Departments: ${deptCount}`);
  console.log(`   Academic Years: 1`);
  console.log(`   Semesters: ${semesterCount}`);
  console.log(`   Subjects: ${subjectCount}`);
  console.log(`   Users: ${userCount}`);
  console.log(`   Programs: ${programCount}`);
  console.log(`   Courses: ${courseCount}`);
  console.log(`   Attendance Sessions: ${sessionCount}`);
  console.log(`   Attendance Records: ${recordCount}`);
  console.log(`   Violations: ${violationCount}`);
  console.log(`   Calendar Events: ${eventCount}`);

  await db.systemConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', settings: cloneDefaultSystemConfig() },
    update: {},
  });
  console.log('   System config: defaults ensured');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
