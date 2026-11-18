/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { TFunction } from 'i18next';
import { formatIntervalEnd, formatList, formatLocalTime, formatWeekday, getFormatLocale } from '@/lib/format';
import { MINUTES_PER_DAY, localTimeFromMinutes } from '@/lib/localDateTime';
import {
  WEEKDAYS,
  dayRuns,
  firstWeekdayOf,
  isOvernight,
  weekdayOrder,
  type ScheduleRules,
  type Slot,
  type Weekday,
} from '@/lib/weeklySchedule';

const RANGE_MIN_DAYS = 3;
const MISSING_TIME = '--:--';

export function localeWeekdayOrder(): Weekday[] {
  return weekdayOrder(firstWeekdayOf(getFormatLocale()));
}

export function formatDays(t: TFunction, days: readonly Weekday[], order: readonly Weekday[]): string {
  if (days.length === 0) return t('schedule.noDays', 'No days');
  if (days.length === WEEKDAYS.length) return t('schedule.everyDay', 'Every day');
  const parts = dayRuns(days, order).flatMap((run) =>
    run.length >= RANGE_MIN_DAYS
      ? [
          t('schedule.dayRange', '{{first}}–{{last}}', {
            first: formatWeekday(run[0], 'short'),
            last: formatWeekday(run[run.length - 1], 'short'),
          }),
        ]
      : run.map((day) => formatWeekday(day, 'short')),
  );
  return formatList(parts);
}

function formatClock(minutes: number | null, end: boolean): string {
  if (minutes === null) return MISSING_TIME;
  const time = localTimeFromMinutes(minutes);
  return end ? formatIntervalEnd(time) : formatLocalTime(time);
}

export function formatSlot(t: TFunction, slot: Slot, order: readonly Weekday[], rules: ScheduleRules): string {
  const days = formatDays(t, slot.days, order);
  const end = slot.end !== null && rules === 'overnight' && slot.end === 0 ? MINUTES_PER_DAY : slot.end;
  if (slot.start === 0 && end === MINUTES_PER_DAY) return t('schedule.slotAllDay', '{{days}}, all day', { days });
  const times = { days, start: formatClock(slot.start, false), end: formatClock(end, true) };
  return isOvernight(slot, rules)
    ? t('schedule.slotOvernight', '{{days}}, {{start}} to {{end}} the next day', times)
    : t('schedule.slot', '{{days}}, {{start}} to {{end}}', times);
}
