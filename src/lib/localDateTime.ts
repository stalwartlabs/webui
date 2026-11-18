/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const LOCAL_TIME = /^(\d{2}):(\d{2})$/;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

export interface LocalDate {
  year: number;
  month: number;
  day: number;
}

export function parseLocalTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = LOCAL_TIME.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 24 && minutes < MINUTES_PER_HOUR) return hours * MINUTES_PER_HOUR + minutes;
  return hours === 24 && minutes === 0 ? MINUTES_PER_DAY : null;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export function localTimeFromMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / MINUTES_PER_HOUR), 2)}:${pad(minutes % MINUTES_PER_HOUR, 2)}`;
}

export type Meridiem = 'am' | 'pm';

export const HOURS_PER_HALF_DAY = 12;

export function hour12Of(hours: number): number {
  return hours % HOURS_PER_HALF_DAY || HOURS_PER_HALF_DAY;
}

export function meridiemOf(hours: number): Meridiem {
  return hours >= HOURS_PER_HALF_DAY ? 'pm' : 'am';
}

export function hours24From(hour12: number, meridiem: Meridiem): number {
  return (hour12 % HOURS_PER_HALF_DAY) + (meridiem === 'pm' ? HOURS_PER_HALF_DAY : 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function parseLocalDate(value: unknown): LocalDate | null {
  if (typeof value !== 'string') return null;
  const match = LOCAL_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) return null;
  return day >= 1 && day <= daysInMonth(year, month) ? { year, month, day } : null;
}

export function formatLocalDateValue({ year, month, day }: LocalDate): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function localDateToCalendarDate({ year, month, day }: LocalDate): Date {
  const date = new Date(2000, month - 1, day);
  date.setFullYear(year);
  return date;
}

export function localDateFromCalendarDate(date: Date): LocalDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function localDateToUtcDate({ year, month, day }: LocalDate): Date {
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date;
}
