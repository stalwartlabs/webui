/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Layout, LayoutSubItem, Schema } from '@/types/schema';
import { resolveObject } from '@/lib/schemaResolver';
import { isCommunityEdition, isCreateOnly } from '@/lib/permissions';
import { CUSTOM_COMPONENT_PREFIX, matchRoutePage } from '@/extensions/pages';

export type CanGet = (permissionPrefix: string) => boolean;
export type HasPermission = (permission: string) => boolean;

interface SpecialLinkInfo {
  visible: boolean;
  enterprise: boolean;
}

function checkSpecialLink(
  schema: Schema,
  viewName: string,
  hasPerm?: HasPermission,
  canGet?: CanGet,
): SpecialLinkInfo | null {
  const page = matchRoutePage(viewName);
  if (!page && !viewName.startsWith(CUSTOM_COMPONENT_PREFIX)) return null;
  const rule = page?.gate;
  if (!rule) return { visible: true, enterprise: false };

  const backing = rule.backingObject ? resolveObject(schema, rule.backingObject) : null;
  if (rule.backingObject && !backing) return { visible: false, enterprise: false };

  const permitted = hasPerm ? hasPerm(rule.permission) : true;
  const readable = backing && canGet ? canGet(backing.permissionPrefix) : true;
  return { visible: permitted && readable, enterprise: rule.enterprise ?? backing?.enterprise ?? false };
}

export function isLinkVisible(schema: Schema, viewName: string, canGet: CanGet, hasPerm?: HasPermission): boolean {
  const special = checkSpecialLink(schema, viewName, hasPerm, canGet);
  if (special !== null) return special.visible;
  const resolved = resolveObject(schema, viewName);
  if (resolved === null) return false;
  if (isCreateOnly(schema, resolved.permissionPrefix)) return hasPerm?.(`${resolved.permissionPrefix}Create`) ?? false;
  return canGet(resolved.permissionPrefix);
}

export function isLinkEnterprise(schema: Schema, viewName: string): boolean {
  const special = checkSpecialLink(schema, viewName);
  if (special !== null) return special.enterprise;
  return resolveObject(schema, viewName)?.enterprise ?? false;
}

function findFirstSubLink(items: LayoutSubItem[], accept: (viewName: string) => boolean): string | null {
  for (const item of items) {
    if (item.type === 'link') {
      if (accept(item.viewName)) return item.viewName;
    } else if (item.type === 'container') {
      const found = findFirstSubLink(item.items, accept);
      if (found) return found;
    }
  }
  return null;
}

function findFirstLink(layout: Layout, accept: (viewName: string) => boolean): string | null {
  for (const item of layout.items) {
    if ('link' in item) {
      if (accept(item.link.viewName)) return item.link.viewName;
    } else if ('container' in item) {
      const found = findFirstSubLink(item.container.items, accept);
      if (found) return found;
    }
  }
  return null;
}

export function layoutContainsLink(layout: Layout, viewName: string): boolean {
  return findFirstLink(layout, (candidate) => candidate === viewName) !== null;
}

export function layoutViewFor(
  schema: Schema,
  viewToSection: Record<string, string>,
  viewName: string,
  preferred?: string,
): string | null {
  if (Object.hasOwn(viewToSection, viewName)) return viewName;
  const isChild = (candidate: string) => {
    const obj = schema.objects[candidate];
    return obj?.type === 'view' && obj.objectName === viewName;
  };
  if (preferred && Object.hasOwn(viewToSection, preferred) && isChild(preferred)) return preferred;
  return Object.keys(viewToSection).find(isChild) ?? null;
}

export function findFirstVisibleLinkInLayout(
  schema: Schema,
  layout: Layout,
  canGet: CanGet,
  hasPerm?: HasPermission,
): string | null {
  return findFirstLink(layout, (viewName) => isLinkVisible(schema, viewName, canGet, hasPerm));
}

export function isLinkAccessible(
  schema: Schema,
  viewName: string,
  edition: string,
  canGet: CanGet,
  hasPerm?: HasPermission,
): boolean {
  if (!isLinkVisible(schema, viewName, canGet, hasPerm)) return false;
  if (isCommunityEdition(edition) && isLinkEnterprise(schema, viewName)) return false;
  return true;
}

export function findFirstAccessibleLinkInLayout(
  schema: Schema,
  layout: Layout,
  edition: string,
  canGet: CanGet,
  hasPerm?: HasPermission,
): string | null {
  return findFirstLink(layout, (viewName) => isLinkAccessible(schema, viewName, edition, canGet, hasPerm));
}

export function visibleLayouts(schema: Schema, canGet: CanGet, hasPerm?: HasPermission): Layout[] {
  return schema.layouts.filter((layout) => findFirstVisibleLinkInLayout(schema, layout, canGet, hasPerm) !== null);
}
