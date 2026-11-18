/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazyPage } from '@/extensions/lazyPage';
// SPDX-SnippetBegin
// SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
// SPDX-License-Identifier: LicenseRef-SEL
import { SEL_PAGES } from '@/extensions/pages.sel';
// SPDX-SnippetEnd
import { resolveObject } from '@/lib/schemaResolver';
import type { PermissionCheckers } from '@/lib/permissions';
import type { ObjectMatch, PageComponent, PageGate, PageMode, PageOverride, RouteMatch } from '@/extensions/types';
import type { Schema } from '@/types/schema';

export const CUSTOM_COMPONENT_PREFIX = 'CustomComponent/';

const ALL_MODES: readonly PageMode[] = ['list', 'create', 'edit', 'detail', 'singleton'];

export const PAGES: readonly PageOverride[] = [
  {
    match: { customComponent: 'LiveDelivery' },
    component: lazyPage(
      () => import('@/features/troubleshoot/DeliveryTracePage'),
      (m) => m.DeliveryTracePage,
    ),
    gate: { permission: 'liveDeliveryTest' },
  },
  {
    match: { object: 'x:Action' },
    modes: ALL_MODES,
    component: lazyPage(
      () => import('@/features/actions/ActionPage'),
      (m) => m.ActionPage,
    ),
  },
  {
    match: { object: 'x:MailRule' },
    modes: ['list'],
    component: lazyPage(
      () => import('@/features/mailRules/components/MailRulesPage'),
      (m) => m.MailRulesPage,
    ),
  },
  {
    match: { object: 'x:MailRule' },
    modes: ['create', 'edit'],
    component: lazyPage(
      () => import('@/features/mailRules/components/MailRuleFormPage'),
      (m) => m.MailRuleFormPage,
    ),
  },
  {
    match: { object: 'x:MailRule' },
    modes: ['detail'],
    component: lazyPage(
      () => import('@/features/mailRules/components/MailRuleFormPage'),
      (m) => m.MailRuleViewPage,
    ),
  },
  {
    match: { object: 'x:BlockedSender' },
    modes: ['list', 'create', 'edit', 'detail'],
    component: lazyPage(
      () => import('@/features/mailRules/components/SenderListPage'),
      (m) => m.SenderListPage,
    ),
  },
  {
    match: { object: 'x:SafeSender' },
    modes: ['list', 'create', 'edit', 'detail'],
    component: lazyPage(
      () => import('@/features/mailRules/components/SenderListPage'),
      (m) => m.SenderListPage,
    ),
  },
  {
    match: { object: 'VacationResponse' },
    modes: ['singleton'],
    component: lazyPage(
      () => import('@/features/vacation/VacationResponsePage'),
      (m) => m.VacationResponsePage,
    ),
  },
  // SPDX-SnippetBegin
  // SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
  // SPDX-License-Identifier: LicenseRef-SEL
  ...SEL_PAGES,
  // SPDX-SnippetEnd
];

export interface RoutePage {
  component: PageComponent;
  gate?: PageGate;
}

function routeMatches(match: RouteMatch, viewName: string): boolean {
  return 'customComponent' in match
    ? viewName === `${CUSTOM_COMPONENT_PREFIX}${match.customComponent}`
    : viewName.startsWith(match.viewPrefix);
}

export function matchRoutePage(viewName: string): RoutePage | null {
  for (const page of PAGES) {
    if (!('modes' in page) && routeMatches(page.match, viewName)) return page;
  }
  return null;
}

function findObjectPage(test: (match: ObjectMatch) => boolean, mode: PageMode): PageComponent | null {
  for (const page of PAGES) {
    if ('modes' in page && page.modes.includes(mode) && test(page.match)) return page.component;
  }
  return null;
}

export type PageTarget = { mode: 'list' | 'create' | 'singleton' } | { mode: 'edit' | 'detail'; id: string };

export function pageObjectId(target: PageTarget): string | null {
  switch (target.mode) {
    case 'list':
      return null;
    case 'create':
      return 'new';
    case 'singleton':
      return 'singleton';
    default:
      return target.id;
  }
}

export type ResolvedPage =
  | { kind: 'loading' }
  | { kind: 'unknownComponent'; name: string }
  | { kind: 'unknownView' }
  | { kind: 'route'; viewName: string; component: PageComponent }
  | { kind: 'object'; viewName: string; target: PageTarget; component: PageComponent | null };

export function resolvePage(
  schema: Schema | null,
  viewName: string | undefined,
  id: string | undefined,
  permissions: PermissionCheckers,
): ResolvedPage {
  if (!viewName) return { kind: 'loading' };
  const route = matchRoutePage(viewName);
  if (route) return { kind: 'route', viewName, component: route.component };
  if (viewName.startsWith(CUSTOM_COMPONENT_PREFIX)) {
    return { kind: 'unknownComponent', name: viewName.slice(CUSTOM_COMPONENT_PREFIX.length) };
  }
  if (!schema) return { kind: 'loading' };

  const resolved = resolveObject(schema, viewName);
  if (!resolved) return { kind: 'unknownView' };

  const target: PageTarget =
    resolved.objectType.type === 'singleton'
      ? { mode: 'singleton' }
      : id === 'new'
        ? { mode: 'create' }
        : id
          ? { mode: permissions.hasObjectPermission(resolved.permissionPrefix, 'Update') ? 'edit' : 'detail', id }
          : { mode: 'list' };
  const component =
    findObjectPage((match) => 'view' in match && match.view === viewName, target.mode) ??
    findObjectPage((match) => 'object' in match && match.object === resolved.objectName, target.mode);
  return { kind: 'object', viewName, target, component };
}
