import { db } from '../src/lib/db';

async function main() {
  const [subjects, programs, active, subs, geofences] = await Promise.all([
    db.subject.count(),
    db.program.count(),
    db.attendanceSession.count({ where: { status: 'active' } }),
    db.submission.count(),
    db.geofence.count(),
  ]);
  console.log({ subjects, programs, activeSessions: active, submissions: subs, geofences });
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
