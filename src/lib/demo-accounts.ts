import type { Role } from '@/lib/store';

export const DEMO_PASSWORD = 'demo123';

export const DEMO_ACCOUNTS: { label: string; email: string; role: Role }[] = [
  { label: 'Super Admin', email: 'vice.chancellor@aimscs.ac.in', role: 'super_admin' },
  { label: 'Admin', email: 'registrar@aimscs.ac.in', role: 'admin' },
  { label: 'HOD (CSE)', email: 'hod.cse@aimscs.ac.in', role: 'hod' },
  { label: 'Faculty', email: 'faculty.venkat@aimscs.ac.in', role: 'faculty' },
  { label: 'Lab Assistant', email: 'lab.ravi@aimscs.ac.in', role: 'lab_assistant' },
  { label: 'Student', email: 'student.ravi@aimscs.ac.in', role: 'student' },
  { label: 'Parent', email: 'parent.rajesh@aimscs.ac.in', role: 'parent' },
  { label: 'Visitor', email: 'visitor.john@aimscs.ac.in', role: 'visitor' },
  { label: 'Security', email: 'security.murthy@aimscs.ac.in', role: 'security' },
];
