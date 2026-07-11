import type { GeneralSettings } from '@/lib/settings/general-defaults';
import { DEFAULT_GENERAL_SETTINGS } from '@/lib/settings/general-defaults';

type FormatOpts = Pick<GeneralSettings, 'dateFormat' | 'timeFormat' | 'locale' | 'timezone'>;

function partsFor(date: Date, opts: FormatOpts) {
  const dtf = new Intl.DateTimeFormat(opts.locale || 'en-IN', {
    timeZone: opts.timezone || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: opts.timeFormat !== '24h',
  });
  const bag: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') bag[p.type] = p.value;
  }
  return bag;
}

/** Format a date using campus General Settings (date + optional time). */
export function formatCampusDateTime(
  input: string | number | Date,
  opts: Partial<FormatOpts> & { includeTime?: boolean } = {},
): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const settings: FormatOpts = {
    dateFormat: opts.dateFormat ?? DEFAULT_GENERAL_SETTINGS.dateFormat,
    timeFormat: opts.timeFormat ?? DEFAULT_GENERAL_SETTINGS.timeFormat,
    locale: opts.locale ?? DEFAULT_GENERAL_SETTINGS.locale,
    timezone: opts.timezone ?? DEFAULT_GENERAL_SETTINGS.timezone,
  };

  const bag = partsFor(date, settings);
  const y = bag.year ?? '';
  const m = bag.month ?? '';
  const d = bag.day ?? '';

  let dateStr: string;
  switch (settings.dateFormat) {
    case 'MM/dd/yyyy':
      dateStr = `${m}/${d}/${y}`;
      break;
    case 'yyyy-MM-dd':
      dateStr = `${y}-${m}-${d}`;
      break;
    case 'dd/MM/yyyy':
    default:
      dateStr = `${d}/${m}/${y}`;
      break;
  }

  if (!opts.includeTime) return dateStr;

  const hour = bag.hour ?? '';
  const minute = bag.minute ?? '';
  const dayPeriod = bag.dayPeriod ? ` ${bag.dayPeriod}` : '';
  return `${dateStr} ${hour}:${minute}${dayPeriod}`.trim();
}

export function formatCampusCurrency(
  amount: number,
  opts: Pick<GeneralSettings, 'currency' | 'locale'> = {
    currency: DEFAULT_GENERAL_SETTINGS.currency,
    locale: DEFAULT_GENERAL_SETTINGS.locale,
  },
): string {
  try {
    return new Intl.NumberFormat(opts.locale || 'en-IN', {
      style: 'currency',
      currency: opts.currency || 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${opts.currency || 'INR'} ${amount.toFixed(2)}`;
  }
}

export function formatCampusNumber(value: number, locale = DEFAULT_GENERAL_SETTINGS.locale): string {
  try {
    return new Intl.NumberFormat(locale || 'en-IN').format(value);
  } catch {
    return String(value);
  }
}
