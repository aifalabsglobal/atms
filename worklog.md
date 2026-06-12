---
Task ID: 1
Agent: Main Agent
Task: Fix student assignments, quizzes, and all UI issues in JNTUH SCMS

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
