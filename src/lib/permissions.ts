/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';
import { resolveObject } from '@/lib/schemaResolver';

export type ObjectAction = 'Get' | 'Query' | 'Create' | 'Update' | 'Destroy';

const OBJECT_ACTIONS: readonly ObjectAction[] = ['Get', 'Query', 'Create', 'Update', 'Destroy'];

export const PERSONAL_ONLY_OBJECTS: readonly string[] = [
  'x:AccountPassword',
  'x:AccountSettings',
  'x:ApiKey',
  'x:AppPassword',
  'x:OAuthGrant',
  'x:Passkey',
];

export interface PermissionCheckers {
  hasPermission: (permission: string) => boolean;
  hasObjectPermission: (permissionPrefix: string, action: ObjectAction) => boolean;
  canGet: (permissionPrefix: string) => boolean;
}

const NO_DENIED_PERMISSIONS: ReadonlySet<string> = new Set();
const checkersCache = new WeakMap<readonly string[], WeakMap<ReadonlySet<string>, PermissionCheckers>>();

export function createPermissionCheckers(
  permissions: readonly string[],
  denied: ReadonlySet<string> = NO_DENIED_PERMISSIONS,
): PermissionCheckers {
  let byDenied = checkersCache.get(permissions);
  if (!byDenied) {
    byDenied = new WeakMap();
    checkersCache.set(permissions, byDenied);
  }
  const cached = byDenied.get(denied);
  if (cached) return cached;
  const granted = new Set(permissions);
  for (const permission of denied) granted.delete(permission);
  const checkers: PermissionCheckers = {
    hasPermission: (permission) => granted.has(permission),
    hasObjectPermission: (permissionPrefix, action) => granted.has(`${permissionPrefix}${action}`),
    canGet: (permissionPrefix) => granted.has(`${permissionPrefix}Get`),
  };
  byDenied.set(denied, checkers);
  return checkers;
}

const personalOnlyCache = new WeakMap<Schema, ReadonlySet<string>>();

export function personalOnlyPermissions(schema: Schema): ReadonlySet<string> {
  let denied = personalOnlyCache.get(schema);
  if (!denied) {
    const set = new Set<string>();
    for (const objectName of PERSONAL_ONLY_OBJECTS) {
      const prefix = resolveObject(schema, objectName)?.permissionPrefix;
      if (prefix) for (const action of OBJECT_ACTIONS) set.add(`${prefix}${action}`);
    }
    denied = set;
    personalOnlyCache.set(schema, denied);
  }
  return denied;
}

const definedPermissionsCache = new WeakMap<Schema, ReadonlySet<string>>();

function definedPermissions(schema: Schema): ReadonlySet<string> {
  let defined = definedPermissionsCache.get(schema);
  if (!defined) {
    defined = new Set((schema.enums['Permission'] ?? []).map((v) => v.name));
    definedPermissionsCache.set(schema, defined);
  }
  return defined;
}

export function isCreateOnly(schema: Schema, permissionPrefix: string): boolean {
  const defined = definedPermissions(schema);
  return defined.has(`${permissionPrefix}Create`) && !defined.has(`${permissionPrefix}Get`);
}

export function canAccessView(
  schema: Schema | null | undefined,
  viewName: string,
  action: ObjectAction,
  checkers: PermissionCheckers,
): boolean {
  if (!schema) return false;
  const resolved = resolveObject(schema, viewName);
  if (!resolved) return false;
  if ((action === 'Create' || action === 'Destroy') && resolved.objectType.type === 'singleton') return false;
  return checkers.hasObjectPermission(resolved.permissionPrefix, action);
}

export function isCommunityEdition(edition: string): boolean {
  return edition === 'community';
}
