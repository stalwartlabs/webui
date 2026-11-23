/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { isRecord, isMultilineFormat } from '@/lib/embeddedSchema';
import type { Field } from '@/types/schema';
import { FLAG_ACTIONS, setValues, type FlagAction, type KeywordSet } from './model';

export type ListItems = Record<string, Record<string, unknown>>;

export const KEYWORDS_FIELD = 'keywords';
export const KEYWORD_TEST_SCHEMA = 'x:MailRuleKeywordTest';

const TIME_ZONE_ENUM = 'TimeZone';

export function toSet(keys: readonly string[]): Record<string, true> {
  return Object.fromEntries(keys.map((key) => [key, true]));
}

const IMAP_FLAG_PREFIX = '\\';
const JMAP_KEYWORD_PREFIX = '$';

const SYSTEM_KEYWORD_NAMES: ReadonlySet<string> = new Set([
  'seen',
  'draft',
  'flagged',
  'answered',
  'recent',
  'important',
  'phishing',
  'junk',
  'notjunk',
  'deleted',
  'forwarded',
  'mdnsent',
  'autosent',
  'canunsubscribe',
  'followed',
  'hasattachment',
  'hasmemo',
  'hasnoattachment',
  'imported',
  'istrusted',
  'mailflagbit0',
  'mailflagbit1',
  'mailflagbit2',
  'maskedemail',
  'memo',
  'muted',
  'new',
  'notify',
  'unsubscribed',
]);

export function canonicalKeyword(typed: string): string {
  const keyword = typed.toLowerCase();
  if (!keyword.startsWith(IMAP_FLAG_PREFIX)) return keyword;
  const name = keyword.slice(IMAP_FLAG_PREFIX.length);
  return SYSTEM_KEYWORD_NAMES.has(name) ? `${JMAP_KEYWORD_PREFIX}${name}` : keyword;
}

export function editKeywords(value: unknown, shown: readonly string[], next: readonly string[]): Record<string, true> {
  const before = new Set(shown);
  const after = new Set(next);
  const kept = setValues(value).filter((keyword) => !before.has(keyword) || after.has(keyword));
  const added = next.filter((keyword) => !before.has(keyword)).map(canonicalKeyword);
  return toSet([...kept, ...added]);
}

export function setFlag(actions: Record<string, unknown>, flag: FlagAction, on: boolean): Record<string, unknown> {
  const { set, keyword } = FLAG_ACTIONS[flag];
  const opposite: KeywordSet = set === 'addKeywords' ? 'removeKeywords' : 'addKeywords';
  const others = setValues(actions[set]).filter((key) => key !== keyword);
  const next = { ...actions, [set]: toSet(on ? [...others, keyword] : others) };
  const conflicting = setValues(actions[opposite]);
  if (!on || !conflicting.includes(keyword)) return next;
  return { ...next, [opposite]: toSet(conflicting.filter((key) => key !== keyword)) };
}

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
      return type.enumName !== TIME_ZONE_ENUM;
    case 'number':
    case 'utcDateTime':
      return true;
    case 'string':
      return !isMultilineFormat(type.format) && type.format !== 'secret' && type.format !== 'secretText';
    default:
      return false;
  }
}
