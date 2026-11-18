/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { parseLocalDate, parseLocalTime } from '@/lib/localDateTime';
import type { ScalarTypeString, StringFormat } from '@/types/schema';

const LINE_SEPARATORS = /[\r\n]+/;
const LIST_SEPARATORS = /[\r\n,;]+/;
const LIST_FORMATS: ReadonlySet<StringFormat> = new Set([
  'emailAddress',
  'ipAddress',
  'ipNetwork',
  'socketAddress',
  'localTime',
  'localDate',
]);

const IPV4_OCTET = /^(?:0|[1-9]\d{0,2})$/;
const IPV6_GROUP = /^[0-9a-fA-F]{1,4}$/;
const IPV6_GROUPS = 8;
const IPV4_MAX_PREFIX = 32;
const IPV6_MAX_PREFIX = 128;
const MIN_PREFIX = 8;
const PREFIX = /^\+?\d+$/;
const EMAIL = /^[^\s@]+@[^\s@]+$/;

export interface SetEntriesResult {
  added: string[];
  duplicates: string[];
  invalid: string[];
  overLimit: string[];
}

export function splitEntries(text: string, format: StringFormat): string[] {
  const entries: string[] = [];
  for (const part of text.split(LIST_FORMATS.has(format) ? LIST_SEPARATORS : LINE_SEPARATORS)) {
    const entry = part.trim();
    if (entry) entries.push(entry);
  }
  return entries;
}

function canonicalIpv4(value: string): string | null {
  const octets = value.split('.');
  return octets.length === 4 && octets.every((octet) => IPV4_OCTET.test(octet) && Number(octet) <= 255) ? value : null;
}

function ipv6Groups(part: string): string[] {
  return part === '' ? [] : part.split(':');
}

function hexGroups(groups: readonly string[], ipv4: string | null): number[] | null {
  if (!groups.every((group) => IPV6_GROUP.test(group))) return null;
  const values = groups.map((group) => parseInt(group, 16));
  if (ipv4) {
    const [a, b, c, d] = ipv4.split('.').map(Number);
    values.push(a * 256 + b, c * 256 + d);
  }
  return values;
}

function canonicalIpv6(value: string): string | null {
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const compressed = halves.length === 2;
  const head = ipv6Groups(halves[0]);
  const tail = compressed ? ipv6Groups(halves[1]) : [];
  const trailing = compressed ? tail : head;
  let ipv4: string | null = null;
  if (trailing.at(-1)?.includes('.')) {
    ipv4 = canonicalIpv4(trailing.pop() ?? '');
    if (!ipv4) return null;
  }
  const headValues = hexGroups(head, compressed ? null : ipv4);
  const tailValues = hexGroups(tail, compressed ? ipv4 : null);
  if (!headValues || !tailValues) return null;
  const count = headValues.length + tailValues.length;
  if (compressed ? count >= IPV6_GROUPS : count !== IPV6_GROUPS) return null;
  const zeros = new Array<number>(IPV6_GROUPS - count).fill(0);
  return [...headValues, ...zeros, ...tailValues].map((group) => group.toString(16)).join(':');
}

function canonicalIp(value: string): string | null {
  return canonicalIpv4(value) ?? canonicalIpv6(value);
}

function canonicalIpNetwork(value: string): string | null {
  const slash = value.lastIndexOf('/');
  if (slash < 0) return canonicalIp(value);
  const prefix = value.slice(slash + 1).trim();
  if (!PREFIX.test(prefix)) return null;
  const address = value.slice(0, slash).trim();
  const bits = Number(prefix);
  const v4 = canonicalIpv4(address);
  const canonical = v4 ?? canonicalIpv6(address);
  const maxPrefix = v4 ? IPV4_MAX_PREFIX : IPV6_MAX_PREFIX;
  if (!canonical || bits < MIN_PREFIX || bits > maxPrefix) return null;
  return bits === maxPrefix ? canonical : `${canonical}/${bits}`;
}

export function isValidStringValue(type: ScalarTypeString, value: string): boolean {
  if (type.minLength != null && value.length < type.minLength) return false;
  if (type.maxLength != null && value.length > type.maxLength) return false;
  switch (type.format) {
    case 'emailAddress':
      return EMAIL.test(value);
    case 'ipAddress':
      return canonicalIp(value) !== null;
    case 'ipNetwork':
      return canonicalIpNetwork(value) !== null;
    case 'localTime':
      return parseLocalTime(value) !== null;
    case 'localDate':
      return parseLocalDate(value) !== null;
    default:
      return true;
  }
}

function dedupeKey(format: StringFormat, value: string): string {
  switch (format) {
    case 'emailAddress':
      return value.toLowerCase();
    case 'ipAddress':
      return canonicalIp(value) ?? value;
    case 'ipNetwork':
      return canonicalIpNetwork(value) ?? value;
    default:
      return value;
  }
}

export function joinEntries(entries: readonly string[], format: StringFormat): string | null {
  if (entries.length <= 1) return entries[0] ?? '';
  return LIST_FORMATS.has(format) ? entries.join(', ') : null;
}

export function addSetEntries(
  existing: readonly string[],
  entries: readonly string[],
  type: ScalarTypeString,
  maxItems?: number,
): SetEntriesResult {
  const result: SetEntriesResult = { added: [], duplicates: [], invalid: [], overLimit: [] };
  const seen = new Set(existing.map((item) => dedupeKey(type.format, item)));
  for (const entry of entries) {
    const key = dedupeKey(type.format, entry);
    if (seen.has(key)) result.duplicates.push(entry);
    else if (!isValidStringValue(type, entry)) result.invalid.push(entry);
    else if (maxItems != null && existing.length + result.added.length >= maxItems) result.overLimit.push(entry);
    else {
      seen.add(key);
      result.added.push(entry);
    }
  }
  return result;
}
