const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'seed-calendar.ts'), 'utf8');
const eventsStart = src.indexOf('const events:');
const arrayStart = src.indexOf('[', eventsStart);
const arrayEnd = src.indexOf('\n];', arrayStart);
if (arrayStart < 0 || arrayEnd < 0) throw new Error('Could not parse events array');

const arrayBody = src.slice(arrayStart, arrayEnd + 2).replace(/\bCOLORS\./g, 'CALENDAR_COLORS.');

const out = `export interface CalendarSeedEvent {
  title: string;
  description?: string;
  type: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  color?: string;
}

export const CALENDAR_COLORS: Record<string, string> = {
  academic: '#22c55e',
  exam: '#ef4444',
  holiday: '#f59e0b',
  event: '#8b5cf6',
  deadline: '#ec4899',
  personal: '#6366f1',
  class: '#06b6d4',
};

export const CALENDAR_SEED_EVENTS: CalendarSeedEvent[] = ${arrayBody};
`;

fs.writeFileSync(path.join(__dirname, '../prisma/calendar-events-data.ts'), out);
console.log('Wrote prisma/calendar-events-data.ts with', arrayBody.split('{ title:').length - 1, 'events');
