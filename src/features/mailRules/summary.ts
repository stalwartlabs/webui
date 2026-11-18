/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { TFunction } from 'i18next';
import { isRecord, variantLabel } from '@/lib/embeddedSchema';
import {
  formatDateTime,
  formatIntervalEnd,
  formatList,
  formatLocalTime,
  formatPercent,
  formatSize,
} from '@/lib/format';
import { MINUTES_PER_DAY, localTimeFromMinutes, parseLocalTime } from '@/lib/localDateTime';
import { jmapMapToArray } from '@/lib/jmapUtils';
import { getEnumVariant } from '@/lib/schemaResolver';
import type { Schema } from '@/types/schema';
import {
  MAIL_RULE_ACTION_OBJECT,
  MAIL_RULE_CONDITION_OBJECT,
  MAX_SCHEDULE_SLOTS,
  parseCustomBody,
  setValues,
  variantType,
  type RuleIssue,
} from './model';

const KILOBYTE = 1024;

export interface SummaryContext {
  t: TFunction;
  schema: Schema;
  mailboxName?: (id: string) => string | undefined;
}

export interface RuleSummary {
  conditions: string[];
  matchAll: boolean;
  exceptions: string[];
  actions: string[];
  stopProcessing: boolean;
}

function enumLabel(schema: Schema, enumName: string, value: unknown): string {
  if (typeof value !== 'string') return '';
  return getEnumVariant(schema, enumName, value)?.label ?? value;
}

function quoted(ctx: SummaryContext, value: string): string {
  return ctx.t('mailRules.summary.quoted', '“{{value}}”', { value });
}

function quotedValues(ctx: SummaryContext, value: unknown): string {
  return formatList(
    setValues(value).map((item) => quoted(ctx, item)),
    'disjunction',
  );
}

function detailed(ctx: SummaryContext, label: string, detail: string): string {
  if (detail === '') return label;
  return ctx.t('mailRules.summary.detail', '{{label}}: {{detail}}', { label, detail });
}

function operatorTest(ctx: SummaryContext, enumName: string, item: Record<string, unknown>): string {
  return ctx.t('mailRules.summary.test', '{{operator}} {{values}}', {
    operator: enumLabel(ctx.schema, enumName, item.operator),
    values: quotedValues(ctx, item.values),
  });
}

function slotStart(value: unknown): string {
  return typeof value === 'string' ? formatLocalTime(value) : '';
}

function slotEnd(value: unknown): string {
  if (typeof value !== 'string') return '';
  return formatIntervalEnd(parseLocalTime(value) === 0 ? localTimeFromMinutes(MINUTES_PER_DAY) : value);
}

function scheduleSlots(ctx: SummaryContext, value: unknown): string {
  const slots = jmapMapToArray<unknown>(value)
    .filter(isRecord)
    .map((slot) =>
      ctx.t('mailRules.summary.slot', '{{days}} {{start}}–{{end}}', {
        days: formatList(setValues(slot.days).map((day) => enumLabel(ctx.schema, 'Weekday', day))),
        start: slotStart(slot.start),
        end: slotEnd(slot.end),
      }),
    );
  return slots.join('; ');
}

export function conditionPhrase(ctx: SummaryContext, condition: Record<string, unknown>): string {
  const type = variantType(condition) ?? '';
  const label = variantLabel(ctx.schema, MAIL_RULE_CONDITION_OBJECT, type) ?? type;
  switch (type) {
    case 'From':
    case 'To':
    case 'Cc':
    case 'ToOrCc':
    case 'RecipientAddress':
      return detailed(ctx, label, operatorTest(ctx, 'MailRuleAddressOperator', condition));
    case 'Subject':
    case 'Body':
    case 'AttachmentName':
    case 'AttachmentType':
    case 'RecipientDetail':
    case 'SubjectOrBody':
      return detailed(ctx, label, operatorTest(ctx, 'MailRuleTextOperator', condition));
    case 'Header':
      return detailed(
        ctx,
        typeof condition.header === 'string' ? condition.header : label,
        operatorTest(ctx, 'MailRuleTextOperator', condition),
      );
    case 'HeaderExists':
      return detailed(ctx, label, typeof condition.header === 'string' ? condition.header : '');
    case 'SentToMe':
      return detailed(ctx, label, enumLabel(ctx.schema, 'MailRuleSentToMePlacement', condition.placement));
    case 'SizeOver':
    case 'SizeUnder':
      return detailed(
        ctx,
        label,
        typeof condition.kilobytes === 'number' ? formatSize(condition.kilobytes * KILOBYTE) : '',
      );
    case 'Importance':
      return detailed(ctx, label, enumLabel(ctx.schema, 'MailRuleImportanceLevel', condition.level));
    case 'Sensitivity':
      return detailed(ctx, label, enumLabel(ctx.schema, 'MailRuleSensitivityLevel', condition.level));
    case 'MessageType':
      return detailed(ctx, label, enumLabel(ctx.schema, 'MailRuleMessageKind', condition.kind));
    case 'SpamScore':
      return detailed(ctx, label, typeof condition.percent === 'number' ? formatPercent(condition.percent, 0) : '');
    case 'ReceivedAfter':
    case 'ReceivedBefore':
      return detailed(ctx, label, typeof condition.date === 'string' ? formatDateTime(condition.date) : '');
    case 'Schedule':
      return detailed(ctx, label, scheduleSlots(ctx, condition.slots));
    default:
      return label;
  }
}

function mailboxPhrase(ctx: SummaryContext, value: unknown): string {
  if (typeof value !== 'string' || value === '') return '';
  return quoted(ctx, ctx.mailboxName?.(value) ?? value);
}

export function actionPhrase(ctx: SummaryContext, action: Record<string, unknown>): string {
  const type = variantType(action) ?? '';
  const label = variantLabel(ctx.schema, MAIL_RULE_ACTION_OBJECT, type) ?? type;
  switch (type) {
    case 'MoveTo':
    case 'CopyTo':
      return detailed(ctx, label, mailboxPhrase(ctx, action.mailboxId));
    case 'AddKeywords':
      return detailed(ctx, label, quotedValues(ctx, action.keywords));
    case 'Redirect': {
      const addresses = formatList(setValues(action.addresses));
      const detail =
        action.keepCopy === false
          ? ctx.t('mailRules.summary.withoutCopy', '{{addresses}} without keeping a copy', { addresses })
          : addresses;
      return detailed(ctx, label, detail);
    }
    case 'SetImportance':
      return detailed(ctx, label, enumLabel(ctx.schema, 'MailRuleImportanceLevel', action.level));
    case 'Reply':
      return detailed(
        ctx,
        label,
        typeof action.subject === 'string' && action.subject ? quoted(ctx, action.subject) : '',
      );
    case 'Reject':
      return detailed(ctx, label, typeof action.reason === 'string' && action.reason ? quoted(ctx, action.reason) : '');
    default:
      return label;
  }
}

export function summarizeCustomRule(ctx: SummaryContext, body: Record<string, unknown>): RuleSummary {
  const custom = parseCustomBody(body);
  return {
    conditions: custom.conditions.map((condition) => conditionPhrase(ctx, condition)),
    matchAll: custom.matchAll,
    exceptions: custom.exceptions.map((condition) => conditionPhrase(ctx, condition)),
    actions: custom.actions.map((action) => actionPhrase(ctx, action)),
    stopProcessing: custom.stopProcessing,
  };
}

export function ruleSentence(ctx: SummaryContext, summary: RuleSummary): string {
  const { t } = ctx;
  let when =
    summary.conditions.length === 0
      ? t('mailRules.summary.always', 'For every message')
      : t('mailRules.summary.if', 'If {{conditions}}', {
          conditions: formatList(summary.conditions, summary.matchAll ? 'conjunction' : 'disjunction'),
        });
  if (summary.exceptions.length > 0) {
    when = t('mailRules.summary.except', '{{when}}, except if {{exceptions}}', {
      when,
      exceptions: formatList(summary.exceptions, 'disjunction'),
    });
  }
  const actions =
    summary.actions.length === 0 ? t('mailRules.summary.noActions', 'do nothing') : formatList(summary.actions);
  const then = summary.stopProcessing
    ? t('mailRules.summary.thenStop', 'then {{actions}} and stop processing more rules', { actions })
    : t('mailRules.summary.then', 'then {{actions}}', { actions });
  return t('mailRules.summary.sentence', '{{when}}, {{then}}.', { when, then });
}

export function ruleIssueMessage(t: TFunction, issue: RuleIssue): string {
  switch (issue) {
    case 'rejectNotAlone':
      return t('mailRules.issue.rejectNotAlone', 'A rule that rejects mail cannot have other actions.');
    case 'rejectNeedsAuthentication':
      return t(
        'mailRules.issue.rejectNeedsAuthentication',
        'A rule that rejects mail must match all conditions and require an authenticated sender.',
      );
    case 'forwardingNotAllowed':
      return t(
        'mailRules.issue.forwardingNotAllowed',
        'Your account is not allowed to forward mail, so this rule cannot be saved while it is enabled.',
      );
    case 'scheduleTooManySlots':
      return t(
        'mailRules.issue.scheduleTooManySlots',
        'Adjacent schedule conditions are combined into one, which can have at most {{max}} time slots.',
        { max: MAX_SCHEDULE_SLOTS },
      );
  }
}
