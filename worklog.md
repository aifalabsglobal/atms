---
Task ID: 1
Agent: Main Agent
Task: Implement Super Admin Masters management, JNTU R22 course structure, and Calendar for all users

Work Log:
- Updated Prisma schema with Department, AcademicYear, Semester, Subject, CalendarEvent models
- Added departmentId to User, semesterId to TimetableSlot, subjectId to Course
- Created comprehensive seed data with JNTUH R22 B.Tech course structure (10 depts, 66 subjects, 8 programs, 8 semesters, 21 calendar events, 29 users)
- Created Masters API routes with full CRUD (GET/POST/PUT/DELETE) for departments, academic-years, semesters, subjects, programs
- Created Calendar API route with full CRUD and filtering
- Built Masters section UI with tabbed layout (5 tabs), stat cards, data tables with Add/Edit/Delete dialogs
- Built Calendar section UI with month grid view, event type filters, and event list sidebar
- Updated sidebar navigation with Masters (Super Admin only) and Calendar (all roles)
- Changed branding from UoH to JNTUH Engineering College
- Changed emails from @uohyd.ac.in to @jntuh.ac.in
- Fixed dynamic import ChunkLoadError by switching to direct imports
- Fixed useToast import path from @/components/ui/use-toast to @/hooks/use-toast
- Verified all APIs working: 10 depts, 66 subjects, 8 programs, 8 semesters, 21 calendar events
- Verified CRUD operations: CREATE department → READ → DELETE working correctly

Stage Summary:
- Super Admin can now manage all master data (departments, academic years, semesters, subjects, programs) with full CRUD
- All users have access to Calendar with academic events, exams, holidays, deadlines
- JNTUH R22 B.Tech CSE course structure seeded with proper subject codes (MA101BS, CS301PC, etc.)
- 10 engineering departments matching JNTU Hyderabad structure
- Note: Agent Browser causes OOM in sandbox, verified via curl/preview panel instead
