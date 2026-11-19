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
  isEveryMessageReply,
  MAIL_RULE_ACTION_OBJECT,
  MAIL_RULE_CONDITION_OBJECT,
  MAX_SCHEDULE_SLOTS,
  MAX_SIZE_KB,
  needsAction,
  parseCustomBody,
  setValues,
  variantType,
  type CustomRuleBody,
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
  onlyWhenAway: boolean;
}

function enumLabel(schema: Schema, enumName: string, value: unknown): string {
  if (typeof value !== 'string') return '';
  return getEnumVariant(schema, enumName, value)?.label ?? value;
}

function quoted(ctx: SummaryContext, value: string): string {
  return ctx.t('mailRules.summary.quoted', '“{{value}}”', { value });
}

function quotedValues(
  ctx: SummaryContext,
  value: unknown,
  type: 'conjunction' | 'disjunction' = 'disjunction',
): string {
  return formatList(
    setValues(value).map((item) => quoted(ctx, item)),
    type,
  );
}

function sizeOf(value: unknown): string | null {
  return typeof value === 'number' ? formatSize(value * KILOBYTE) : null;
}

function sizeRange(ctx: SummaryContext, condition: Record<string, unknown>): string {
  const min = sizeOf(condition.minKilobytes);
  const max = sizeOf(condition.maxKilobytes);
  if (min !== null && max !== null) return ctx.t('mailRules.summary.sizeRange', '{{min}} to {{max}}', { min, max });
  if (min !== null) return ctx.t('mailRules.summary.sizeAtLeast', 'at least {{size}}', { size: min });
  if (max !== null) return ctx.t('mailRules.summary.sizeAtMost', 'at most {{size}}', { size: max });
  return '';
}

function replyPhrase(ctx: SummaryContext, label: string, action: Record<string, unknown>): string {
  const subject = typeof action.subject === 'string' && action.subject ? quoted(ctx, action.subject) : '';
  if (!isEveryMessageReply(action)) return detailed(ctx, label, subject);
  return subject
    ? detailed(ctx, label, ctx.t('mailRules.summary.replyEveryMessage', '{{subject}}, to every message', { subject }))
    : ctx.t('mailRules.summary.replyToEveryMessage', '{{label}} to every message', { label });
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
      return detailed(ctx, label, sizeOf(condition.kilobytes) ?? '');
    case 'SizeBetween':
      return detailed(ctx, label, sizeRange(ctx, condition));
    case 'Keyword':
      return detailed(ctx, label, quotedValues(ctx, condition.keywords));
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
    case 'RemoveKeywords':
      return detailed(ctx, label, quotedValues(ctx, action.keywords, 'conjunction'));
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
      return replyPhrase(ctx, label, action);
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
    onlyWhenAway: custom.onlyWhenAway,
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
  const then = !summary.stopProcessing
    ? t('mailRules.summary.then', 'then {{actions}}', { actions })
    : summary.actions.length === 0
      ? t('mailRules.summary.thenOnlyStop', 'then stop processing more rules')
      : t('mailRules.summary.thenStop', 'then {{actions}} and stop processing more rules', { actions });
  const sentence = t('mailRules.summary.sentence', '{{when}}, {{then}}.', { when, then });
  return summary.onlyWhenAway
    ? t('mailRules.summary.whileAway', 'While the vacation response is in effect: {{sentence}}', { sentence })
    : sentence;
}

export function actionRequiredMessage(t: TFunction): string {
  return t('mailRules.builder.actionRequired', 'Add at least one action, or stop processing more rules.');
}

export function emptyActionsError(t: TFunction, custom: CustomRuleBody, error: string): string | undefined {
  const message = actionRequiredMessage(t);
  if (needsAction(custom)) return message;
  return error === message ? undefined : error;
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
    case 'sizeInvalid':
      return t('mailRules.issue.sizeInvalid', 'A size must be at least 1 KB and at most {{max}}.', {
        max: formatSize(MAX_SIZE_KB * KILOBYTE),
      });
    case 'sizeRangeEmpty':
      return t('mailRules.issue.sizeRangeEmpty', 'A size range needs a smallest size, a largest size or both.');
    case 'sizeRangeInverted':
      return t(
        'mailRules.issue.sizeRangeInverted',
        'The smallest size of a size range cannot be above its largest size.',
      );
  }
}
