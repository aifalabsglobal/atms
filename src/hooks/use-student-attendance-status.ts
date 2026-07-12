'use client';

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';

export type StudentActiveSessionStatus = {
  id: string;
  alreadyMarked: boolean;
  course: { name: string; code: string };
};

export type StudentAttendanceStatus = {
  sessions: StudentActiveSessionStatus[];
  marked: StudentActiveSessionStatus[];
  open: StudentActiveSessionStatus[];
  summary: string;
};

function formatStatus(sessions: StudentActiveSessionStatus[]): string {
  if (sessions.length === 0) {
    return 'No active attendance sessions right now.';
  }
  const marked = sessions.filter((s) => s.alreadyMarked);
  const open = sessions.filter((s) => !s.alreadyMarked);
  const parts: string[] = [];
  if (marked.length > 0) {
    parts.push(
      `Marked for ${marked.map((s) => s.course.code || s.course.name).join(', ')}.`,
    );
  }
  if (open.length > 0) {
    parts.push(
      `Still open: ${open.map((s) => s.course.code || s.course.name).join(', ')}.`,
    );
  } else {
    parts.push('You are marked for all active sessions.');
  }
  return parts.join(' ');
}

export function useStudentAttendanceStatus(enabled = true) {
  const currentUser = useAppStore((s) => s.currentUser);

  return useQuery({
    queryKey: ['active-sessions', currentUser?.id, 'voice-status'],
    queryFn: async (): Promise<StudentAttendanceStatus> => {
      const res = await fetch(
        `/api/attendance/active-sessions?studentId=${currentUser!.id}`,
      );
      if (!res.ok) throw new Error('Failed to load attendance status');
      const data = (await res.json()) as {
        sessions?: StudentActiveSessionStatus[];
      };
      const sessions = (data.sessions ?? []).map((s) => ({
        id: s.id,
        alreadyMarked: Boolean(s.alreadyMarked),
        course: {
          name: s.course?.name ?? 'Course',
          code: s.course?.code ?? '',
        },
      }));
      const marked = sessions.filter((s) => s.alreadyMarked);
      const open = sessions.filter((s) => !s.alreadyMarked);
      return {
        sessions,
        marked,
        open,
        summary: formatStatus(sessions),
      };
    },
    enabled: enabled && !!currentUser?.id,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function speakAttendanceSummary(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-IN';
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}
