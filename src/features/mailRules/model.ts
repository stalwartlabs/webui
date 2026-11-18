/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { isRecord } from '@/lib/embeddedSchema';
import { jmapMapToArray } from '@/lib/jmapUtils';
import type { PermissionCheckers } from '@/lib/permissions';
import type { JmapObject } from '@/services/jmap/client';

export const MAIL_RULE_OBJECT = 'x:MailRule';
export const MAIL_RULE_CONDITION_OBJECT = 'x:MailRuleCondition';
export const MAIL_RULE_ACTION_OBJECT = 'x:MailRuleAction';

const FORWARD_PERMISSIONS = ['jmapSieveScriptCreate', 'jmapSieveScriptUpdate', 'sievePutScript'] as const;

export interface MailRule {
  id: string;
  name: string;
  isEnabled: boolean;
  position: number;
  body: Record<string, unknown>;
}

export interface CustomRuleBody {
  matchAll: boolean;
  conditions: Record<string, unknown>[];
  exceptions: Record<string, unknown>[];
  actions: Record<string, unknown>[];
  stopProcessing: boolean;
  timeZone: string | null;
}

export type RuleIssue =
  'rejectNotAlone' | 'rejectNeedsAuthentication' | 'forwardingNotAllowed' | 'scheduleTooManySlots';

export const MAX_SCHEDULE_SLOTS = 14;
const SCHEDULE_CONDITION = 'Schedule';
export const REJECT_ACTION = 'Reject';

export function variantType(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const type = value['@type'];
  return typeof type === 'string' ? type : null;
}

export function setValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (!isRecord(value)) return [];
  return Object.keys(value).filter((key) => value[key] === true);
}

export function parseMailRule(raw: JmapObject): MailRule | null {
  const { id } = raw;
  if (typeof id !== 'string') return null;
  const position = raw.position;
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : '',
    isEnabled: raw.isEnabled !== false,
    position: typeof position === 'number' && Number.isFinite(position) && position >= 0 ? position : 0,
    body: raw,
  };
}

export function orderMailRules(rules: readonly MailRule[]): MailRule[] {
  return [...rules].sort((a, b) => a.position - b.position);
}

export function parseMailRules(list: readonly JmapObject[]): MailRule[] {
  const parsed: MailRule[] = [];
  for (const raw of list) {
    const rule = parseMailRule(raw);
    if (rule) parsed.push(rule);
  }
  return orderMailRules(parsed);
}

interface Placed {
  position: number;
  index: number;
}

export function reorderPositions(
  current: readonly Pick<MailRule, 'id' | 'position'>[],
  nextOrder: readonly string[],
  pinned: ReadonlySet<string> = new Set(),
): Map<string, number> | null {
  const changes = new Map<string, number>();
  if (current.length !== nextOrder.length) return changes;
  const before = new Map<string, Placed>();
  current.forEach((rule, index) => before.set(rule.id, { position: rule.position, index }));
  const sequence: Placed[] = [];
  for (const id of nextOrder) {
    const placed = before.get(id);
    if (!placed) return changes;
    before.delete(id);
    sequence.push(placed);
  }
  if (sequence.length === 0) return changes;

  const canFollow = (i: number, j: number): boolean => {
    const a = sequence[i];
    const b = sequence[j];
    const gap = j - i;
    if (b.position - a.position >= gap) return true;
    return gap === 1 && b.position === a.position && a.index < b.index;
  };

  let lastPinned = -1;
  const pinnedBefore = nextOrder.map((id, index) => {
    const previousPinned = lastPinned;
    if (pinned.has(id)) lastPinned = index;
    return previousPinned;
  });

  const kept = sequence.map((placed, j): number => (placed.position >= j && pinnedBefore[j] < 0 ? 1 : 0));
  const previous = sequence.map(() => -1);
  let last = -1;
  kept.forEach((_, j) => {
    for (let i = Math.max(0, pinnedBefore[j]); i < j; i++) {
      if (kept[i] > 0 && kept[i] + 1 > kept[j] && canFollow(i, j)) {
        kept[j] = kept[i] + 1;
        previous[j] = i;
      }
    }
    if (kept[j] > 0 && j >= lastPinned && (last < 0 || kept[j] >= kept[last])) last = j;
  });
  if (last < 0) return null;

  const anchors: number[] = [];
  for (let k = last; k >= 0; k = previous[k]) anchors.push(k);
  anchors.reverse();

  const positions = sequence.map((placed) => placed.position);
  const [first] = anchors;
  for (let i = 0; i < first; i++) positions[i] = sequence[first].position - (first - i);
  anchors.forEach((anchor, n) => {
    const end = n + 1 < anchors.length ? anchors[n + 1] : sequence.length;
    for (let i = anchor + 1; i < end; i++) positions[i] = sequence[anchor].position + (i - anchor);
  });

  nextOrder.forEach((id, i) => {
    if (positions[i] !== sequence[i].position) changes.set(id, positions[i]);
  });
  return changes;
}

export function parseCustomBody(body: Record<string, unknown>): CustomRuleBody {
  const list = (value: unknown) => jmapMapToArray<unknown>(value).filter(isRecord);
  const conditions = list(body.conditions);
  return {
    matchAll: conditions.length < 2 || body.matchAll !== false,
    conditions,
    exceptions: list(body.exceptions),
    actions: list(body.actions),
    stopProcessing: body.stopProcessing === true,
    timeZone: typeof body.timeZone === 'string' && body.timeZone !== '' ? body.timeZone : null,
  };
}

function hasVariant(items: readonly Record<string, unknown>[], type: string): boolean {
  return items.some((item) => variantType(item) === type);
}

export function hasScheduleCondition(custom: CustomRuleBody): boolean {
  return hasVariant(custom.conditions, SCHEDULE_CONDITION) || hasVariant(custom.exceptions, SCHEDULE_CONDITION);
}

export function mergedScheduleOverflow(items: readonly Record<string, unknown>[]): boolean {
  let run = 0;
  for (const item of items) {
    if (variantType(item) !== SCHEDULE_CONDITION) {
      run = 0;
      continue;
    }
    run += jmapMapToArray<unknown>(item.slots).length;
    if (run > MAX_SCHEDULE_SLOTS) return true;
  }
  return false;
}

export function hasRejectAction(custom: CustomRuleBody): boolean {
  return hasVariant(custom.actions, REJECT_ACTION);
}

export function isRejectAllowed(custom: CustomRuleBody): boolean {
  return custom.matchAll && hasVariant(custom.conditions, 'SenderAuthenticated');
}

function redirectTargets(custom: CustomRuleBody): number {
  return custom.actions.reduce(
    (total, action) => total + (variantType(action) === 'Redirect' ? setValues(action.addresses).length : 0),
    0,
  );
}

export function forwardingTargets(body: Record<string, unknown>): number {
  return redirectTargets(parseCustomBody(body));
}

export function canForward(checkers: Pick<PermissionCheckers, 'hasPermission'>): boolean {
  return FORWARD_PERMISSIONS.some((permission) => checkers.hasPermission(permission));
}

export function ruleIssues(
  rule: Pick<MailRule, 'isEnabled' | 'body'>,
  checkers: Pick<PermissionCheckers, 'hasPermission'>,
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const custom = parseCustomBody(rule.body);
  if (hasRejectAction(custom)) {
    if (custom.actions.length > 1) issues.push('rejectNotAlone');
    if (!isRejectAllowed(custom)) issues.push('rejectNeedsAuthentication');
  }
  if (mergedScheduleOverflow(custom.exceptions) || (!custom.matchAll && mergedScheduleOverflow(custom.conditions))) {
    issues.push('scheduleTooManySlots');
  }
  if (rule.isEnabled && redirectTargets(custom) > 0 && !canForward(checkers)) {
    issues.push('forwardingNotAllowed');
  }
  return issues;
}

export function pinnedRuleIds(
  rules: readonly Pick<MailRule, 'id' | 'isEnabled' | 'body'>[],
  checkers: Pick<PermissionCheckers, 'hasPermission'>,
): Set<string> {
  if (canForward(checkers)) return new Set();
  return new Set(rules.filter((rule) => rule.isEnabled && forwardingTargets(rule.body) > 0).map((rule) => rule.id));
}

export function positionPatches(changes: ReadonlyMap<string, number>): Record<string, JmapObject> {
  const patches: Record<string, JmapObject> = {};
  for (const [id, position] of changes) patches[id] = { position };
  return patches;
}

export function nextRulePosition(rules: readonly Pick<MailRule, 'position'>[]): number {
  return rules.reduce((next, rule) => Math.max(next, rule.position + 1), 0);
}

export function moveInOrder(order: readonly string[], from: number, to: number): string[] | null {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return null;
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
