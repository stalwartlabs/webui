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
export const MAIL_RULE_CONDITIONS_OBJECT = 'x:MailRuleConditions';
export const MAIL_RULE_ACTIONS_OBJECT = 'x:MailRuleActions';

const FORWARD_PERMISSIONS = ['jmapSieveScriptCreate', 'jmapSieveScriptUpdate', 'sievePutScript'] as const;

export interface MailRule {
  id: string;
  name: string;
  isEnabled: boolean;
  position: number;
  body: Record<string, unknown>;
}

export type ConditionGroup = 'matchAll' | 'matchAny' | 'matchNone';

export type RuleConditions = Record<ConditionGroup, Record<string, unknown>[]>;

export interface RuleActions {
  addKeywords: string[];
  removeKeywords: string[];
  clearKeywords: boolean;
  setImportance: string | null;
  redirect: Record<string, unknown> | null;
  reply: Record<string, unknown> | null;
  copyTo: string[];
  moveTo: string[];
  discard: boolean;
  reject: Record<string, unknown> | null;
  stopProcessing: boolean;
}

export interface CustomRuleBody {
  conditions: RuleConditions;
  actions: RuleActions;
}

export type KeywordSet = 'addKeywords' | 'removeKeywords';

export const FLAG_ACTIONS = {
  markRead: { set: 'addKeywords', keyword: '$seen' },
  flag: { set: 'addKeywords', keyword: '$flagged' },
  clearFlag: { set: 'removeKeywords', keyword: '$flagged' },
  markNotJunk: { set: 'addKeywords', keyword: '$notjunk' },
} as const satisfies Record<string, { set: KeywordSet; keyword: string }>;

export type FlagAction = keyof typeof FLAG_ACTIONS;

export type RuleIssue = 'rejectNotAlone' | 'keywordConflict' | 'forwardingNotAllowed' | 'sizeInvalid';

export const MAX_SIZE_KB = 2 ** 32;

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

export function newRuleValues(position: number): JmapObject {
  return {
    position,
    conditions: { matchAll: {}, matchAny: {}, matchNone: {} },
    actions: {
      addKeywords: {},
      removeKeywords: {},
      clearKeywords: false,
      setImportance: null,
      redirect: null,
      reply: null,
      copyTo: {},
      moveTo: {},
      discard: false,
      reject: null,
      stopProcessing: false,
    },
  };
}

function parseConditions(value: unknown): RuleConditions {
  const groups = isRecord(value) ? value : {};
  const list = (group: ConditionGroup) => jmapMapToArray<unknown>(groups[group]).filter(isRecord);
  return { matchAll: list('matchAll'), matchAny: list('matchAny'), matchNone: list('matchNone') };
}

export function parseActions(value: unknown): RuleActions {
  const actions = isRecord(value) ? value : {};
  const { setImportance, redirect, reply, reject } = actions;
  return {
    addKeywords: setValues(actions.addKeywords),
    removeKeywords: setValues(actions.removeKeywords),
    clearKeywords: actions.clearKeywords === true,
    setImportance: typeof setImportance === 'string' && setImportance !== '' ? setImportance : null,
    redirect: isRecord(redirect) ? redirect : null,
    reply: isRecord(reply) ? reply : null,
    copyTo: setValues(actions.copyTo),
    moveTo: setValues(actions.moveTo),
    discard: actions.discard === true,
    reject: isRecord(reject) ? reject : null,
    stopProcessing: actions.stopProcessing === true,
  };
}

export function parseCustomBody(body: Record<string, unknown>): CustomRuleBody {
  return { conditions: parseConditions(body.conditions), actions: parseActions(body.actions) };
}

export function hasFlag(actions: RuleActions, flag: FlagAction): boolean {
  const { set, keyword } = FLAG_ACTIONS[flag];
  return actions[set].includes(keyword);
}

export function otherKeywords(actions: RuleActions, set: KeywordSet): string[] {
  const flags = new Set<string>();
  for (const action of Object.values(FLAG_ACTIONS)) {
    if (action.set === set) flags.add(action.keyword);
  }
  return actions[set].filter((keyword) => !flags.has(keyword));
}

export function hasOtherAction(actions: RuleActions): boolean {
  return (
    actions.addKeywords.length > 0 ||
    actions.removeKeywords.length > 0 ||
    actions.clearKeywords ||
    actions.setImportance !== null ||
    actions.redirect !== null ||
    actions.reply !== null ||
    actions.copyTo.length > 0 ||
    actions.moveTo.length > 0 ||
    actions.discard
  );
}

export function needsAction(actions: RuleActions): boolean {
  return !actions.stopProcessing && actions.reject === null && !hasOtherAction(actions);
}

export function isEveryMessageReply(reply: Record<string, unknown> | null): boolean {
  return reply?.days === 0;
}

function hasKeywordConflict(actions: RuleActions): boolean {
  const removed = new Set(actions.removeKeywords);
  return actions.addKeywords.some((keyword) => removed.has(keyword));
}

export function sizeIssue(condition: Record<string, unknown>): RuleIssue | null {
  const type = variantType(condition);
  if (type !== 'SizeOver' && type !== 'SizeUnder') return null;
  const { kilobytes } = condition;
  if (typeof kilobytes !== 'number' || !Number.isFinite(kilobytes)) return null;
  return kilobytes < 1 || kilobytes > MAX_SIZE_KB ? 'sizeInvalid' : null;
}

function redirectTargets(actions: RuleActions): number {
  return setValues(actions.redirect?.addresses).length;
}

export function forwardingTargets(body: Record<string, unknown>): number {
  return redirectTargets(parseActions(body.actions));
}

export function canForward(checkers: Pick<PermissionCheckers, 'hasPermission'>): boolean {
  return FORWARD_PERMISSIONS.some((permission) => checkers.hasPermission(permission));
}

export function ruleIssues(
  rule: Pick<MailRule, 'isEnabled' | 'body'>,
  checkers: Pick<PermissionCheckers, 'hasPermission'>,
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const { conditions, actions } = parseCustomBody(rule.body);
  if (actions.reject && hasOtherAction(actions)) issues.push('rejectNotAlone');
  if (hasKeywordConflict(actions)) issues.push('keywordConflict');
  if (Object.values(conditions).some((items) => items.some((condition) => sizeIssue(condition) !== null))) {
    issues.push('sizeInvalid');
  }
  if (rule.isEnabled && redirectTargets(actions) > 0 && !canForward(checkers)) {
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
