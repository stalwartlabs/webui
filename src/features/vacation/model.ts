/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { MINUTES_PER_HOUR } from '@/lib/localDateTime';
import type { FieldErrors, FieldValues } from '@/components/forms/formLogic';

export const SUBJECT_MAX_BYTES = 511;
export const BODY_MAX_BYTES = 2047;
export const DEFAULT_VACATION_TEXT = 'I am away.';

const START_OF_DAY_MINUTES = 0;
const END_OF_DAY_MINUTES = 23 * MINUTES_PER_HOUR + 59;
const LAST_SECOND = 59;
const MS_PER_SECOND = 1000;

export type RangeEdge = 'start' | 'end';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export type VacationStatus =
  | { kind: 'off' }
  | { kind: 'invalidRange' }
  | { kind: 'active'; until: Date | null }
  | { kind: 'scheduled'; from: Date; until: Date | null }
  | { kind: 'ended'; at: Date };

export interface VacationPreview {
  subject: string | null;
  text: string | null;
  html: string | null;
  textFromHtml: boolean;
}

export interface VacationMessages {
  tooLong: (limit: number) => string;
  endBeforeStart: string;
}

const utf8 = new TextEncoder();

export function utf8Length(text: string): number {
  return utf8.encode(text).length;
}

export function parseUtcDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function utcDateValue(date: Date | null): string | null {
  return date ? date.toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
}

export function rangeOf(data: FieldValues): DateRange {
  return { from: parseUtcDate(data.fromDate), to: parseUtcDate(data.toDate) };
}

export function localMinutes(date: Date): number {
  return date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
}

export function atLocalTime(day: Date, minutes: number, edge: RangeEdge): Date {
  const next = new Date(day);
  next.setHours(
    Math.floor(minutes / MINUTES_PER_HOUR),
    minutes % MINUTES_PER_HOUR,
    edge === 'end' ? LAST_SECOND : 0,
    0,
  );
  return next;
}

function defaultMinutes(edge: RangeEdge): number {
  return edge === 'start' ? START_OF_DAY_MINUTES : END_OF_DAY_MINUTES;
}

function onDay(day: Date, current: Date | null, edge: RangeEdge): Date {
  return atLocalTime(day, current ? localMinutes(current) : defaultMinutes(edge), edge);
}

export function pickRangeDay(range: DateRange, day: Date, edge: RangeEdge): DateRange {
  if (edge === 'start') {
    const from = onDay(day, range.from, 'start');
    if (!range.to || range.to >= from) return { from, to: range.to };
    const to = onDay(day, range.to, 'end');
    return { from, to: to >= from ? to : atLocalTime(day, END_OF_DAY_MINUTES, 'end') };
  }
  const to = onDay(day, range.to, 'end');
  if (!range.from || range.from <= to) return { from: range.from, to };
  const from = onDay(day, range.from, 'start');
  return { from: from <= to ? from : atLocalTime(day, START_OF_DAY_MINUTES, 'start'), to };
}

export function isRangeInverted({ from, to }: DateRange): boolean {
  return from !== null && to !== null && from > to;
}

export function vacationStatus(data: FieldValues, now: Date): VacationStatus {
  if (data.isEnabled !== true) return { kind: 'off' };
  const range = rangeOf(data);
  if (isRangeInverted(range)) return { kind: 'invalidRange' };
  if (range.to && now > range.to) return { kind: 'ended', at: range.to };
  if (range.from && now < range.from) return { kind: 'scheduled', from: range.from, until: range.to };
  return { kind: 'active', until: range.to };
}

const STATUS_FIELDS = ['isEnabled', 'fromDate', 'toDate'] as const;

export function hasUnsavedStatus(data: FieldValues, baseline: unknown): boolean {
  if (typeof baseline !== 'object' || baseline === null) return false;
  const saved = baseline as FieldValues;
  return STATUS_FIELDS.some((name) => (data[name] ?? null) !== (saved[name] ?? null));
}

export function nextStatusChange(status: VacationStatus): Date | null {
  switch (status.kind) {
    case 'scheduled':
      return status.from;
    case 'active':
      return status.until ? new Date(status.until.getTime() + MS_PER_SECOND) : null;
    default:
      return null;
  }
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

const BYTE_LIMITS: readonly (readonly [string, number])[] = [
  ['subject', SUBJECT_MAX_BYTES],
  ['textBody', BODY_MAX_BYTES],
  ['htmlBody', BODY_MAX_BYTES],
];

export function validateVacation(data: FieldValues, messages: VacationMessages): FieldErrors {
  const errors: FieldErrors = {};
  for (const [name, limit] of BYTE_LIMITS) {
    const value = data[name];
    if (typeof value === 'string' && utf8Length(value) > limit) errors[name] = messages.tooLong(limit);
  }
  if (isRangeInverted(rangeOf(data))) errors.fromDate = messages.endBeforeStart;
  return errors;
}

const BLOCK_ELEMENTS = 'p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote, pre, table, ul, ol';
const HIDDEN_ELEMENTS = 'style, script, template, noscript, title';

export function htmlToText(html: string): string {
  const { body } = new DOMParser().parseFromString(html, 'text/html');
  for (const hidden of body.querySelectorAll(HIDDEN_ELEMENTS)) hidden.remove();
  for (const br of body.querySelectorAll('br')) br.replaceWith('\n');
  for (const block of body.querySelectorAll(BLOCK_ELEMENTS)) block.append('\n\n');
  return (body.textContent ?? '')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const PREVIEW_CSP =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: cid:; style-src \'unsafe-inline\'; font-src data:">';
const LEADING_DOCTYPE = /^\s*<!doctype[^>]*>/i;

export function previewDocument(html: string): string {
  return LEADING_DOCTYPE.test(html)
    ? html.replace(LEADING_DOCTYPE, (doctype) => doctype + PREVIEW_CSP)
    : PREVIEW_CSP + html;
}

export function vacationPreview(data: FieldValues): VacationPreview {
  const text = nonEmpty(data.textBody);
  const html = nonEmpty(data.htmlBody);
  return {
    subject: nonEmpty(data.subject)?.replace(/[\r\n]/g, '') ?? null,
    text: text ?? (html ? null : DEFAULT_VACATION_TEXT),
    html,
    textFromHtml: text === null && html !== null,
  };
}
