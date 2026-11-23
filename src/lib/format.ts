/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import i18n from '@/i18n';
import { SIZE_UNITS } from '@/lib/durationFormat';
import {
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  localDateToUtcDate,
  parseLocalDate,
  parseLocalTime,
} from '@/lib/localDateTime';
import { WEEKDAYS, type Weekday } from '@/lib/weeklySchedule';
import { DEFAULT_LOCALE, useAccountStore } from '@/stores/accountStore';

export type DateInput = string | number | Date;

export function getFormatLocale(): string {
  const { locale } = useAccountStore.getState();
  if (locale && locale !== DEFAULT_LOCALE) return locale;
  const nav = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  return nav[0] || DEFAULT_LOCALE;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const locale = getFormatLocale();
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = numberFormats.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, fmt);
  }
  return fmt;
}

function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = getFormatLocale();
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = dateFormats.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, fmt);
  }
  return fmt;
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return numberFormat(options).format(value);
}

export function formatCompactNumber(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1000) return formatNumber(value);
  return formatNumber(value, {
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  });
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return formatNumber(value / 100, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

const NO_VALUE = '\u2013';

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatSize(bytes: number, options: { compact?: boolean } = {}): string {
  if (!Number.isFinite(bytes)) return NO_VALUE;
  const abs = Math.abs(bytes);
  for (let i = SIZE_UNITS.length - 1; i >= 0; i--) {
    const unit = SIZE_UNITS[i];
    const scaled = abs / 1024 ** i;
    const digits = options.compact ? (scaled < 9.95 && i > 0 ? 1 : 0) : 2;
    const value = roundTo(scaled, digits);
    if (value >= 1 || i === 0) {
      const formatted = formatNumber(bytes < 0 ? -value : value, {
        maximumFractionDigits: digits,
        minimumFractionDigits: options.compact ? digits : 0,
      });
      return `${formatted} ${unit}`;
    }
  }
  return `${formatNumber(bytes)} B`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return NO_VALUE;
  if (ms === 0) return '0ms';
  let rest = Math.abs(ms);
  const d = Math.floor(rest / 86_400_000);
  rest %= 86_400_000;
  const h = Math.floor(rest / 3_600_000);
  rest %= 3_600_000;
  const m = Math.floor(rest / 60_000);
  rest %= 60_000;
  const s = Math.floor(rest / 1_000);
  rest %= 1_000;

  const parts: string[] = [];
  if (d > 0) parts.push(`${formatNumber(d)}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  if (rest > 0) parts.push(`${formatNumber(rest, { maximumFractionDigits: 3 })}ms`);
  const text = parts.join(' ');
  return ms < 0 ? `-${text}` : text;
}

export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms)) return NO_VALUE;
  if (ms <= 0) return '0 ms';
  const wholeMs = Math.round(ms);
  if (wholeMs < 1000) return `${formatNumber(wholeMs)} ms`;
  const seconds = roundTo(ms / 1000, 1);
  if (seconds < 60) {
    return `${formatNumber(seconds, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
  }
  const totalSeconds = Math.max(60, Math.floor(ms / 1000));
  const totalMinutes = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (totalMinutes < 60) return s > 0 ? `${totalMinutes} m ${s} s` : `${totalMinutes} m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${formatNumber(h)} h ${m} m` : `${formatNumber(h)} h`;
}

function toDate(value: DateInput): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export type DateTimeStyle = 'short' | 'medium';

export function formatDateTime(value: DateInput, timeStyle: DateTimeStyle = 'short'): string {
  const d = toDate(value);
  if (!d) return String(value);
  return dateFormat({ dateStyle: 'medium', timeStyle }).format(d);
}

export function formatDate(value: DateInput, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const d = toDate(value);
  if (!d) return String(value);
  return dateFormat(options).format(d);
}

export function formatTime(value: DateInput, options: { seconds?: boolean; milliseconds?: boolean } = {}): string {
  const d = toDate(value);
  if (!d) return String(value);
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  if (options.seconds || options.milliseconds) opts.second = '2-digit';
  if (options.milliseconds) opts.fractionalSecondDigits = 3;
  return dateFormat(opts).format(d);
}

export function formatLocalTime(value: unknown): string {
  const minutes = parseLocalTime(value);
  if (minutes === null) return String(value);
  if (minutes === MINUTES_PER_DAY) return i18n.t('field.endOfDay', 'End of day');
  const utc = Date.UTC(1970, 0, 1, Math.floor(minutes / MINUTES_PER_HOUR), minutes % MINUTES_PER_HOUR);
  return dateFormat({ timeStyle: 'short', timeZone: 'UTC' }).format(utc);
}

export function formatIntervalEnd(value: unknown): string {
  return parseLocalTime(value) === MINUTES_PER_DAY ? i18n.t('field.midnight', 'midnight') : formatLocalTime(value);
}

export function formatLocalDate(value: unknown, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const date = parseLocalDate(value);
  if (!date) return String(value);
  return dateFormat({ ...options, timeZone: 'UTC' }).format(localDateToUtcDate(date));
}

const FIRST_MONDAY_OF_EPOCH = 5;
const ZERO_OFFSET = /^GMT([+-]00:?00)?$/;

export function formatWeekday(day: Weekday, weekday: 'narrow' | 'short' | 'long' = 'long'): string {
  const offset = WEEKDAYS.indexOf(day);
  return dateFormat({ weekday, timeZone: 'UTC' }).format(Date.UTC(1970, 0, FIRST_MONDAY_OF_EPOCH + offset));
}

const offsetFormats = new Map<string, Intl.DateTimeFormat>();

export function formatUtcOffset(timeZone: string, at: Date): string | null {
  try {
    let fmt = offsetFormats.get(timeZone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
      offsetFormats.set(timeZone, fmt);
    }
    const name = fmt.formatToParts(at).find((part) => part.type === 'timeZoneName')?.value;
    if (!name) return null;
    return ZERO_OFFSET.test(name) ? 'UTC' : name.replace(/^GMT/, 'UTC');
  } catch {
    return null;
  }
}

export interface LocaleClock {
  hour12: boolean;
  am: string;
  pm: string;
  meridiemFirst: boolean;
}

function dayPeriod(parts: Intl.DateTimeFormatPart[]): string | undefined {
  return parts.find((part) => part.type === 'dayPeriod')?.value;
}

export function localeClock(): LocaleClock {
  const fmt = dateFormat({ hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  const { hourCycle } = fmt.resolvedOptions();
  const morning = fmt.formatToParts(Date.UTC(1970, 0, 1, 1));
  const evening = fmt.formatToParts(Date.UTC(1970, 0, 1, 13));
  const periodIndex = morning.findIndex((part) => part.type === 'dayPeriod');
  return {
    hour12: hourCycle === 'h11' || hourCycle === 'h12',
    am: dayPeriod(morning) ?? 'AM',
    pm: dayPeriod(evening) ?? 'PM',
    meridiemFirst: periodIndex >= 0 && periodIndex < morning.findIndex((part) => part.type === 'hour'),
  };
}

const listFormats = new Map<string, Intl.ListFormat>();

export function formatList(
  items: readonly string[],
  type: 'conjunction' | 'disjunction' | 'unit' = 'conjunction',
): string {
  const locale = getFormatLocale();
  const key = `${locale}|${type}`;
  let fmt = listFormats.get(key);
  if (!fmt) {
    fmt = new Intl.ListFormat(locale, { style: 'long', type });
    listFormats.set(key, fmt);
  }
  return fmt.format(items);
}
