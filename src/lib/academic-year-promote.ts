import { db } from '@/lib/db';
import { getOrgSettings } from '@/lib/settings/org-config';

function todayYmd(timeZone = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function enforceSingleActiveYear(excludeId: string) {
  await db.academicYear.updateMany({
    where: { status: 'active', NOT: { id: excludeId } },
    data: { status: 'completed' },
  });
}

export type PromoteResult = {
  enabled: boolean;
  today: string;
  promoted: { id: string; code: string; name: string }[];
  message: string;
};

/**
 * Promote the earliest upcoming academic year whose startDate has arrived.
 * Honors allowMultipleActiveYears when leaving other actives alone.
 */
export async function promoteDueAcademicYears(options?: {
  today?: string;
  timeZone?: string;
}): Promise<PromoteResult> {
  const org = await getOrgSettings();
  const today = options?.today ?? todayYmd(options?.timeZone);

  if (!org.autoPromoteAcademicYear) {
    return {
      enabled: false,
      today,
      promoted: [],
      message: 'Auto-promote is Off in Organization settings.',
    };
  }

  const due = await db.academicYear.findFirst({
    where: {
      status: 'upcoming',
      startDate: { lte: today },
    },
    orderBy: { startDate: 'asc' },
    select: { id: true, code: true, name: true },
  });

  if (!due) {
    return {
      enabled: true,
      today,
      promoted: [],
      message: 'No upcoming academic year is due for promotion.',
    };
  }

  if (!org.allowMultipleActiveYears) {
    await enforceSingleActiveYear(due.id);
  }

  await db.academicYear.update({
    where: { id: due.id },
    data: { status: 'active' },
  });

  return {
    enabled: true,
    today,
    promoted: [due],
    message: `Promoted ${due.code} (${due.name}) to active.`,
  };
}
