/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useAuthStore, type AuthState } from '@/stores/authStore';
import type { Edition } from '@/stores/accountStore';
import { apiFetchJson } from '@/services/api';
import { JmapMethodError, JmapProtocolError } from '@/services/errors';
import { logJmapExchange } from '@/lib/debug';
import type {
  JmapGetResponse,
  JmapMethodCall,
  JmapMethodResponse,
  JmapQueryResponse,
  JmapResponse,
  JmapSetResponse,
} from '@/types/jmap';
import type { Schema } from '@/types/schema';

export const MANAGEMENT_CAPABILITY = 'urn:stalwart:jmap';

const JMAP_USING = [
  'urn:ietf:params:jmap:core',
  MANAGEMENT_CAPABILITY,
  'urn:ietf:params:jmap:blob',
  'urn:ietf:params:jmap:mail',
  'urn:ietf:params:jmap:calendars',
  'urn:ietf:params:jmap:contacts',
  'urn:ietf:params:jmap:principals',
  'urn:ietf:params:jmap:sieve',
  'urn:ietf:params:jmap:vacationresponse',
];

const MAX_QUERY_PAGES = 1000;

export type JmapObject = Record<string, unknown>;

export interface JmapCallOptions {
  accountId?: string;
  signal?: AbortSignal;
}

export interface JmapQueryOptions {
  filter?: Record<string, unknown>;
  sort?: Record<string, unknown>[];
  limit?: number;
  position?: number;
  anchor?: string;
  anchorOffset?: number;
  calculateTotal?: boolean;
}

export interface JmapSetOptions {
  create?: Record<string, JmapObject>;
  update?: Record<string, JmapObject>;
  destroy?: string[];
}

export interface BlobUpload {
  data: string;
  type?: string;
}

export type AccountSelection = Pick<AuthState, 'accounts' | 'primaryAccountId' | 'activeAccountId'>;

export function resolveAccountId(objectType: string, selection: AccountSelection): string | null {
  const { accounts, primaryAccountId, activeAccountId } = selection;
  if (!objectType.startsWith('x:')) return activeAccountId;
  if (activeAccountId && Object.hasOwn(accounts, activeAccountId) && accounts[activeAccountId].hasManagement) {
    return activeAccountId;
  }
  return primaryAccountId;
}

export function getAccountId(objectType: string): string {
  const accountId = resolveAccountId(objectType, useAuthStore.getState());
  if (!accountId) throw new Error(`No account ID available for ${objectType}`);
  return accountId;
}

export function jmapApiPath(apiUrl: string | null): string {
  const path = apiUrl || '/jmap';
  if (!path.startsWith('http://') && !path.startsWith('https://')) return path;
  try {
    return new URL(path).pathname;
  } catch {
    return '/jmap';
  }
}

export function methodResult<T = JmapObject>(responses: JmapMethodResponse[], callId: string, methodName: string): T {
  const entry = responses.find((r) => r[2] === callId);
  if (!entry) {
    throw new JmapProtocolError(`JMAP response for ${methodName} (call ${callId}) is missing`);
  }
  if (entry[0] === 'error') {
    throw new JmapMethodError(methodName, callId, entry[1]);
  }
  return entry[1] as T;
}

export async function jmapRequest(methodCalls: JmapMethodCall[], signal?: AbortSignal): Promise<JmapMethodResponse[]> {
  const startedAt = performance.now();
  const data = await apiFetchJson<JmapResponse>(jmapApiPath(useAuthStore.getState().apiUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ using: JMAP_USING, methodCalls }),
    signal,
  });

  if (!data || !Array.isArray(data.methodResponses)) {
    throw new JmapProtocolError('Malformed JMAP response: missing methodResponses');
  }

  logJmapExchange(methodCalls, data.methodResponses, performance.now() - startedAt);

  if (import.meta.env.DEV) {
    for (const [methodName, result, callId] of data.methodResponses) {
      if (methodName === 'error') {
        console.error(`JMAP error [${callId}]:`, result);
      }
    }
  }

  return data.methodResponses;
}

export async function jmapCall<T = JmapObject>(
  methodName: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const responses = await jmapRequest([[methodName, args, '0']], signal);
  return methodResult<T>(responses, '0', methodName);
}

export function jmapGet(
  objectType: string,
  ids: string[] | null,
  properties?: string[],
  options: JmapCallOptions = {},
): Promise<JmapGetResponse> {
  const args: Record<string, unknown> = { accountId: options.accountId ?? getAccountId(objectType), ids };
  if (properties) args.properties = properties;
  return jmapCall<JmapGetResponse>(`${objectType}/get`, args, options.signal);
}

export async function jmapGetOne(
  objectType: string,
  id: string,
  properties?: string[],
  options: JmapCallOptions = {},
): Promise<JmapObject | null> {
  const result = await jmapGet(objectType, [id], properties, options);
  const match = result.list?.find((item) => item.id === id);
  if (match) return match;
  return id === 'singleton' ? (result.list?.[0] ?? null) : null;
}

export function jmapQuery(
  objectType: string,
  query: JmapQueryOptions = {},
  options: JmapCallOptions = {},
): Promise<JmapQueryResponse> {
  const args = { accountId: options.accountId ?? getAccountId(objectType), ...query };
  return jmapCall<JmapQueryResponse>(`${objectType}/query`, args, options.signal);
}

export function jmapSetArgs(objectType: string, set: JmapSetOptions, accountId?: string): Record<string, unknown> {
  const args: Record<string, unknown> = { accountId: accountId ?? getAccountId(objectType) };
  if (set.create && Object.keys(set.create).length > 0) args.create = set.create;
  if (set.update && Object.keys(set.update).length > 0) args.update = set.update;
  if (set.destroy && set.destroy.length > 0) args.destroy = set.destroy;
  return args;
}

export function blobUploadCalls(blobs: Record<string, BlobUpload>, accountId: string): JmapMethodCall[] {
  const tags = Object.keys(blobs);
  if (tags.length === 0) return [];
  const create: Record<string, unknown> = {};
  for (const tag of tags) {
    create[tag] = {
      data: [{ 'data:asText': blobs[tag].data }],
      type: blobs[tag].type ?? 'application/octet-stream',
    };
  }
  return [['Blob/upload', { accountId, create }, 'blob']];
}

export async function jmapSet(
  objectType: string,
  set: JmapSetOptions,
  options: JmapCallOptions & { blobs?: Record<string, BlobUpload> } = {},
): Promise<JmapSetResponse> {
  const accountId = options.accountId ?? getAccountId(objectType);
  const methodName = `${objectType}/set`;
  const blobCalls = blobUploadCalls(options.blobs ?? {}, accountId);
  const responses = await jmapRequest(
    [...blobCalls, [methodName, jmapSetArgs(objectType, set, accountId), 'set']],
    options.signal,
  );
  if (blobCalls.length > 0) {
    const upload = methodResult<{ notCreated?: Record<string, { type: string; description?: string }> | null }>(
      responses,
      'blob',
      'Blob/upload',
    );
    const failed = upload.notCreated ? Object.values(upload.notCreated)[0] : undefined;
    if (failed) throw new JmapMethodError('Blob/upload', 'blob', failed);
  }
  return methodResult<JmapSetResponse>(responses, 'set', methodName);
}

export async function jmapQueryAndGet(
  objectType: string,
  query: JmapQueryOptions = {},
  properties?: string[],
  options: JmapCallOptions = {},
): Promise<{ query: JmapQueryResponse; list: JmapObject[] }> {
  const accountId = options.accountId ?? getAccountId(objectType);
  const getArgs: Record<string, unknown> = {
    accountId,
    '#ids': { resultOf: 'q', name: `${objectType}/query`, path: '/ids' },
  };
  if (properties) getArgs.properties = properties;

  const responses = await jmapRequest(
    [
      [`${objectType}/query`, { accountId, ...query }, 'q'],
      [`${objectType}/get`, getArgs, 'g'],
    ],
    options.signal,
  );
  const queryResult = methodResult<JmapQueryResponse>(responses, 'q', `${objectType}/query`);
  const getResult = methodResult<JmapGetResponse>(responses, 'g', `${objectType}/get`);
  return { query: queryResult, list: getResult.list ?? [] };
}

export async function jmapGetBatched(
  objectType: string,
  ids: string[],
  properties?: string[],
  options: JmapCallOptions = {},
): Promise<JmapObject[]> {
  if (ids.length === 0) return [];
  const accountId = options.accountId ?? getAccountId(objectType);
  const batchSize = Math.max(1, useAuthStore.getState().maxObjectsInGet);
  const items: JmapObject[] = [];
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    options.signal?.throwIfAborted();
    const result = await jmapGet(objectType, ids.slice(offset, offset + batchSize), properties, {
      accountId,
      signal: options.signal,
    });
    items.push(...(result.list ?? []));
  }
  return items;
}

export async function jmapQueryAll(
  objectType: string,
  query: JmapQueryOptions = {},
  options: JmapCallOptions = {},
): Promise<string[]> {
  const accountId = options.accountId ?? getAccountId(objectType);
  const allIds: string[] = [];
  let anchor: string | undefined;
  for (let page = 0; page < MAX_QUERY_PAGES; page++) {
    options.signal?.throwIfAborted();
    const args: JmapQueryOptions = { ...query };
    if (anchor) {
      delete args.position;
      args.anchor = anchor;
      args.anchorOffset = 1;
    }
    const data = await jmapQuery(objectType, args, { accountId, signal: options.signal });
    const pageIds = data.ids ?? [];
    if (pageIds.length === 0) break;
    allIds.push(...pageIds);
    if (data.limit === undefined || data.limit === null) break;
    anchor = pageIds[pageIds.length - 1];
  }
  return allIds;
}

export async function jmapQueryAllAndGet(
  objectType: string,
  query: JmapQueryOptions = {},
  properties?: string[],
  options: JmapCallOptions = {},
): Promise<{ ids: string[]; list: JmapObject[] }> {
  const accountId = options.accountId ?? getAccountId(objectType);
  const ids = await jmapQueryAll(objectType, query, { accountId, signal: options.signal });
  if (ids.length === 0) return { ids, list: [] };
  const list = await jmapGetBatched(objectType, ids, properties, { accountId, signal: options.signal });
  return { ids, list };
}

export async function fetchBlobText(blobId: string, options: JmapCallOptions = {}): Promise<string | null> {
  const item = await jmapGetOne('Blob', blobId, ['data:asText'], {
    accountId: options.accountId ?? getAccountId('x:Blob'),
    signal: options.signal,
  });
  if (!item) return null;
  const data = item['data:asText'];
  return typeof data === 'string' ? data : null;
}

export interface JmapSession {
  accounts: Record<string, { name: string; isPersonal: boolean; accountCapabilities?: Record<string, unknown> }>;
  primaryAccounts: Record<string, string>;
  apiUrl?: string;
  capabilities?: Record<string, Record<string, unknown>>;
}

export function fetchSession(signal?: AbortSignal): Promise<JmapSession> {
  return apiFetchJson<JmapSession>('/jmap/session', { signal });
}

export function fetchSchema(signal?: AbortSignal): Promise<Schema> {
  return apiFetchJson<Schema>('/api/schema', { signal });
}

export interface AccountInfoResponse {
  permissions: string[];
  edition: Edition;
  locale: string;
}

export function fetchAccountInfo(signal?: AbortSignal): Promise<AccountInfoResponse> {
  return apiFetchJson<AccountInfoResponse>('/api/account', { signal });
}
