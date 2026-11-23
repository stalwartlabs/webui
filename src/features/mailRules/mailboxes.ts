/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { TFunction } from 'i18next';
import type { JmapObject } from '@/services/jmap/client';

export const MAILBOX_PROPERTIES = ['id', 'name', 'parentId', 'role', 'sortOrder'];

const TRASH_MAILBOX_ID = 'b';
const JUNK_MAILBOX_ID = 'c';

export interface MailboxOption {
  id: string;
  name: string;
  role: string | null;
  depth: number;
  path: string[];
}

interface MailboxNode {
  id: string;
  name: string;
  role: string | null;
  sortOrder: number;
  parentId: string | null;
}

function parseMailbox(raw: JmapObject): MailboxNode | null {
  if (typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : raw.id,
    role: typeof raw.role === 'string' && raw.role !== '' ? raw.role : null,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : 0,
    parentId: typeof raw.parentId === 'string' && raw.parentId !== '' ? raw.parentId : null,
  };
}

function compareNodes(a: MailboxNode, b: MailboxNode): number {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

export function buildMailboxOptions(list: readonly JmapObject[]): MailboxOption[] {
  const nodes = new Map<string, MailboxNode>();
  for (const raw of list) {
    const node = parseMailbox(raw);
    if (node) nodes.set(node.id, node);
  }
  const children = new Map<string | null, MailboxNode[]>();
  for (const node of nodes.values()) {
    const parent = node.parentId !== null && nodes.has(node.parentId) ? node.parentId : null;
    const siblings = children.get(parent);
    if (siblings) siblings.push(node);
    else children.set(parent, [node]);
  }
  for (const siblings of children.values()) siblings.sort(compareNodes);

  const options: MailboxOption[] = [];
  const visited = new Set<string>();
  const visit = (node: MailboxNode, path: string[]) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const nodePath = [...path, node.name];
    options.push({ id: node.id, name: node.name, role: node.role, depth: path.length, path: nodePath });
    for (const child of children.get(node.id) ?? []) visit(child, nodePath);
  };
  for (const root of children.get(null) ?? []) visit(root, []);
  const orphans = [...nodes.values()].filter((node) => !visited.has(node.id)).sort(compareNodes);
  for (const node of orphans) visit(node, []);
  return options;
}

export function mailboxNameResolver(options: readonly MailboxOption[]): (id: string) => string | undefined {
  const byId = new Map(options.map((option) => [option.id, option.path.join(' / ')]));
  return (id) => byId.get(id);
}

export function fallbackMailboxName(t: TFunction, id: string): string {
  if (id === TRASH_MAILBOX_ID) return t('mailRules.trashMailbox', 'Trash');
  if (id === JUNK_MAILBOX_ID) return t('mailRules.junkMailbox', 'Junk');
  return id;
}

export function mailboxNamer(t: TFunction, options: readonly MailboxOption[] | undefined): (id: string) => string {
  if (!options) return (id) => fallbackMailboxName(t, id);
  const known = mailboxNameResolver(options);
  return (id) => known(id) ?? t('mailRules.unknownMailbox', 'Unknown mailbox ({{id}})', { id });
}
