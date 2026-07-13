import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const map: Record<string, string> = {
  'vice.chancellor@aimscs.ac.in': '/profiles/staff-male-admin.png',
  'registrar@aimscs.ac.in': '/profiles/staff-male-admin.png',
  'hod.cse@aimscs.ac.in': '/profiles/staff-male-faculty.png',
  'hod.aiml@aimscs.ac.in': '/profiles/staff-female-faculty.png',
  'hod.ds@aimscs.ac.in': '/profiles/staff-female-faculty.png',
  'faculty.venkat@aimscs.ac.in': '/profiles/staff-male-faculty.png',
  'faculty.lakshmi@aimscs.ac.in': '/profiles/staff-female-faculty.png',
  'faculty.padma@aimscs.ac.in': '/profiles/staff-female-faculty.png',
  'lab.ravi@aimscs.ac.in': '/profiles/staff-male-faculty.png',
  'student.ravi@aimscs.ac.in': '/profiles/student-male-1.png',
  'student.divya@aimscs.ac.in': '/profiles/student-female-1.png',
  'student.priyanka@aimscs.ac.in': '/profiles/student-female-2.png',
  'student.anusha@aimscs.ac.in': '/profiles/student-female-2.png',
  'parent.rajesh@aimscs.ac.in': '/profiles/staff-male-admin.png',
  'security.murthy@aimscs.ac.in': '/profiles/staff-male-faculty.png',
  'visitor.john@aimscs.ac.in': '/profiles/staff-male-faculty.png',
};

async function main() {
  let mapped = 0;
  for (const [email, profileImageUrl] of Object.entries(map)) {
    const r = await db.user.updateMany({
      where: { email },
      data: { profileImageUrl, avatarUrl: profileImageUrl },
    });
    mapped += r.count;
  }

  const staffFallback = await db.user.updateMany({
    where: {
      profileImageUrl: null,
      role: { in: ['hod', 'faculty', 'admin', 'super_admin', 'lab_assistant', 'security'] },
    },
    data: {
      profileImageUrl: '/profiles/staff-male-faculty.png',
      avatarUrl: '/profiles/staff-male-faculty.png',
    },
  });

  const studentFallback = await db.user.updateMany({
    where: { profileImageUrl: null, role: 'student' },
    data: {
      profileImageUrl: '/profiles/student-male-1.png',
      avatarUrl: '/profiles/student-male-1.png',
    },
  });

  console.log({ mapped, staffFallback: staffFallback.count, studentFallback: studentFallback.count });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
