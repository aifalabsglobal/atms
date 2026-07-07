// AIMSCS Academic Calendar Seed Script
// Populates the calendar with comprehensive R22 regulation events for AY 2025-2026

const BASE_URL = 'http://localhost:3000/api/calendar';

const SUPER_ADMIN_ID = 'cmq9bwgg0004frjls0z8h8k3h';
const AY_ID = 'cmq9bwgem000arjlsosd28l0t'; // 2025-2026 R22

// Color scheme for event types
const COLORS: Record<string, string> = {
  academic: '#22c55e',
  exam: '#ef4444',
  holiday: '#f59e0b',
  event: '#8b5cf6',
  deadline: '#ec4899',
  personal: '#6366f1',
  class: '#06b6d4',
};

interface CalendarEvent {
  userId: string;
  title: string;
  description?: string;
  type: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  color?: string;
  isAllDay?: boolean;
  academicYearId?: string;
}

const events: Omit<CalendarEvent, 'userId' | 'academicYearId'>[] = [
  // ═══════════════════════════════════════════════════════
  // JULY 2025 — Semester Start
  // ═══════════════════════════════════════════════════════
  { title: 'I Year I Semester Begins', type: 'academic', startDate: '2025-07-01', description: 'First year first semester classes commence for B.Tech R22 batch', location: 'All Departments', color: COLORS.academic, startTime: '09:00', endTime: '16:30' },
  { title: 'II Year I Semester Begins', type: 'academic', startDate: '2025-07-01', description: 'Second year first semester classes commence', location: 'All Departments', color: COLORS.academic, startTime: '09:00', endTime: '16:30' },
  { title: 'III Year I Semester Begins', type: 'academic', startDate: '2025-07-01', description: 'Third year first semester classes commence', location: 'All Departments', color: COLORS.academic, startTime: '09:00', endTime: '16:30' },
  { title: 'IV Year I Semester Begins', type: 'academic', startDate: '2025-07-01', description: 'Final year first semester classes commence', location: 'All Departments', color: COLORS.academic, startTime: '09:00', endTime: '16:30' },
  { title: 'New Student Orientation', type: 'event', startDate: '2025-07-02', endDate: '2025-07-04', description: '3-day orientation program for newly admitted B.Tech students', location: 'AIMSCS Auditorium', color: COLORS.event, startTime: '09:00', endTime: '17:00' },
  { title: 'Course Registration Deadline — I Year', type: 'deadline', startDate: '2025-07-07', description: 'Last date for first year students to register for courses', location: 'Online Portal', color: COLORS.deadline },
  { title: 'Add/Drop Period Ends', type: 'deadline', startDate: '2025-07-14', description: 'Last date to add or drop courses without penalty', color: COLORS.deadline },
  { title: 'Bakrid (Eid al-Adha)', type: 'holiday', startDate: '2025-07-07', description: 'Public holiday — Bakrid', color: COLORS.holiday },
  { title: 'NSS Special Camp', type: 'event', startDate: '2025-07-21', endDate: '2025-07-27', description: 'Annual NSS special camp — 7 days at adopted village', location: 'Adopted Village', color: COLORS.event },

  // ═══════════════════════════════════════════════════════
  // AUGUST 2025
  // ═══════════════════════════════════════════════════════
  { title: 'Faculty Development Program', type: 'academic', startDate: '2025-08-04', endDate: '2025-08-09', description: 'One-week FDP on "Emerging Trends in Engineering Education"', location: 'CSE Seminar Hall', color: COLORS.academic, startTime: '10:00', endTime: '16:00' },
  { title: 'Independence Day', type: 'holiday', startDate: '2025-08-15', description: '78th Independence Day celebrations — Flag hoisting at 8:00 AM', location: 'Main Ground', color: COLORS.holiday, startTime: '08:00', endTime: '10:00' },
  { title: 'Raksha Bandhan', type: 'holiday', startDate: '2025-08-09', description: 'Optional holiday', color: COLORS.holiday },
  { title: 'Janmashtami', type: 'holiday', startDate: '2025-08-16', description: 'Janmashtami — Optional holiday', color: COLORS.holiday },
  { title: 'Ganesh Chaturthi', type: 'holiday', startDate: '2025-08-27', description: 'Ganesh Chaturthi — College holiday', color: COLORS.holiday },
  { title: 'Research Paper Review Meeting', type: 'academic', startDate: '2025-08-20', description: 'Internal review of research papers before external submission', location: 'Conference Room', color: COLORS.academic, startTime: '14:00', endTime: '17:00' },
  { title: 'Assignment Submission Deadline — I Year', type: 'deadline', startDate: '2025-08-30', description: 'First assignment submission for all I Year I Sem subjects', color: COLORS.deadline },
  { title: 'Blood Donation Camp', type: 'event', startDate: '2025-08-21', description: 'Annual blood donation camp in association with Red Cross', location: 'Health Center', color: COLORS.event, startTime: '09:00', endTime: '14:00' },

  // ═══════════════════════════════════════════════════════
  // SEPTEMBER 2025 — Mid-Semester Exams
  // ═══════════════════════════════════════════════════════
  { title: 'I Year I Sem Mid-I Examinations', type: 'exam', startDate: '2025-09-08', endDate: '2025-09-15', description: 'First mid-semester examinations for I Year I Semester (R22)', location: 'Examination Hall', color: COLORS.exam, startTime: '10:00', endTime: '12:00' },
  { title: 'II Year I Sem Mid-I Examinations', type: 'exam', startDate: '2025-09-08', endDate: '2025-09-15', description: 'First mid-semester examinations for II Year I Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '14:00', endTime: '16:00' },
  { title: 'III Year I Sem Mid-I Examinations', type: 'exam', startDate: '2025-09-08', endDate: '2025-09-15', description: 'First mid-semester examinations for III Year I Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '10:00', endTime: '12:00' },
  { title: 'IV Year I Sem Mid-I Examinations', type: 'exam', startDate: '2025-09-08', endDate: '2025-09-15', description: 'First mid-semester examinations for IV Year I Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '14:00', endTime: '16:00' },
  { title: "Teacher's Day", type: 'event', startDate: '2025-09-05', description: "Teacher's Day celebrations — Student-Faculty interaction", location: 'Auditorium', color: COLORS.event, startTime: '10:00', endTime: '13:00' },
  { title: 'Milad-un-Nabi', type: 'holiday', startDate: '2025-09-16', description: "Prophet Muhammad's Birthday — Holiday", color: COLORS.holiday },
  { title: 'Hindi Diwas', type: 'event', startDate: '2025-09-14', description: 'Hindi Diwas celebrations', location: 'Language Lab', color: COLORS.event },
  { title: 'Hackathon — CodeAIMSCS 2025', type: 'event', startDate: '2025-09-20', endDate: '2025-09-21', description: '24-hour national hackathon organized by CSE Department', location: 'CSE Labs', color: COLORS.event, startTime: '09:00', endTime: '09:00' },
  { title: 'Industry Connect Day', type: 'event', startDate: '2025-09-05', description: 'Industry visit and guest lecture series', location: 'Main Auditorium', color: COLORS.event, startTime: '09:30', endTime: '16:00' },

  // ═══════════════════════════════════════════════════════
  // OCTOBER 2025 — Festive Season
  // ═══════════════════════════════════════════════════════
  { title: 'Dussehra Holidays', type: 'holiday', startDate: '2025-10-01', endDate: '2025-10-12', description: 'Dussehra vacation — 12 days', color: COLORS.holiday },
  { title: 'Mahatma Gandhi Jayanti', type: 'holiday', startDate: '2025-10-02', description: 'Gandhi Jayanti — National holiday', color: COLORS.holiday },
  { title: 'Classes Resume After Dussehra', type: 'academic', startDate: '2025-10-13', description: 'Classes resume after Dussehra break', color: COLORS.academic, startTime: '09:00' },
  { title: 'Annual Technical Fest — SUDHEE', type: 'event', startDate: '2025-10-15', endDate: '2025-10-18', description: 'SUDHEE 2025 — 4-day National level technical symposium with workshops, hackathons, paper presentations', location: 'Campus-wide', color: COLORS.event, startTime: '09:00', endTime: '18:00' },
  { title: 'Diwali', type: 'holiday', startDate: '2025-10-20', description: 'Diwali — College holiday', color: COLORS.holiday },
  { title: 'Project Phase-I Synopsis Submission', type: 'deadline', startDate: '2025-10-25', description: 'Final year B.Tech project synopsis submission deadline', color: COLORS.deadline },
  { title: 'Mid-II Examination Schedule Release', type: 'academic', startDate: '2025-10-27', description: 'Mid-II exam timetable released for all semesters', location: 'Notice Board / Website', color: COLORS.academic },

  // ═══════════════════════════════════════════════════════
  // NOVEMBER 2025 — Mid-II & Preparations
  // ═══════════════════════════════════════════════════════
  { title: 'I Year I Sem Mid-II Examinations', type: 'exam', startDate: '2025-11-03', endDate: '2025-11-10', description: 'Second mid-semester examinations for I Year I Semester (R22)', location: 'Examination Hall', color: COLORS.exam, startTime: '10:00', endTime: '12:00' },
  { title: 'II Year I Sem Mid-II Examinations', type: 'exam', startDate: '2025-11-03', endDate: '2025-11-10', description: 'Second mid-semester examinations for II Year I Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '14:00', endTime: '16:00' },
  { title: 'III Year I Sem Mid-II Examinations', type: 'exam', startDate: '2025-11-03', endDate: '2025-11-10', description: 'Second mid-semester examinations for III Year I Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '10:00', endTime: '12:00' },
  { title: 'IV Year I Sem Mid-II Examinations', type: 'exam', startDate: '2025-11-03', endDate: '2025-11-10', description: 'Second mid-semester examinations for IV Year I Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '14:00', endTime: '16:00' },
  { title: "Children's Day", type: 'event', startDate: '2025-11-14', description: "Children's Day celebrations at adopted school", location: 'NSS Adopted School', color: COLORS.event },
  { title: 'Sports Week', type: 'event', startDate: '2025-11-17', endDate: '2025-11-22', description: 'Annual sports week — inter-department competitions', location: 'Sports Ground', color: COLORS.event, startTime: '15:00', endTime: '18:00' },
  { title: 'National Education Day', type: 'event', startDate: '2025-11-11', description: "Maulana Abul Kalam Azad's birthday — Education Day", location: 'Auditorium', color: COLORS.event, startTime: '10:00', endTime: '12:00' },
  { title: 'Startup Pitch Competition', type: 'event', startDate: '2025-11-08', description: 'E-Cell startup pitch competition with industry judges', location: 'Incubation Center', color: COLORS.event, startTime: '10:00', endTime: '16:00' },
  { title: 'Lab Record Submission Deadline', type: 'deadline', startDate: '2025-11-25', description: 'All lab record books submission for I Sem', color: COLORS.deadline },
  { title: 'Last Working Day — I Semester', type: 'academic', startDate: '2025-11-28', description: 'Last day of classes for odd semester (I Year to IV Year)', color: COLORS.academic },
  { title: 'Preparation Leave Begins', type: 'academic', startDate: '2025-11-29', endDate: '2025-12-05', description: '7-day preparation leave before end-semester examinations', color: COLORS.academic },

  // ═══════════════════════════════════════════════════════
  // DECEMBER 2025 — End Semester Exams
  // ═══════════════════════════════════════════════════════
  { title: 'I Year I Sem End-Semester Examinations', type: 'exam', startDate: '2025-12-01', endDate: '2025-12-15', description: 'AIMSCS End-semester examinations for I Year I Semester (R22 Regulation)', location: 'Examination Centers', color: COLORS.exam, startTime: '10:00', endTime: '13:00' },
  { title: 'II Year I Sem End-Semester Examinations', type: 'exam', startDate: '2025-12-01', endDate: '2025-12-15', description: 'AIMSCS End-semester examinations for II Year I Semester', location: 'Examination Centers', color: COLORS.exam, startTime: '14:00', endTime: '17:00' },
  { title: 'III Year I Sem End-Semester Examinations', type: 'exam', startDate: '2025-12-01', endDate: '2025-12-15', description: 'AIMSCS End-semester examinations for III Year I Semester', location: 'Examination Centers', color: COLORS.exam, startTime: '10:00', endTime: '13:00' },
  { title: 'IV Year I Sem End-Semester Examinations', type: 'exam', startDate: '2025-12-01', endDate: '2025-12-15', description: 'AIMSCS End-semester examinations for IV Year I Semester', location: 'Examination Centers', color: COLORS.exam, startTime: '14:00', endTime: '17:00' },
  { title: 'IV Year Project Review — Phase I', type: 'academic', startDate: '2025-12-18', description: 'Final year B.Tech project phase-I review and presentation', location: 'Respective Departments', color: COLORS.academic, startTime: '10:00', endTime: '16:00' },
  { title: 'Alumni Meet 2025', type: 'event', startDate: '2025-12-20', description: 'Annual alumni meet and networking event', location: 'Main Auditorium', color: COLORS.event, startTime: '17:00', endTime: '21:00' },
  { title: 'Christmas Holidays', type: 'holiday', startDate: '2025-12-24', endDate: '2025-12-31', description: 'Christmas and New Year break', color: COLORS.holiday },

  // ═══════════════════════════════════════════════════════
  // JANUARY 2026 — Even Semester Begins
  // ═══════════════════════════════════════════════════════
  { title: "New Year's Day", type: 'holiday', startDate: '2026-01-01', description: 'New Year — College holiday', color: COLORS.holiday },
  { title: 'I Year II Semester Begins', type: 'academic', startDate: '2025-12-22', description: 'Even semester classes commence for I Year', location: 'All Departments', color: COLORS.academic, startTime: '09:00' },
  { title: 'II Year II Semester Begins', type: 'academic', startDate: '2026-01-02', description: 'Second year even semester classes commence', location: 'All Departments', color: COLORS.academic, startTime: '09:00' },
  { title: 'III Year II Semester Begins', type: 'academic', startDate: '2026-01-02', description: 'Third year even semester classes commence', location: 'All Departments', color: COLORS.academic, startTime: '09:00' },
  { title: 'IV Year II Semester Begins', type: 'academic', startDate: '2026-01-02', description: 'Final year even semester classes commence', location: 'All Departments', color: COLORS.academic, startTime: '09:00' },
  { title: 'Sankranti / Pongal Holidays', type: 'holiday', startDate: '2026-01-14', endDate: '2026-01-16', description: 'Sankranti holidays — 3 days', color: COLORS.holiday },
  { title: 'Republic Day', type: 'holiday', startDate: '2026-01-26', description: '77th Republic Day — Flag hoisting ceremony', location: 'Main Ground', color: COLORS.holiday, startTime: '08:00', endTime: '10:00' },
  { title: 'Course Registration — II Semester', type: 'deadline', startDate: '2026-01-05', description: 'Last date for even semester course registration', color: COLORS.deadline },
  { title: 'Add/Drop Period — II Semester', type: 'deadline', startDate: '2026-01-12', description: 'Last date to add/drop courses for even semester', color: COLORS.deadline },

  // ═══════════════════════════════════════════════════════
  // FEBRUARY 2026
  // ═══════════════════════════════════════════════════════
  { title: 'I Year II Sem Mid-I Examinations', type: 'exam', startDate: '2026-02-09', endDate: '2026-02-16', description: 'First mid-semester examinations for I Year II Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '10:00', endTime: '12:00' },
  { title: 'II Year II Sem Mid-I Examinations', type: 'exam', startDate: '2026-02-09', endDate: '2026-02-16', description: 'First mid-semester examinations for II Year II Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '14:00', endTime: '16:00' },
  { title: 'III Year II Sem Mid-I Examinations', type: 'exam', startDate: '2026-02-09', endDate: '2026-02-16', description: 'First mid-semester examinations for III Year II Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '10:00', endTime: '12:00' },
  { title: 'IV Year II Sem Mid-I Examinations', type: 'exam', startDate: '2026-02-09', endDate: '2026-02-16', description: 'First mid-semester examinations for IV Year II Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '14:00', endTime: '16:00' },
  { title: 'Maha Shivaratri', type: 'holiday', startDate: '2026-02-26', description: 'Maha Shivaratri — College holiday', color: COLORS.holiday },
  { title: 'IV Year Project Phase-II Review', type: 'academic', startDate: '2026-02-20', description: 'Final year B.Tech project phase-II progress review', location: 'Respective Departments', color: COLORS.academic, startTime: '10:00', endTime: '16:00' },
  { title: 'Cybersecurity Workshop', type: 'event', startDate: '2026-02-14', description: 'One-day workshop on cybersecurity best practices', location: 'IT Lab', color: COLORS.event, startTime: '10:00', endTime: '16:00' },
  { title: 'National Science Day', type: 'event', startDate: '2026-02-28', description: 'National Science Day celebrations — Paper presentation & quiz', location: 'Seminar Hall', color: COLORS.event, startTime: '10:00', endTime: '15:00' },

  // ═══════════════════════════════════════════════════════
  // MARCH 2026
  // ═══════════════════════════════════════════════════════
  { title: 'Holi', type: 'holiday', startDate: '2026-03-10', description: 'Holi — Festival of colors — College holiday', color: COLORS.holiday },
  { title: "Women's Day", type: 'event', startDate: '2026-03-08', description: "International Women's Day celebrations", location: 'Auditorium', color: COLORS.event, startTime: '10:00', endTime: '13:00' },
  { title: 'Assignment Submission — II Semester', type: 'deadline', startDate: '2026-03-15', description: 'All assignment submissions for even semester', color: COLORS.deadline },
  { title: 'Tech Talk — Generative AI', type: 'event', startDate: '2026-03-20', description: 'Guest lecture on "Generative AI in Engineering" by industry expert', location: 'CSE Seminar Hall', color: COLORS.event, startTime: '11:00', endTime: '13:00' },
  { title: 'IV Year Project Final Presentation', type: 'academic', startDate: '2026-03-23', endDate: '2026-03-27', description: 'Final year B.Tech project final evaluation and viva-voce', location: 'Respective Departments', color: COLORS.academic, startTime: '10:00', endTime: '17:00' },
  { title: 'Yoga Day Celebration', type: 'event', startDate: '2026-03-21', description: 'Yoga and wellness session for all students and staff', location: 'Main Ground', color: COLORS.event, startTime: '06:30', endTime: '08:00' },
  { title: 'Environmental Day — Tree Plantation', type: 'event', startDate: '2026-03-22', description: 'World Water Day — Campus cleaning and tree plantation drive', location: 'Campus', color: COLORS.event, startTime: '09:00', endTime: '12:00' },

  // ═══════════════════════════════════════════════════════
  // APRIL 2026 — Mid-II & Pre-End Sem
  // ═══════════════════════════════════════════════════════
  { title: 'I Year II Sem Mid-II Examinations', type: 'exam', startDate: '2026-04-06', endDate: '2026-04-13', description: 'Second mid-semester examinations for I Year II Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '10:00', endTime: '12:00' },
  { title: 'II Year II Sem Mid-II Examinations', type: 'exam', startDate: '2026-04-06', endDate: '2026-04-13', description: 'Second mid-semester examinations for II Year II Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '14:00', endTime: '16:00' },
  { title: 'III Year II Sem Mid-II Examinations', type: 'exam', startDate: '2026-04-06', endDate: '2026-04-13', description: 'Second mid-semester examinations for III Year II Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '10:00', endTime: '12:00' },
  { title: 'IV Year II Sem Mid-II Examinations', type: 'exam', startDate: '2026-04-06', endDate: '2026-04-13', description: 'Second mid-semester examinations for IV Year II Semester', location: 'Examination Hall', color: COLORS.exam, startTime: '14:00', endTime: '16:00' },
  { title: 'Ram Navami', type: 'holiday', startDate: '2026-04-09', description: 'Ram Navami — College holiday', color: COLORS.holiday },
  { title: 'Ambedkar Jayanti', type: 'holiday', startDate: '2026-04-14', description: 'Dr. B.R. Ambedkar Jayanti — National holiday', color: COLORS.holiday },
  { title: 'Annual Day Celebrations', type: 'event', startDate: '2026-04-18', description: 'AIMSCS College of Engineering Annual Day — Awards & Cultural program', location: 'Main Auditorium', color: COLORS.event, startTime: '17:00', endTime: '21:00' },
  { title: 'Lab External Exam — IV Year', type: 'exam', startDate: '2026-04-15', endDate: '2026-04-20', description: 'External lab examinations for final year students', location: 'Respective Labs', color: COLORS.exam, startTime: '10:00', endTime: '13:00' },
  { title: 'Last Working Day — II Semester', type: 'academic', startDate: '2026-04-25', description: 'Last day of classes for even semester', color: COLORS.academic },
  { title: 'Lab Record Submission — II Sem', type: 'deadline', startDate: '2026-04-22', description: 'All lab record books submission deadline for II Semester', color: COLORS.deadline },
  { title: 'Preparation Leave', type: 'academic', startDate: '2026-04-26', endDate: '2026-05-02', description: 'Preparation leave before end-semester examinations', color: COLORS.academic },

  // ═══════════════════════════════════════════════════════
  // MAY 2026 — End Semester Exams
  // ═══════════════════════════════════════════════════════
  { title: 'I Year II Sem End-Semester Examinations', type: 'exam', startDate: '2026-05-04', endDate: '2026-05-18', description: 'AIMSCS End-semester examinations for I Year II Semester (R22 Regulation)', location: 'Examination Centers', color: COLORS.exam, startTime: '10:00', endTime: '13:00' },
  { title: 'II Year II Sem End-Semester Examinations', type: 'exam', startDate: '2026-05-04', endDate: '2026-05-18', description: 'AIMSCS End-semester examinations for II Year II Semester', location: 'Examination Centers', color: COLORS.exam, startTime: '14:00', endTime: '17:00' },
  { title: 'III Year II Sem End-Semester Examinations', type: 'exam', startDate: '2026-05-04', endDate: '2026-05-18', description: 'AIMSCS End-semester examinations for III Year II Semester', location: 'Examination Centers', color: COLORS.exam, startTime: '10:00', endTime: '13:00' },
  { title: 'IV Year II Sem End-Semester Examinations', type: 'exam', startDate: '2026-05-04', endDate: '2026-05-15', description: 'AIMSCS End-semester examinations for IV Year II Semester — Final exams!', location: 'Examination Centers', color: COLORS.exam, startTime: '14:00', endTime: '17:00' },
  { title: 'May Day / Labour Day', type: 'holiday', startDate: '2026-05-01', description: 'International Labour Day — Holiday', color: COLORS.holiday },
  { title: 'IV Year B.Tech Results Declaration', type: 'academic', startDate: '2026-05-28', description: 'Final year B.Tech results expected to be declared by AIMSCS', color: COLORS.academic },
  { title: 'Convocation Registration Deadline', type: 'deadline', startDate: '2026-05-30', description: 'Last date to register for the upcoming convocation ceremony', color: COLORS.deadline },

  // ═══════════════════════════════════════════════════════
  // JUNE 2026 — Year End
  // ═══════════════════════════════════════════════════════
  { title: 'Summer Vacation Begins', type: 'holiday', startDate: '2026-06-01', endDate: '2026-06-30', description: 'Summer vacation period', color: COLORS.holiday },
  { title: 'Campus Placement Drive — Final Round', type: 'event', startDate: '2026-06-05', endDate: '2026-06-08', description: 'Final round of campus placements for eligible students', location: 'Training & Placement Cell', color: COLORS.event, startTime: '09:00', endTime: '17:00' },
  { title: 'Remedial Classes', type: 'class', startDate: '2026-06-10', endDate: '2026-06-25', description: 'Remedial classes for students with backlogs', location: 'Respective Departments', color: COLORS.class, startTime: '09:00', endTime: '13:00' },
  { title: 'Convocation Ceremony', type: 'event', startDate: '2026-06-15', description: 'Annual convocation for B.Tech degree award', location: 'AIMSCS Auditorium', color: COLORS.event, startTime: '10:00', endTime: '14:00' },
  { title: 'I/II/III Year Results Declaration', type: 'academic', startDate: '2026-06-20', description: 'End-semester results expected to be declared by AIMSCS', color: COLORS.academic },
  { title: 'Academic Year 2025-2026 Ends', type: 'academic', startDate: '2026-06-30', description: 'Official end of AY 2025-2026 (R22 Regulation)', color: COLORS.academic },
];

async function seedCalendar() {
  console.log(`\n🎓 Seeding ${events.length} AIMSCS Academic Calendar events...\n`);

  // First, delete existing events
  try {
    const existing = await fetch(`${BASE_URL}?limit=200`);
    const existingData = await existing.json();
    console.log(`Found ${existingData.total} existing events to delete...`);
    
    for (const e of existingData.events || []) {
      await fetch(`${BASE_URL}?id=${e.id}`, { method: 'DELETE' });
    }
    console.log('Existing events cleared.\n');
  } catch (err) {
    console.log('Could not clear existing events, continuing...\n');
  }

  let created = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const payload = {
        userId: SUPER_ADMIN_ID,
        academicYearId: AY_ID,
        isAllDay: true,
        ...event,
      };

      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        created++;
        console.log(`  ✓ ${event.startDate} | ${event.type.padEnd(10)} | ${event.title}`);
      } else {
        const err = await res.json();
        failed++;
        console.log(`  ✗ ${event.title}: ${err.error}`);
      }
    } catch (err) {
      failed++;
      console.log(`  ✗ ${event.title}: ${err}`);
    }
  }

  console.log(`\n✅ Done! Created: ${created}, Failed: ${failed}`);
}

seedCalendar();
