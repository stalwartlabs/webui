/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { JmapQueryOptions } from '@/services/jmap/client';

export interface ListPageParams extends JmapQueryOptions {
  properties?: string[];
}

export const jmapKeys = {
  all: ['jmap'] as const,
  type: (objectName: string) => ['jmap', objectName] as const,
  objects: (objectName: string) => ['jmap', objectName, 'object'] as const,
  object: (objectName: string, id: string, properties?: readonly string[], accountId?: string) =>
    ['jmap', objectName, 'object', id, properties ? [...properties].sort() : null, accountId ?? null] as const,
  lists: (objectName: string) => ['jmap', objectName, 'list'] as const,
  list: (objectName: string, params: ListPageParams) => ['jmap', objectName, 'list', params] as const,
  allOptions: (objectName: string) => ['jmap', objectName, 'options'] as const,
  options: (objectName: string, viewName: string, tenantId: string | null = null) =>
    ['jmap', objectName, 'options', viewName, tenantId] as const,
  displayNames: (objectName: string) => ['jmap', objectName, 'displayName'] as const,
  displayName: (objectName: string, displayProperty: string, id: string) =>
    ['jmap', objectName, 'displayName', displayProperty, id] as const,
  blob: (blobId: string) => ['jmap', 'Blob', 'object', blobId] as const,
};

export const sessionKeys = {
  init: ['session', 'init'] as const,
};
