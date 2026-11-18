/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { queryOptions, useQuery } from '@tanstack/react-query';
import { jmapKeys, type ListPageParams } from '@/data/keys';
import { fetchBlobText, jmapGetOne, jmapQueryAndGet, type JmapObject } from '@/services/jmap/client';

export interface ListPage {
  ids: string[];
  list: JmapObject[];
  total: number | null;
  position: number;
}

interface QueryTuning {
  enabled?: boolean;
  accountId?: string;
  staleTime?: number;
  refetchOnMount?: boolean | 'always';
}

export function jmapObjectQuery(objectName: string, id: string, properties?: string[], accountId?: string) {
  return queryOptions({
    queryKey: jmapKeys.object(objectName, id, properties, accountId),
    queryFn: ({ signal }) => jmapGetOne(objectName, id, properties, { signal, accountId }),
    staleTime: 0,
  });
}

export function useJmapObject(
  objectName: string | null | undefined,
  id: string | null | undefined,
  properties?: string[],
  tuning: QueryTuning = {},
) {
  return useQuery({
    ...jmapObjectQuery(objectName ?? '', id ?? '', properties, tuning.accountId),
    enabled: !!objectName && !!id && (tuning.enabled ?? true),
    staleTime: tuning.staleTime ?? 0,
    refetchOnMount: tuning.refetchOnMount ?? true,
  });
}

export function jmapListQuery(objectName: string, params: ListPageParams) {
  const { properties, ...query } = params;
  return queryOptions({
    queryKey: jmapKeys.list(objectName, params),
    staleTime: 0,
    queryFn: async ({ signal }): Promise<ListPage> => {
      const result = await jmapQueryAndGet(objectName, query, properties, { signal });
      const byId = new Map(result.list.map((item) => [item.id as string, item]));
      const ordered = result.query.ids.map((id) => byId.get(id)).filter((item): item is JmapObject => !!item);
      return {
        ids: result.query.ids,
        list: ordered,
        total: typeof result.query.total === 'number' ? result.query.total : null,
        position: result.query.position ?? 0,
      };
    },
  });
}

export function useJmapList(
  objectName: string | null | undefined,
  params: ListPageParams,
  tuning: QueryTuning & { keepPrevious?: boolean } = {},
) {
  return useQuery({
    ...jmapListQuery(objectName ?? '', params),
    enabled: !!objectName && (tuning.enabled ?? true),
    staleTime: tuning.staleTime ?? 0,
    placeholderData: tuning.keepPrevious ? (previous) => previous : undefined,
  });
}

export function useBlobText(blobId: string | null | undefined) {
  return useQuery({
    queryKey: jmapKeys.blob(blobId ?? ''),
    queryFn: ({ signal }) => fetchBlobText(blobId!, { signal }),
    enabled: !!blobId,
    staleTime: Infinity,
  });
}
