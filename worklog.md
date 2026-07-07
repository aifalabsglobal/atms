---
Task ID: 1
Agent: Main Agent
Task: Fix student assignments, quizzes, and all UI issues in AIMSCS

Work Log:
- Updated `/api/lms/assignments/route.ts` to support `studentId` parameter - filters by enrolled courses, includes student's submission data, and computes `myStatus` (not_started/submitted/graded/overdue)
- Updated `/api/lms/quizzes/route.ts` to support `studentId` parameter - filters quiz attempts by student, includes summary stats (avgScore, bestScore, courseBreakdown)
- Completely rewrote `src/components/sections/lms-section.tsx` with role-aware views:
  - **Student view**: "My Learning" header, "My Assignments" tab with personal status tracking, "My Quizzes" tab with attempt history and practice questions
  - **Admin/Faculty view**: Existing admin views with charts and management tables
- Added `StudentAssignmentsTab` component with: pending/submitted/graded/overdue quick stats, expandable assignment cards with submission details, score/feedback display, overdue alerts with days countdown
- Added `StudentQuizzesTab` component with: quiz stats (questions/attempts/avg/best), quiz attempt history with score visualization, practice questions preview
- Fixed notification badge overlap in `page.tsx` - replaced Badge with `<span>` for proper absolute positioning, added 9+ overflow handling
- Fixed sidebar violations badge overflow - added proper min-width and padding
- Fixed `unreadCount` null handling (|| to ??)
- Fixed seed data to use consistent IDs matching store presets (u1, u2, u3, u6, u8, u10, u18, u19, u20)
- Fixed bestScore display rounding (Math.round)
- Re-seeded database with `bunx prisma db push --force-reset && bunx prisma db seed`
- Browser verified: Student role shows "My Learning" with "My Assignments" (2 assignments with pending status), "My Quizzes" (1 attempt at 67%, 2 questions); Admin role shows full management view with charts

Stage Summary:
- Student assignments now show personal status (Pending/Submitted/Graded/Overdue) with due date tracking
- Student quizzes now show personal attempt history, scores, and practice questions
- All role-based views properly differentiated (student vs admin/faculty)
- Visual overlap issues fixed (notification badge, sidebar badge)
- Database IDs now consistent between store presets and seed data
- All APIs returning 200, lint passes, no compilation errors

---
Task ID: 1
Agent: Main Agent
Task: Make student reports specific to the logged-in student

Work Log:
- Analyzed existing Reports section and API - both were showing ALL data regardless of role
- Read store.ts to understand current user context and role presets
- Read LMS section to understand how it already handles student-specific filtering (passing studentId to APIs)
- Rewrote /api/reports/route.ts to accept studentId parameter and return completely different data structure for students:
  - Student profile info
  - Enrolled courses list
  - Student-specific attendance with per-course breakdown
  - Student's assignment submissions with scores and feedback
  - Student's quiz attempts with scores
  - Student's grade distribution and course-wise grades
  - Student's violations only
- Rewrote /src/components/sections/reports-section.tsx with two distinct views:
  - StudentReportView: Shows student profile header, attendance warning, course-wise attendance chart, assignment submissions, quiz attempts, grade distribution, course grades, and violations - all specific to the student
  - AdminReportView: Preserved the original admin view with all-student data
- Main component detects role and passes studentId to API when role is 'student'
- Verified both views work correctly via browser testing
- Student view shows: Arun Kumar's name, per-course attendance (100% for MA101BS, 0% for CH201BS, etc.), graded assignments with feedback, quiz attempts, grade distribution chart, and student's own violations
- Admin view shows: "Reports & Analytics" with all-student attendance data, course performance, grade distribution, and violation summary
- Lint check passed with no errors
- Dev log shows successful API calls for both /api/reports?studentId=u10 (200) and /api/reports (200)

Stage Summary:
- Reports API now supports student-specific filtering via studentId query parameter
- Reports section renders completely different views based on user role
- Student view includes attendance warning when below 75% (AIMSCS requirement)
- All data in student view is filtered to only show the logged-in student's records
- Admin view remains unchanged with campus-wide analytics
