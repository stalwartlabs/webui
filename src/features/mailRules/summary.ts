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
import { fallbackMailboxName } from './mailboxes';
import {
  hasFlag,
  isEveryMessageReply,
  MAIL_RULE_CONDITION_OBJECT,
  MAX_SIZE_KB,
  otherKeywords,
  parseCustomBody,
  setValues,
  variantType,
  type FlagAction,
  type RuleActions,
  type RuleIssue,
} from './model';

const KILOBYTE = 1024;

export interface SummaryContext {
  t: TFunction;
  schema: Schema;
  mailboxName?: (id: string) => string | undefined;
}

export interface RuleSummary {
  matchAll: string[];
  matchAny: string[];
  matchNone: string[];
  actions: string[];
  stopProcessing: boolean;
}

export function actionLabel(t: TFunction, action: FlagAction | keyof RuleActions): string {
  switch (action) {
    case 'markRead':
      return t('mailRules.action.markRead', 'Mark as read');
    case 'flag':
      return t('mailRules.action.flag', 'Flag');
    case 'clearFlag':
      return t('mailRules.action.clearFlag', 'Clear the flag');
    case 'markNotJunk':
      return t('mailRules.action.markNotJunk', 'Mark as not spam');
    case 'addKeywords':
      return t('mailRules.action.addKeywords', 'Add keywords');
    case 'removeKeywords':
      return t('mailRules.action.removeKeywords', 'Remove keywords');
    case 'clearKeywords':
      return t('mailRules.action.clearKeywords', 'Remove all keywords added by earlier rules');
    case 'setImportance':
      return t('mailRules.action.setImportance', 'Set the importance');
    case 'redirect':
      return t('mailRules.action.redirect', 'Redirect to other addresses');
    case 'reply':
      return t('mailRules.action.reply', 'Reply with a template');
    case 'copyTo':
      return t('mailRules.action.copyTo', 'Copy to');
    case 'moveTo':
      return t('mailRules.action.moveTo', 'Move to');
    case 'discard':
      return t('mailRules.action.discard', 'Delete permanently');
    case 'reject':
      return t('mailRules.action.reject', 'Reject with a message');
    case 'stopProcessing':
      return t('mailRules.action.stopProcessing', 'Stop processing more rules');
  }
}

export function keywordName(t: TFunction, keyword: string): string | undefined {
  switch (keyword) {
    case '$seen':
      return t('mailRules.keyword.seen', 'Read');
    case '$flagged':
      return t('mailRules.keyword.flagged', 'Flagged');
    case '$answered':
      return t('mailRules.keyword.answered', 'Replied');
    case '$forwarded':
      return t('mailRules.keyword.forwarded', 'Forwarded');
    case '$draft':
      return t('mailRules.keyword.draft', 'Draft');
    case '$deleted':
      return t('mailRules.keyword.deleted', 'Marked for deletion');
    case '$important':
      return t('mailRules.keyword.important', 'Important');
    case '$junk':
      return t('mailRules.keyword.junk', 'Spam');
    case '$notjunk':
      return t('mailRules.keyword.notJunk', 'Not spam');
    case '$phishing':
      return t('mailRules.keyword.phishing', 'Phishing');
    default:
      return undefined;
  }
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
  values: readonly string[],
  type: 'conjunction' | 'disjunction' = 'disjunction',
): string {
  return formatList(
    values.map((value) => quoted(ctx, value)),
    type,
  );
}

function quotedKeywords(
  ctx: SummaryContext,
  keywords: readonly string[],
  type: 'conjunction' | 'disjunction' = 'disjunction',
): string {
  return quotedValues(
    ctx,
    keywords.map((keyword) => keywordName(ctx.t, keyword) ?? keyword),
    type,
  );
}

function sizeOf(value: unknown): string | null {
  return typeof value === 'number' ? formatSize(value * KILOBYTE) : null;
}

function replyPhrase(ctx: SummaryContext, reply: Record<string, unknown>): string {
  const { t } = ctx;
  const subject = typeof reply.subject === 'string' && reply.subject ? quoted(ctx, reply.subject) : '';
  if (isEveryMessageReply(reply)) {
    return subject
      ? t('mailRules.summary.action.replySubjectEveryMessage', 'reply with {{subject}} to every message', { subject })
      : t('mailRules.summary.action.replyEveryMessage', 'reply to every message');
  }
  if (typeof reply.days !== 'number') {
    return subject
      ? t('mailRules.summary.action.replySubject', 'reply with {{subject}}', { subject })
      : t('mailRules.summary.action.reply', 'reply with a template');
  }
  const count = reply.days;
  return subject
    ? t('mailRules.summary.action.replySubjectDays', {
        subject,
        count,
        defaultValue_one: 'reply with {{subject}} at most once a day per sender',
        defaultValue_other: 'reply with {{subject}} at most once every {{count}} days per sender',
      })
    : t('mailRules.summary.action.replyDays', {
        count,
        defaultValue_one: 'reply at most once a day per sender',
        defaultValue_other: 'reply at most once every {{count}} days per sender',
      });
}

function detailed(ctx: SummaryContext, label: string, detail: string): string {
  if (detail === '') return label;
  return ctx.t('mailRules.summary.detail', '{{label}}: {{detail}}', { label, detail });
}

function operatorTest(ctx: SummaryContext, enumName: string, item: Record<string, unknown>): string {
  return ctx.t('mailRules.summary.test', '{{operator}} {{values}}', {
    operator: enumLabel(ctx.schema, enumName, item.operator),
    values: quotedValues(ctx, setValues(item.values)),
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
  return formatList(slots, 'unit');
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
    case 'Keyword':
      return detailed(ctx, label, quotedKeywords(ctx, setValues(condition.keywords)));
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

function mailboxNames(ctx: SummaryContext, ids: readonly string[]): string {
  return quotedValues(
    ctx,
    ids.map((id) => ctx.mailboxName?.(id) ?? fallbackMailboxName(ctx.t, id)),
    'conjunction',
  );
}

export function actionPhrases(ctx: SummaryContext, actions: RuleActions): string[] {
  const { t } = ctx;
  const phrases: string[] = [];
  const keywords = (list: readonly string[]) => ({
    count: list.length,
    keywords: quotedKeywords(ctx, list, 'conjunction'),
  });

  if (actions.clearKeywords) {
    phrases.push(t('mailRules.summary.action.clearKeywords', 'remove all keywords added by earlier rules'));
  }
  if (hasFlag(actions, 'clearFlag')) phrases.push(t('mailRules.summary.action.clearFlag', 'clear the flag'));
  const removed = otherKeywords(actions, 'removeKeywords');
  if (removed.length > 0) {
    phrases.push(
      t('mailRules.summary.action.removeKeywords', {
        ...keywords(removed),
        defaultValue_one: 'remove the keyword {{keywords}}',
        defaultValue_other: 'remove the keywords {{keywords}}',
      }),
    );
  }
  if (hasFlag(actions, 'markRead')) phrases.push(t('mailRules.summary.action.markRead', 'mark it as read'));
  if (hasFlag(actions, 'flag')) phrases.push(t('mailRules.summary.action.flag', 'flag it'));
  if (hasFlag(actions, 'markNotJunk')) phrases.push(t('mailRules.summary.action.markNotJunk', 'mark it as not spam'));
  const added = otherKeywords(actions, 'addKeywords');
  if (added.length > 0) {
    phrases.push(
      t('mailRules.summary.action.addKeywords', {
        ...keywords(added),
        defaultValue_one: 'add the keyword {{keywords}}',
        defaultValue_other: 'add the keywords {{keywords}}',
      }),
    );
  }
  if (actions.setImportance !== null) {
    phrases.push(
      t('mailRules.summary.action.setImportance', 'set the importance to {{level}}', {
        level: enumLabel(ctx.schema, 'MailRuleImportanceLevel', actions.setImportance),
      }),
    );
  }
  if (actions.redirect) {
    const addresses = formatList(setValues(actions.redirect.addresses));
    phrases.push(
      actions.redirect.keepCopy === false
        ? t('mailRules.summary.action.redirectWithoutCopy', 'redirect to {{addresses}} without keeping a copy', {
            addresses,
          })
        : t('mailRules.summary.action.redirect', 'redirect to {{addresses}}', { addresses }),
    );
  }
  if (actions.reply) phrases.push(replyPhrase(ctx, actions.reply));
  if (actions.copyTo.length > 0) {
    phrases.push(
      t('mailRules.summary.action.copyTo', 'copy it to {{mailboxes}}', {
        mailboxes: mailboxNames(ctx, actions.copyTo),
      }),
    );
  }
  if (actions.moveTo.length > 0) {
    phrases.push(
      t('mailRules.summary.action.moveTo', 'move it to {{mailboxes}}', {
        mailboxes: mailboxNames(ctx, actions.moveTo),
      }),
    );
  }
  if (actions.discard) phrases.push(t('mailRules.summary.action.discard', 'delete it permanently'));
  if (actions.reject) {
    const { reason } = actions.reject;
    phrases.push(
      typeof reason === 'string' && reason
        ? t('mailRules.summary.action.rejectReason', 'reject it with {{reason}}', { reason: quoted(ctx, reason) })
        : t('mailRules.summary.action.reject', 'reject it'),
    );
  }
  return phrases;
}

export function summarizeCustomRule(ctx: SummaryContext, body: Record<string, unknown>): RuleSummary {
  const { conditions, actions } = parseCustomBody(body);
  const phrase = (condition: Record<string, unknown>) => conditionPhrase(ctx, condition);
  return {
    matchAll: conditions.matchAll.map(phrase),
    matchAny: conditions.matchAny.map(phrase),
    matchNone: conditions.matchNone.map(phrase),
    actions: actionPhrases(ctx, actions),
    stopProcessing: actions.stopProcessing || actions.reject !== null,
  };
}

type SentenceOpening = 'always' | 'if';
type SentenceEnding = 'then' | 'thenStop' | 'onlyStop' | 'nothing';

type SentenceValues = {
  conditions: string;
  exceptions: string;
  actions: string;
};

function conditionsClause(t: TFunction, { matchAll, matchAny }: RuleSummary): string {
  if (matchAll.length > 0 && matchAny.length > 1) {
    return t('mailRules.summary.allAndAny', '{{all}}, and either {{any}}', {
      all: formatList(matchAll),
      any: formatList(matchAny, 'disjunction'),
    });
  }
  return matchAll.length > 0 ? formatList([...matchAll, ...matchAny]) : formatList(matchAny, 'disjunction');
}

function sentence(
  t: TFunction,
  opening: SentenceOpening,
  except: boolean,
  ending: SentenceEnding,
  values: SentenceValues,
): string {
  switch (`${opening}${except ? 'Except' : ''}_${ending}` as const) {
    case 'always_then':
      return t('mailRules.summary.rule.always_then', 'For every message, then {{actions}}.', values);
    case 'always_thenStop':
      return t(
        'mailRules.summary.rule.always_thenStop',
        'For every message, then {{actions}}, and stop processing more rules.',
        values,
      );
    case 'always_onlyStop':
      return t('mailRules.summary.rule.always_onlyStop', 'For every message, then stop processing more rules.', values);
    case 'always_nothing':
      return t('mailRules.summary.rule.always_nothing', 'For every message, then do nothing.', values);
    case 'alwaysExcept_then':
      return t(
        'mailRules.summary.rule.alwaysExcept_then',
        'For every message, except if {{exceptions}}, then {{actions}}.',
        values,
      );
    case 'alwaysExcept_thenStop':
      return t(
        'mailRules.summary.rule.alwaysExcept_thenStop',
        'For every message, except if {{exceptions}}, then {{actions}}, and stop processing more rules.',
        values,
      );
    case 'alwaysExcept_onlyStop':
      return t(
        'mailRules.summary.rule.alwaysExcept_onlyStop',
        'For every message, except if {{exceptions}}, then stop processing more rules.',
        values,
      );
    case 'alwaysExcept_nothing':
      return t(
        'mailRules.summary.rule.alwaysExcept_nothing',
        'For every message, except if {{exceptions}}, then do nothing.',
        values,
      );
    case 'if_then':
      return t('mailRules.summary.rule.if_then', 'If {{conditions}}, then {{actions}}.', values);
    case 'if_thenStop':
      return t(
        'mailRules.summary.rule.if_thenStop',
        'If {{conditions}}, then {{actions}}, and stop processing more rules.',
        values,
      );
    case 'if_onlyStop':
      return t('mailRules.summary.rule.if_onlyStop', 'If {{conditions}}, then stop processing more rules.', values);
    case 'if_nothing':
      return t('mailRules.summary.rule.if_nothing', 'If {{conditions}}, then do nothing.', values);
    case 'ifExcept_then':
      return t(
        'mailRules.summary.rule.ifExcept_then',
        'If {{conditions}}, except if {{exceptions}}, then {{actions}}.',
        values,
      );
    case 'ifExcept_thenStop':
      return t(
        'mailRules.summary.rule.ifExcept_thenStop',
        'If {{conditions}}, except if {{exceptions}}, then {{actions}}, and stop processing more rules.',
        values,
      );
    case 'ifExcept_onlyStop':
      return t(
        'mailRules.summary.rule.ifExcept_onlyStop',
        'If {{conditions}}, except if {{exceptions}}, then stop processing more rules.',
        values,
      );
    case 'ifExcept_nothing':
      return t(
        'mailRules.summary.rule.ifExcept_nothing',
        'If {{conditions}}, except if {{exceptions}}, then do nothing.',
        values,
      );
  }
}

export function ruleSentence(ctx: SummaryContext, summary: RuleSummary): string {
  const hasActions = summary.actions.length > 0;
  const ending: SentenceEnding = summary.stopProcessing
    ? hasActions
      ? 'thenStop'
      : 'onlyStop'
    : hasActions
      ? 'then'
      : 'nothing';
  return sentence(
    ctx.t,
    summary.matchAll.length > 0 || summary.matchAny.length > 0 ? 'if' : 'always',
    summary.matchNone.length > 0,
    ending,
    {
      conditions: conditionsClause(ctx.t, summary),
      exceptions: formatList(summary.matchNone, 'disjunction'),
      actions: formatList(summary.actions),
    },
  );
}

export function actionRequiredMessage(t: TFunction): string {
  return t('mailRules.builder.actionRequired', 'Add at least one action, or stop processing more rules.');
}

export function ruleIssueMessage(t: TFunction, issue: RuleIssue): string {
  switch (issue) {
    case 'rejectNotAlone':
      return t('mailRules.issue.rejectNotAlone', 'A rule that rejects mail cannot have other actions.');
    case 'keywordConflict':
      return t('mailRules.issue.keywordConflict', 'A rule cannot both add and remove the same keyword.');
    case 'forwardingNotAllowed':
      return t(
        'mailRules.issue.forwardingNotAllowed',
        'Your account is not allowed to forward mail, so this rule cannot be saved while it is enabled.',
      );
    case 'sizeInvalid':
      return t('mailRules.issue.sizeInvalid', 'A size must be at least 1 KB and at most {{max}}.', {
        max: formatSize(MAX_SIZE_KB * KILOBYTE),
      });
  }
}
