/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/forms/FieldRow';
import { FieldScopeProvider } from '@/components/forms/FormProvider';
import { ValueRow } from '@/components/values/FieldValue';
import { fieldIds, useFormContext } from '@/components/forms/formContext';
import { missingNestedFields } from '@/components/forms/formLogic';
import type { FieldRenderProps } from '@/components/forms/useDynamicForm';
import { usePermissionCheckers } from '@/hooks/usePermissions';
import { isRecord, resolveEmbedded } from '@/lib/embeddedSchema';
import { buildNewObjectValue } from '@/lib/schemaResolver';
import type { ViewRenderProps } from '@/components/views/DynamicView';
import { useRuleAccountId } from '../account';
import { appendItem, listEntries, type ListItems } from '../builder';
import { mailboxNamer } from '../mailboxes';
import {
  hasOtherAction,
  MAIL_RULE_ACTIONS_OBJECT,
  needsAction,
  MAIL_RULE_CONDITION_OBJECT,
  MAIL_RULE_CONDITIONS_OBJECT,
  parseCustomBody,
  ruleIssues,
  type ConditionGroup,
  type RuleIssue,
} from '../model';
import { useMailboxOptions } from '../queries';
import { ruleIssueMessage, ruleSentence, summarizeCustomRule } from '../summary';
import { ActionForm } from './ActionForm';
import { RuleItemList, type RuleItemListProps } from './RuleItemList';

function Step({ number, heading, children }: { number: number; heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3 py-4">
      <h2 className="flex items-center gap-2.5 text-[14px] font-semibold">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] text-ink-foreground"
          aria-hidden="true"
        >
          {number}
        </span>
        {heading}
      </h2>
      <div className="space-y-3 sm:pl-[34px]">{children}</div>
    </section>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] leading-relaxed text-muted-foreground">{children}</p>;
}

function IssueList({ issues }: { issues: readonly RuleIssue[] }) {
  const { t } = useTranslation();
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-1.5 py-3">
      {issues.map((issue) => (
        <li key={issue} className="flex items-start gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {ruleIssueMessage(t, issue)}
        </li>
      ))}
    </ul>
  );
}

function RulePreview({ body, incomplete }: { body: Record<string, unknown>; incomplete: boolean }) {
  const { t } = useTranslation();
  const { schema, idPrefix } = useFormContext();
  const accountId = useRuleAccountId();
  const mailboxes = useMailboxOptions(accountId);
  const ctx = {
    t,
    schema,
    mailboxName: mailboxNamer(t, mailboxes.status === 'ready' ? mailboxes.options : undefined),
  };
  return (
    <section
      className="space-y-1.5 rounded-xl bg-muted px-4 py-3"
      aria-labelledby={`${idPrefix}-preview`}
      data-testid="mail-rule-preview"
    >
      <h2
        id={`${idPrefix}-preview`}
        className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {t('mailRules.builder.preview', 'Summary')}
      </h2>
      <p className="text-[14px] leading-relaxed">
        {incomplete
          ? t('mailRules.builder.previewIncomplete', 'Nothing yet: choose what to do with matching messages.')
          : ruleSentence(ctx, summarizeCustomRule(ctx, body))}
      </p>
      <Hint>
        {t(
          'mailRules.builder.whenItRuns',
          'Rules run on new mail as it arrives. Saving does not change messages already in your mailboxes.',
        )}
      </Hint>
    </section>
  );
}

const OPTIONAL_GROUPS = ['matchAny', 'matchNone'] as const;

type OptionalGroup = (typeof OPTIONAL_GROUPS)[number];

export function RuleBuilderRow({ data: body, errors, readOnly, onFieldChange }: FieldRenderProps) {
  const { t } = useTranslation();
  const { schema, idPrefix } = useFormContext();
  const checkers = usePermissionCheckers();
  const [focusGroup, setFocusGroup] = useState<OptionalGroup | null>(null);
  const { conditions, actions } = parseCustomBody(body);
  const groups = isRecord(body.conditions) ? body.conditions : {};
  const groupFields = resolveEmbedded(schema, MAIL_RULE_CONDITIONS_OBJECT, groups)?.fields?.properties ?? {};
  const issues = ruleIssues({ isEnabled: true, body }, checkers);
  const conditionsMarked =
    !!errors.conditions && missingNestedFields(schema, MAIL_RULE_CONDITIONS_OBJECT, groups).length > 0;
  const actionsMarked =
    !!errors.actions && missingNestedFields(schema, MAIL_RULE_ACTIONS_OBJECT, body.actions).length > 0;
  const hasAll = conditions.matchAll.length > 0;

  const groupText = (group: ConditionGroup) => {
    switch (group) {
      case 'matchAll':
        return {
          title: '',
          hint: hasAll
            ? t('mailRules.builder.conditionsHint', 'A message must match every condition.')
            : t('mailRules.builder.noConditions', 'No conditions: the rule applies to every message.'),
          joiner: t('mailRules.builder.and', 'and'),
          item: (n: number) => t('mailRules.builder.conditionN', 'Condition {{n}}', { n }),
          add: t('mailRules.builder.addCondition', 'Add condition'),
          addHint: '',
        };
      case 'matchAny':
        return {
          title: t('mailRules.builder.alternatives', 'Alternatives'),
          hint: hasAll
            ? t('mailRules.builder.alternativesHintAnd', 'A message must also match at least one alternative.')
            : t('mailRules.builder.alternativesHint', 'A message must match at least one alternative.'),
          joiner: t('mailRules.builder.or', 'or'),
          item: (n: number) => t('mailRules.builder.alternativeN', 'Alternative {{n}}', { n }),
          add: t('mailRules.builder.addAlternative', 'Add alternative'),
          addHint: t('mailRules.builder.addAlternativeHint', 'Match one of several conditions, such as two senders.'),
        };
      case 'matchNone':
        return {
          title: t('mailRules.builder.exceptions', 'Exceptions'),
          hint: t('mailRules.builder.exceptionsHint', 'The rule skips a message that matches any exception.'),
          joiner: t('mailRules.builder.or', 'or'),
          item: (n: number) => t('mailRules.builder.exceptionN', 'Exception {{n}}', { n }),
          add: t('mailRules.builder.addException', 'Add exception'),
          addHint: t('mailRules.builder.addExceptionHint', 'Skip messages that would otherwise match.'),
        };
    }
  };

  const change = (group: ConditionGroup, next: ListItems) => {
    if (group !== 'matchAll' && listEntries(next).length === 0) setFocusGroup(group);
    onFieldChange('conditions', { ...groups, [group]: next });
  };

  const listProps = (group: ConditionGroup): RuleItemListProps => {
    const type = groupFields[group]?.type;
    const text = groupText(group);
    return {
      name: group,
      objectName: MAIL_RULE_CONDITION_OBJECT,
      value: groups[group],
      onChange: (next) => change(group, next),
      readOnly,
      invalid: !!errors.conditions,
      maxItems: type?.type === 'objectList' ? type.maxItems : undefined,
      itemLabel: text.item,
      addLabel: text.add,
      joiner: text.joiner,
    };
  };

  const group = (name: ConditionGroup) => {
    const text = groupText(name);
    if (!text.title) {
      return (
        <div key={name} className="space-y-2">
          <Hint>{text.hint}</Hint>
          <RuleItemList {...listProps(name)} />
        </div>
      );
    }
    return (
      <div key={name} className="space-y-2" role="group" aria-labelledby={`${idPrefix}-${name}-title`}>
        <div>
          <h3 id={`${idPrefix}-${name}-title`} className="text-[13px] font-semibold">
            {text.title}
          </h3>
          <Hint>{text.hint}</Hint>
        </div>
        <RuleItemList {...listProps(name)} />
      </div>
    );
  };

  const emptyGroups = OPTIONAL_GROUPS.filter((name) => conditions[name].length === 0);

  return (
    <div className="space-y-1" data-testid="mail-rule-builder">
      <RulePreview body={body} incomplete={needsAction(actions)} />

      <div className="divide-y divide-border">
        <Step number={1} heading={t('mailRules.builder.which', 'Conditions')}>
          <FieldError
            id={fieldIds(idPrefix, ['conditions']).errorId}
            error={conditionsMarked ? undefined : errors.conditions}
          />
          <FieldScopeProvider name="conditions" readOnly={readOnly}>
            <div className="space-y-5">
              {group('matchAll')}
              {OPTIONAL_GROUPS.filter((name) => conditions[name].length > 0).map(group)}
              {!readOnly && emptyGroups.length > 0 && (
                <ul className="space-y-2">
                  {emptyGroups.map((name) => {
                    const text = groupText(name);
                    return (
                      <li key={name} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          autoFocus={focusGroup === name}
                          onClick={() => {
                            setFocusGroup(null);
                            change(
                              name,
                              appendItem(groups[name], buildNewObjectValue(schema, MAIL_RULE_CONDITION_OBJECT)),
                            );
                          }}
                        >
                          <Plus className="size-4" aria-hidden="true" />
                          {text.add}
                        </Button>
                        <span className="text-[12.5px] text-muted-foreground">{text.addHint}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </FieldScopeProvider>
        </Step>

        <Step number={2} heading={t('mailRules.builder.what', 'Actions')}>
          <FieldError id={fieldIds(idPrefix, ['actions']).errorId} error={actionsMarked ? undefined : errors.actions} />
          <ActionForm
            value={body.actions}
            onChange={(next) => onFieldChange('actions', next)}
            readOnly={readOnly}
            invalid={!!errors.actions}
          />
          {actions.stopProcessing && !actions.reject && !hasOtherAction(actions) && (
            <Hint>
              {t(
                'mailRules.builder.onlyStop',
                'Without other actions, a matching message only stops later rules from running.',
              )}
            </Hint>
          )}
        </Step>

        <IssueList issues={issues} />
      </div>
    </div>
  );
}

export function RuleSummaryRow({ schema, data }: ViewRenderProps) {
  const { t } = useTranslation();
  const accountId = useRuleAccountId();
  const mailboxes = useMailboxOptions(accountId);
  const ctx = {
    t,
    schema,
    mailboxName: mailboxNamer(t, mailboxes.status === 'ready' ? mailboxes.options : undefined),
  };
  return (
    <ValueRow
      schema={schema}
      label={t('mailRules.summaryLabel', 'Summary')}
      type={undefined}
      value={ruleSentence(ctx, summarizeCustomRule(ctx, data))}
    />
  );
}
