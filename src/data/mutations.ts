/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { jmapKeys } from '@/data/keys';
import {
  jmapQueryAll,
  jmapSet,
  type BlobUpload,
  type JmapObject,
  type JmapQueryOptions,
  type JmapSetOptions,
} from '@/services/jmap/client';
import { destroyedOutcome, errorMessage, updatedOutcome, type SetOutcome } from '@/lib/jmapErrors';
import { isAbortError } from '@/services/errors';
import { useAuthStore } from '@/stores/authStore';
import type { JmapSetResponse } from '@/types/jmap';

export interface SetVariables extends JmapSetOptions {
  blobs?: Record<string, BlobUpload>;
  accountId?: string;
}

export type BulkTarget = { ids: string[] } | { query: JmapQueryOptions };

export type BulkVariables = (
  | (BulkTarget & ({ action: 'destroy' } | { action: 'update'; patch: JmapObject }))
  | { action: 'updateEach'; patches: Record<string, JmapObject> }
) & { accountId?: string };

async function bulkIds(objectName: string, vars: BulkVariables, signal?: AbortSignal): Promise<string[]> {
  if (vars.action === 'updateEach') return Object.keys(vars.patches);
  if ('ids' in vars) return vars.ids;
  return jmapQueryAll(objectName, vars.query, { accountId: vars.accountId, signal });
}

function isListOf(key: QueryKey, objectName: string): boolean {
  return key[1] === objectName && key[2] === 'list';
}

export async function invalidateObjectType(client: QueryClient, objectName: string): Promise<void> {
  client.removeQueries({ queryKey: jmapKeys.lists(objectName), type: 'inactive' });
  await Promise.all([
    client.invalidateQueries({ queryKey: jmapKeys.lists(objectName), refetchType: 'active' }),
    client.invalidateQueries({
      queryKey: objectName.startsWith('x:') ? jmapKeys.all : jmapKeys.type(objectName),
      predicate: (query) => !isListOf(query.queryKey, objectName),
    }),
  ]);
}

export function useJmapSet(objectName: string | null | undefined) {
  const client = useQueryClient();
  return useMutation<JmapSetResponse, Error, SetVariables>({
    mutationFn: ({ blobs, accountId, ...set }) => {
      if (!objectName) throw new Error('No object type to update');
      return jmapSet(objectName, set, { blobs, accountId });
    },
    onSettled: () => {
      if (objectName) return invalidateObjectType(client, objectName);
    },
  });
}

export async function runBulkSet(objectName: string, vars: BulkVariables, signal?: AbortSignal): Promise<SetOutcome> {
  const ids = await bulkIds(objectName, vars, signal);
  const { accountId } = vars;
  const batchSize = Math.max(1, useAuthStore.getState().maxObjectsInSet);
  const outcome: SetOutcome = { succeeded: [], failed: {} };
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    signal?.throwIfAborted();
    const batch = ids.slice(offset, offset + batchSize);
    let partial: SetOutcome;
    try {
      if (vars.action === 'destroy') {
        partial = destroyedOutcome(await jmapSet(objectName, { destroy: batch }, { accountId, signal }));
      } else {
        const update: Record<string, JmapObject> = {};
        for (const id of batch) update[id] = vars.action === 'updateEach' ? vars.patches[id] : vars.patch;
        partial = updatedOutcome(await jmapSet(objectName, { update }, { accountId, signal }));
      }
    } catch (err) {
      const aborted = isAbortError(err);
      if (aborted && outcome.succeeded.length === 0) throw err;
      const failure = { type: 'serverFail', description: errorMessage(err) };
      for (const id of aborted ? ids.slice(offset) : batch) outcome.failed[id] = failure;
      if (aborted) break;
      continue;
    }
    outcome.succeeded.push(...partial.succeeded);
    Object.assign(outcome.failed, partial.failed);
  }
  return outcome;
}

export function useJmapBulkSet(objectName: string | null | undefined) {
  const client = useQueryClient();
  return useMutation<SetOutcome, Error, BulkVariables>({
    mutationFn: (vars) => {
      if (!objectName) throw new Error('No object type to update');
      return runBulkSet(objectName, vars);
    },
    onSettled: () => {
      if (objectName) return invalidateObjectType(client, objectName);
    },
  });
}
