import type { Role } from '@/lib/store';

export const DEMO_PASSWORD = 'demo123';

export const DEMO_ACCOUNTS: { label: string; email: string; role: Role }[] = [
  { label: 'Super Admin', email: 'vice.chancellor@jntuh.ac.in', role: 'super_admin' },
  { label: 'Admin', email: 'registrar@jntuh.ac.in', role: 'admin' },
  { label: 'HOD (CSE)', email: 'hod.cse@jntuh.ac.in', role: 'hod' },
  { label: 'Faculty', email: 'faculty.venkat@jntuh.ac.in', role: 'faculty' },
  { label: 'Lab Assistant', email: 'lab.ravi@jntuh.ac.in', role: 'lab_assistant' },
  { label: 'Student', email: 'student.ravi@jntuh.ac.in', role: 'student' },
  { label: 'Parent', email: 'parent.rajesh@jntuh.ac.in', role: 'parent' },
  { label: 'Visitor', email: 'visitor.john@jntuh.ac.in', role: 'visitor' },
  { label: 'Security', email: 'security.murthy@jntuh.ac.in', role: 'security' },
];
