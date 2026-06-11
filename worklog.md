---
Task ID: 1
Agent: Main Agent
Task: Implement role-based dashboard views with role switcher for UoH SCMS

Work Log:
- Updated `src/lib/store.ts` with Role type (9 roles), ROLE_PRESETS (user per role), ROLE_SECTIONS (sidebar access per role), ROLE_LABELS, and setCurrentRole action
- Updated `src/app/page.tsx` with role switcher dropdown in header (Shield icon + role label), role-based sidebar filtering, role-colored avatars, and user profile with role badge
- Rewrote `src/components/sections/dashboard-section.tsx` with 8 distinct dashboard views:
  - AdminDashboard (super_admin + admin): Full overview with all stats, charts, active sessions, violations, recent activity
  - HODDashboard: Department-focused stats, courses, violations
  - FacultyDashboard: My courses, quick actions panel, attendance stats
  - LabAssistantDashboard: Lab sessions, equipment zones status, capture methods
  - StudentDashboard: Attendance ring/circle, course attendance with progress bars, upcoming actions
  - ParentDashboard: Child overview card, attendance summary, course performance, notifications
  - VisitorDashboard: Campus info, zones & geofences, visitor guidelines
  - SecurityDashboard: Alert banner for pending violations, security feed, active sessions, violations chart
- Added WelcomeBanner component with role-specific greetings and descriptions
- Added role-specific color theming (ROLE_COLORS)
- Verified all 9 role views render correctly via Agent Browser testing

Stage Summary:
- Role switcher dropdown allows instant switching between 9 roles
- Each role sees a customized dashboard with relevant widgets and data
- Sidebar navigation adapts per role (e.g., Visitor only sees Dashboard + Geofences)
- User profile in header shows role-specific name, avatar, email, and department
- All views confirmed working via browser testing
