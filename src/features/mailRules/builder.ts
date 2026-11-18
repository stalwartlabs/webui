/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { isRecord, isMultilineFormat } from '@/lib/embeddedSchema';
import type { Field } from '@/types/schema';

export type ListItems = Record<string, Record<string, unknown>>;

export const MAILBOX_FIELD = 'mailboxId';
export const MAILBOX_SCHEMA = 'x:MailRuleMailbox';

export function listEntries(value: unknown): [string, Record<string, unknown>][] {
  if (!isRecord(value)) return [];
  const entries: [string, Record<string, unknown>][] = [];
  for (const [key, item] of Object.entries(value)) {
    if (isRecord(item)) entries.push([key, item]);
  }
  return entries.sort(([a], [b]) => Number(a) - Number(b));
}

export function appendItem(value: unknown, item: Record<string, unknown>): ListItems {
  const entries = listEntries(value);
  const next = entries.reduce((max, [key]) => Math.max(max, (Number(key) || 0) + 1), 0);
  return { ...Object.fromEntries(entries), [String(next)]: item };
}

export function replaceItem(value: unknown, key: string, item: Record<string, unknown>): ListItems {
  return { ...Object.fromEntries(listEntries(value)), [key]: item };
}

export function removeItem(value: unknown, key: string): ListItems {
  return Object.fromEntries(listEntries(value).filter(([k]) => k !== key));
}

export function isInlineField(field: Field): boolean {
  const { type } = field;
  switch (type.type) {
    case 'enum':
    case 'number':
    case 'utcDateTime':
      return true;
    case 'string':
      return !isMultilineFormat(type.format) && type.format !== 'secret' && type.format !== 'secretText';
    default:
      return false;
  }
}
