/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { SIZE_UNITS } from '@/lib/durationFormat';
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
