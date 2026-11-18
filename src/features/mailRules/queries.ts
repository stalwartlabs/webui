/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jmapKeys } from '@/data/keys';
import { invalidateObjectType } from '@/data/mutations';
import { errorMessage } from '@/lib/jmapErrors';
import { jmapGet, jmapSet } from '@/services/jmap/client';
import { useAuthStore } from '@/stores/authStore';
import { buildMailboxOptions, MAILBOX_PROPERTIES, type MailboxOption } from './mailboxes';
import { MAIL_RULE_OBJECT, parseMailRules } from './model';
import {
  ADDRESS_PROPERTY,
  mergeCreateOutcomes,
  parseSenderEntries,
  senderCreateOutcome,
  senderCreates,
  type SenderCreateOutcome,
} from './senders';

const MAILBOX_OBJECT = 'Mailbox';
const MAILBOX_STALE_MS = 60_000;

export function mailRulesKey(accountId: string) {
  return [...jmapKeys.type(MAIL_RULE_OBJECT), 'rules', accountId] as const;
}

export function mailboxOptionsKey(accountId: string) {
  return [...jmapKeys.type(MAILBOX_OBJECT), 'mailRuleOptions', accountId] as const;
}

export async function fetchMailRules(accountId: string, signal?: AbortSignal) {
  const result = await jmapGet(MAIL_RULE_OBJECT, null, undefined, { accountId, signal });
  return parseMailRules(result.list ?? []);
}

export function useMailRules(accountId: string | null | undefined) {
  return useQuery({
    queryKey: mailRulesKey(accountId ?? ''),
    queryFn: ({ signal }) => fetchMailRules(accountId!, signal),
    enabled: !!accountId,
    staleTime: 0,
  });
}

export function canReadMailboxes(
  accountId: string | null | undefined,
  sessionAccounts: Readonly<Record<string, unknown>>,
): accountId is string {
  return !!accountId && Object.hasOwn(sessionAccounts, accountId);
}

export async function fetchMailboxOptions(accountId: string, signal?: AbortSignal): Promise<MailboxOption[]> {
  const result = await jmapGet(MAILBOX_OBJECT, null, MAILBOX_PROPERTIES, { accountId, signal });
  return buildMailboxOptions(result.list ?? []);
}

export type MailboxOptionsState =
  { status: 'loading' } | { status: 'ready'; options: MailboxOption[] } | { status: 'unavailable' };

export function useMailboxOptions(accountId: string | null | undefined): MailboxOptionsState {
  const sessionAccounts = useAuthStore((s) => s.accounts);
  const readable = canReadMailboxes(accountId, sessionAccounts);
  const query = useQuery({
    queryKey: mailboxOptionsKey(accountId ?? ''),
    queryFn: ({ signal }) => fetchMailboxOptions(accountId!, signal),
    enabled: readable,
    staleTime: MAILBOX_STALE_MS,
  });
  if (readable && query.data) return { status: 'ready', options: query.data };
  if (!readable || query.isError) return { status: 'unavailable' };
  return { status: 'loading' };
}

export function senderEntriesKey(objectName: string, accountId: string) {
  return [...jmapKeys.type(objectName), 'entries', accountId] as const;
}

export async function fetchSenderEntries(objectName: string, accountId: string, signal?: AbortSignal) {
  const result = await jmapGet(objectName, null, [ADDRESS_PROPERTY], { accountId, signal });
  return parseSenderEntries(result.list ?? []);
}

export function useSenderEntries(objectName: string, accountId: string | null | undefined) {
  return useQuery({
    queryKey: senderEntriesKey(objectName, accountId ?? ''),
    queryFn: ({ signal }) => fetchSenderEntries(objectName, accountId!, signal),
    enabled: !!accountId,
    staleTime: 0,
  });
}

export async function createSenderEntries(
  objectName: string,
  addresses: readonly string[],
  accountId: string,
): Promise<SenderCreateOutcome> {
  const batchSize = Math.max(1, useAuthStore.getState().maxObjectsInSet);
  const outcomes: SenderCreateOutcome[] = [];
  for (let offset = 0; offset < addresses.length; offset += batchSize) {
    const batch = addresses.slice(offset, offset + batchSize);
    try {
      const response = await jmapSet(objectName, { create: senderCreates(batch) }, { accountId });
      outcomes.push(senderCreateOutcome(batch, response));
    } catch (err) {
      if (outcomes.length === 0) throw err;
      const error = { type: 'serverFail', description: errorMessage(err) };
      outcomes.push({
        created: [],
        duplicates: [],
        failed: addresses.slice(offset).map((address) => ({ address, error })),
      });
      break;
    }
  }
  return mergeCreateOutcomes(outcomes);
}

export function useCreateSenderEntries(objectName: string) {
  const client = useQueryClient();
  return useMutation<SenderCreateOutcome, Error, { addresses: readonly string[]; accountId: string }>({
    mutationFn: ({ addresses, accountId }) => createSenderEntries(objectName, addresses, accountId),
    onSettled: () => invalidateObjectType(client, objectName),
  });
}
