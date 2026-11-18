/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { JmapObject } from '@/services/jmap/client';
import type { JmapSetError, JmapSetResponse } from '@/types/jmap';

export const BLOCKED_SENDER_OBJECT = 'x:BlockedSender';
export const SAFE_SENDER_OBJECT = 'x:SafeSender';
export const ADDRESS_PROPERTY = 'address';
export const MAX_SENDER_ENTRIES = 1024;
export const MAX_ENTRY_LENGTH = 255;

const SEPARATORS = /[\s,;]+/;
const WRAPPERS = /^[<("']+|[>)"'.]+$/g;
const MAILTO = /^mailto:/i;
const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;
const LOCAL_PART = /^[^\s\p{Cc}@<>()[\]\\,;:"]+$/u;

export interface SenderEntry {
  id: string;
  address: string;
}

export interface SenderPlan {
  added: string[];
  duplicates: string[];
  invalid: string[];
  overLimit: string[];
}

export interface SenderCreateOutcome {
  created: string[];
  duplicates: string[];
  failed: { address: string; error: JmapSetError }[];
}

function isDomain(value: string): boolean {
  const labels = value.split('.');
  return labels.length >= 2 && labels.every((label) => LABEL.test(label));
}

export function normalizeSender(raw: string): string | null {
  const value = raw.trim().replace(MAILTO, '').replace(WRAPPERS, '').toLowerCase();
  if (value === '' || value.length > MAX_ENTRY_LENGTH) return null;
  const at = value.lastIndexOf('@');
  if (at < 0) return isDomain(value) ? `@${value}` : null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!isDomain(domain)) return null;
  if (local === '') return value;
  return LOCAL_PART.test(local) ? value : null;
}

export function splitSenders(text: string): string[] {
  return text.split(SEPARATORS).filter((part) => part !== '');
}

export function planSenders(existing: readonly string[], text: string, limit = MAX_SENDER_ENTRIES): SenderPlan {
  const plan: SenderPlan = { added: [], duplicates: [], invalid: [], overLimit: [] };
  const seen = new Set(existing);
  for (const raw of splitSenders(text)) {
    const value = normalizeSender(raw);
    if (value === null) plan.invalid.push(raw);
    else if (seen.has(value)) plan.duplicates.push(value);
    else if (existing.length + plan.added.length >= limit) plan.overLimit.push(value);
    else {
      seen.add(value);
      plan.added.push(value);
    }
  }
  return plan;
}

export function parseSenderEntries(list: readonly JmapObject[]): SenderEntry[] {
  const entries: SenderEntry[] = [];
  for (const raw of list) {
    const address = raw[ADDRESS_PROPERTY];
    if (typeof raw.id === 'string' && typeof address === 'string') entries.push({ id: raw.id, address });
  }
  return entries.sort((a, b) => a.address.localeCompare(b.address));
}

export function filterSenders(entries: readonly SenderEntry[], search: string): readonly SenderEntry[] {
  const needle = search.trim().toLowerCase();
  return needle === '' ? entries : entries.filter((entry) => entry.address.includes(needle));
}

export function senderCreates(addresses: readonly string[]): Record<string, JmapObject> {
  const create: Record<string, JmapObject> = {};
  addresses.forEach((address, index) => {
    create[`s${index}`] = { [ADDRESS_PROPERTY]: address };
  });
  return create;
}

export function senderCreateOutcome(addresses: readonly string[], response: JmapSetResponse): SenderCreateOutcome {
  const outcome: SenderCreateOutcome = { created: [], duplicates: [], failed: [] };
  addresses.forEach((address, index) => {
    const key = `s${index}`;
    const error = response.notCreated?.[key];
    if (response.created?.[key]) outcome.created.push(address);
    else if (error?.type === 'alreadyExists') outcome.duplicates.push(address);
    else outcome.failed.push({ address, error: error ?? { type: 'serverFail' } });
  });
  return outcome;
}

export function mergeCreateOutcomes(outcomes: readonly SenderCreateOutcome[]): SenderCreateOutcome {
  const merged: SenderCreateOutcome = { created: [], duplicates: [], failed: [] };
  for (const outcome of outcomes) {
    merged.created.push(...outcome.created);
    merged.duplicates.push(...outcome.duplicates);
    merged.failed.push(...outcome.failed);
  }
  return merged;
}
