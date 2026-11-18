/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { MINUTES_PER_DAY, parseLocalTime } from '@/lib/localDateTime';
import { isRecord } from '@/lib/embeddedSchema';

export const WORKING_HOURS_SLOT = 'x:WorkingHoursSlot';

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type ScheduleRules = 'sameDay' | 'overnight';

const OVERNIGHT_CONTAINERS: ReadonlySet<string> = new Set(['x:MailRuleSchedule']);

export function scheduleRules(container: string | null | undefined): ScheduleRules {
  return container != null && OVERNIGHT_CONTAINERS.has(container) ? 'overnight' : 'sameDay';
}

export interface Slot {
  days: Weekday[];
  start: number | null;
  end: number | null;
}

export type SlotIssue = 'noDays' | 'missingTime' | 'endNotAfterStart' | 'startAtEndOfDay' | 'sameStartEnd';

const WEEKDAY_INDEX: ReadonlyMap<string, number> = new Map(WEEKDAYS.map((day, index) => [day, index]));

export function weekdayIndex(day: string): number | undefined {
  return WEEKDAY_INDEX.get(day);
}

export function parseSlot(value: unknown): Slot {
  const record = isRecord(value) ? value : {};
  const set = isRecord(record.days) ? record.days : {};
  return {
    days: WEEKDAYS.filter((day) => Object.hasOwn(set, day) && set[day] === true),
    start: parseLocalTime(record.start),
    end: parseLocalTime(record.end),
  };
}

export function slotEntries(value: unknown): [string, unknown][] {
  return isRecord(value) ? Object.entries(value).sort(([a], [b]) => Number(a) - Number(b)) : [];
}

export function nextSlotKey(entries: readonly [string, unknown][]): string {
  let max = -1;
  for (const [key] of entries) max = Math.max(max, Number(key) || 0);
  return String(max + 1);
}

function effectiveEnd(end: number, rules: ScheduleRules): number {
  return rules === 'overnight' && end === 0 ? MINUTES_PER_DAY : end;
}

export function slotIssue(slot: Slot, rules: ScheduleRules): SlotIssue | null {
  if (slot.days.length === 0) return 'noDays';
  if (slot.start === null || slot.end === null) return 'missingTime';
  if (rules === 'sameDay') return slot.start < slot.end ? null : 'endNotAfterStart';
  if (slot.start >= MINUTES_PER_DAY) return 'startAtEndOfDay';
  return slot.start === effectiveEnd(slot.end, rules) ? 'sameStartEnd' : null;
}

export function isOvernight(slot: Slot, rules: ScheduleRules): boolean {
  return (
    rules === 'overnight' && slot.start !== null && slot.end !== null && effectiveEnd(slot.end, rules) < slot.start
  );
}

export function isScheduleInvalid(value: unknown, rules: ScheduleRules, minItems = 0): boolean {
  const entries = slotEntries(value);
  return entries.length < minItems || entries.some(([, item]) => slotIssue(parseSlot(item), rules) !== null);
}

export interface DaySegment {
  key: string;
  start: number;
  end: number;
}

export function daySegments(entries: readonly [string, Slot][], rules: ScheduleRules): DaySegment[][] {
  const days: DaySegment[][] = WEEKDAYS.map(() => []);
  for (const [key, slot] of entries) {
    if (slot.start === null || slot.end === null) continue;
    const start = slot.start;
    const end = effectiveEnd(slot.end, rules);
    const wraps = rules === 'overnight' && end < start;
    if (!wraps && start >= end) continue;
    for (const day of slot.days) {
      const index = WEEKDAY_INDEX.get(day) ?? 0;
      if (wraps) {
        days[index].push({ key, start, end: MINUTES_PER_DAY });
        if (end > 0) days[(index + 1) % WEEKDAYS.length].push({ key, start: 0, end });
      } else {
        days[index].push({ key, start, end });
      }
    }
  }
  return days;
}

export function firstWeekdayOf(locale: string): Weekday {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    return (firstDay !== undefined ? WEEKDAYS[firstDay - 1] : undefined) ?? 'monday';
  } catch {
    return 'monday';
  }
}

export function weekdayOrder(first: Weekday): Weekday[] {
  const offset = WEEKDAY_INDEX.get(first) ?? 0;
  return WEEKDAYS.map((_, i) => WEEKDAYS[(i + offset) % WEEKDAYS.length]);
}

export function dayRuns(days: readonly Weekday[], order: readonly Weekday[]): Weekday[][] {
  const selected = new Set(days);
  const runs: Weekday[][] = [];
  let current: Weekday[] = [];
  for (const day of order) {
    if (selected.has(day)) {
      current.push(day);
    } else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

export interface SlotTemplate {
  days: readonly Weekday[];
  start: string;
  end: string;
}

export type PresetName = 'workdays' | 'everyDay' | 'outsideWorkdays';

const WORKDAYS: readonly Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export const PRESETS: Readonly<Record<PresetName, readonly SlotTemplate[]>> = {
  workdays: [{ days: WORKDAYS, start: '09:00', end: '17:00' }],
  everyDay: [{ days: WEEKDAYS, start: '09:00', end: '17:00' }],
  outsideWorkdays: [
    { days: WORKDAYS, start: '17:00', end: '09:00' },
    { days: ['saturday', 'sunday'], start: '00:00', end: '24:00' },
  ],
};

export function presetsFor(rules: ScheduleRules): PresetName[] {
  return rules === 'overnight' ? ['workdays', 'everyDay', 'outsideWorkdays'] : ['workdays', 'everyDay'];
}

export function daysValue(days: readonly Weekday[]): Record<string, true> {
  return Object.fromEntries(days.map((day) => [day, true]));
}

export function slotsValue(templates: readonly SlotTemplate[]): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    templates.map((slot, index) => [String(index), { days: daysValue(slot.days), start: slot.start, end: slot.end }]),
  );
}
