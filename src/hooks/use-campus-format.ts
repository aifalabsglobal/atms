'use client';

import { useMemo } from 'react';
import { usePlatformSettings } from '@/hooks/use-platform-settings';
import { DEFAULT_GENERAL_SETTINGS } from '@/lib/settings/general-defaults';
import {
  formatCampusCurrency,
  formatCampusDateTime,
  formatCampusNumber,
} from '@/lib/datetime-format';

/** Campus regional formatting helpers bound to live General settings. */
export function useCampusFormat() {
  const { data } = usePlatformSettings();
  const general = data ?? DEFAULT_GENERAL_SETTINGS;

  return useMemo(() => {
    const opts = {
      dateFormat: general.dateFormat,
      timeFormat: general.timeFormat,
      locale: general.locale,
      timezone: general.timezone,
      currency: general.currency,
    };

    return {
      ...opts,
      formatDate: (input: string | number | Date) =>
        formatCampusDateTime(input, { ...opts, includeTime: false }),
      formatDateTime: (input: string | number | Date) =>
        formatCampusDateTime(input, { ...opts, includeTime: true }),
      formatCurrency: (amount: number) =>
        formatCampusCurrency(amount, { currency: opts.currency, locale: opts.locale }),
      formatNumber: (value: number) => formatCampusNumber(value, opts.locale),
    };
  }, [general]);
}
