/** Shared calendar event type keys used by Calendar API + UI. */
export const PUBLIC_CALENDAR_EVENT_TYPES = [
  'academic',
  'exam',
  'holiday',
  'compensatory',
  'event',
  'deadline',
  'class',
] as const;

export type PublicCalendarEventType = (typeof PUBLIC_CALENDAR_EVENT_TYPES)[number];

export const CALENDAR_EVENT_TYPE_LABELS: Record<PublicCalendarEventType, string> = {
  academic: 'Academic',
  exam: 'Examination',
  holiday: 'Holiday',
  compensatory: 'Compensatory working day',
  event: 'Event',
  deadline: 'Deadline',
  class: 'Class',
};
