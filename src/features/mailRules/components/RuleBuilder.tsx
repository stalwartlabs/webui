/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { FieldError, FieldRow } from '@/components/forms/FieldRow';
import { ValueRow } from '@/components/values/FieldValue';
import { fieldIds, useFormContext } from '@/components/forms/formContext';
import { missingNestedFields } from '@/components/forms/formLogic';
import type { FieldRenderProps } from '@/components/forms/useDynamicForm';
import { usePermissionCheckers } from '@/hooks/usePermissions';
import { embeddedEntries, resolveEmbedded } from '@/lib/embeddedSchema';
import { cn } from '@/lib/utils';
import type { ViewRenderProps } from '@/components/views/DynamicView';
import type { Field, FieldTypeObjectList } from '@/types/schema';
import { useRuleAccountId } from '../account';
import { listEntries } from '../builder';
import { mailboxNameResolver } from '../mailboxes';
import {
  hasRejectAction,
  hasScheduleCondition,
  isRejectAllowed,
  MAIL_RULE_ACTION_OBJECT,
  MAIL_RULE_CONDITION_OBJECT,
  MAIL_RULE_OBJECT,
  parseCustomBody,
  REJECT_ACTION,
  ruleIssues,
  type RuleIssue,
} from '../model';
import { useMailboxOptions } from '../queries';
import { ruleIssueMessage, ruleSentence, summarizeCustomRule } from '../summary';
import { RuleItemList } from './RuleItemList';

const TRAILING_FIELDS = new Set(['stopProcessing', 'timeZone']);
const RULE_ERROR_FIELDS = ['matchAll', 'conditions', 'exceptions'] as const;
const STOP_PROCESSING = 'stopProcessing';
const TOGGLE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

function listBounds(field: Field | undefined): { minItems?: number; maxItems?: number } {
  const type = field?.type as FieldTypeObjectList | undefined;
  return type?.type === 'objectList' ? { minItems: type.minItems, maxItems: type.maxItems } : {};
}

function MatchModeToggle({
  matchAll,
  onChange,
  readOnly,
}: {
  matchAll: boolean;
  onChange: (matchAll: boolean) => void;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const options = [
    { value: true, label: t('mailRules.builder.all', 'all') },
    { value: false, label: t('mailRules.builder.any', 'any') },
  ];
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (readOnly || !TOGGLE_KEYS.has(event.key)) return;
    event.preventDefault();
    onChange(!matchAll);
    event.currentTarget.querySelector<HTMLButtonElement>('[aria-checked="false"]')?.focus();
  };
  return (
    <span
      role="radiogroup"
      aria-label={t('mailRules.builder.matchMode', 'Conditions that must match')}
      className="inline-flex rounded-lg bg-muted p-0.5 align-middle"
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={matchAll === option.value}
          tabIndex={matchAll === option.value ? 0 : -1}
          disabled={readOnly}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-2.5 py-0.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            matchAll === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}

function Step({ heading, title, children }: { heading: string; title?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 py-3">
      <h3 className={title ? 'sr-only' : 'text-[13.5px] font-semibold'}>{heading}</h3>
      {title && <div className="text-[13.5px] font-semibold">{title}</div>}
      {children}
    </section>
  );
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

export function RuleBuilderRow({ data: body, errors, readOnly, onFieldChange: set }: FieldRenderProps) {
  const { t } = useTranslation();
  const { schema, idPrefix } = useFormContext();
  const checkers = usePermissionCheckers();
  const exceptionsButton = useRef<HTMLButtonElement>(null);
  const custom = parseCustomBody(body);
  const resolved = resolveEmbedded(schema, MAIL_RULE_OBJECT, body);
  const entries = resolved ? embeddedEntries(resolved) : [];
  const fieldOf = (name: string) => entries.find((entry) => entry.formField.name === name);
  const [exceptionsExpanded, setExceptionsExpanded] = useState<boolean | null>(null);
  const missing = new Set(
    errors.conditions || errors.exceptions || errors.actions ? missingNestedFields(schema, MAIL_RULE_OBJECT, body) : [],
  );
  const errorOf = (name: string) => (missing.has(name) ? undefined : errors[name]);
  const issues = ruleIssues({ isEnabled: true, body }, checkers);
  const hasReject = hasRejectAction(custom);
  const rejectBlocked =
    custom.actions.length > 1
      ? t('mailRules.builder.rejectNotAlone', 'Reject must be the only action.')
      : isRejectAllowed(custom)
        ? undefined
        : t(
            'mailRules.builder.rejectNeedsAuthentication',
            'Reject needs all conditions to match, including an authenticated sender.',
          );
  const disabledActions = rejectBlocked ? new Map([[REJECT_ACTION, rejectBlocked]]) : undefined;
  const conditionLabel = (n: number) => t('mailRules.builder.conditionN', 'Condition {{n}}', { n });
  const exceptionLabel = (n: number) => t('mailRules.builder.exceptionN', 'Exception {{n}}', { n });
  const actionLabel = (n: number) => t('mailRules.builder.actionN', 'Action {{n}}', { n });
  const showExceptions = !!errors.exceptions || (exceptionsExpanded ?? custom.exceptions.length > 0);
  const exceptionsId = `${fieldIds(idPrefix, ['exceptions']).inputId}-list`;
  const actionsErrorId = fieldIds(idPrefix, ['actions']).errorId;
  const ruleErrorField = RULE_ERROR_FIELDS.find((name) => errorOf(name));
  const actionsError =
    errors.actions &&
    (custom.actions.length === 0
      ? t('mailRules.builder.actionRequired', 'Add at least one action.')
      : errorOf('actions'));
  const changeExceptions = (next: unknown) => {
    if (custom.exceptions.length > 0 && listEntries(next).length === 0) exceptionsButton.current?.focus();
    set('exceptions', next);
  };
  const trailing = entries.filter(
    ({ formField }) =>
      TRAILING_FIELDS.has(formField.name) && (formField.name !== 'timeZone' || hasScheduleCondition(custom)),
  );

  return (
    <div className="divide-y divide-border" data-testid="mail-rule-builder">
      {ruleErrorField && (
        <div className="py-3">
          <FieldError id={fieldIds(idPrefix, [ruleErrorField]).errorId} error={errorOf(ruleErrorField)} />
        </div>
      )}
      <Step
        heading={
          custom.conditions.length >= 2
            ? t('mailRules.builder.conditions', 'Conditions')
            : custom.conditions.length === 1
              ? t('mailRules.builder.ifOne', 'If this condition matches')
              : t('mailRules.builder.ifNone', 'For every message')
        }
        title={
          custom.conditions.length >= 2 && (
            <span className="flex flex-wrap items-center gap-1.5">
              {t('mailRules.builder.ifPrefix', 'If')}
              <MatchModeToggle
                matchAll={custom.matchAll}
                onChange={(matchAll) => set('matchAll', matchAll)}
                readOnly={readOnly}
              />
              {t('mailRules.builder.ifSuffix', 'of these conditions match')}
            </span>
          )
        }
      >
        {custom.conditions.length === 0 && (
          <p className="text-[12.5px] text-muted-foreground">
            {t('mailRules.builder.noConditions', 'Without conditions the rule applies to every message.')}
          </p>
        )}
        <RuleItemList
          name="conditions"
          objectName={MAIL_RULE_CONDITION_OBJECT}
          value={body.conditions}
          onChange={(next) => set('conditions', next)}
          readOnly={readOnly}
          invalid={!!errors.conditions}
          {...listBounds(fieldOf('conditions')?.field)}
          itemLabel={conditionLabel}
          addLabel={t('mailRules.builder.addCondition', 'Add condition')}
        />
      </Step>

      <section className="py-3">
        <button
          ref={exceptionsButton}
          type="button"
          aria-expanded={showExceptions}
          aria-controls={exceptionsId}
          onClick={() => setExceptionsExpanded(!showExceptions)}
          className="flex items-center gap-1.5 rounded-md text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn('size-4 text-dim transition-transform', showExceptions && 'rotate-90')}
            aria-hidden="true"
          />
          {t('mailRules.builder.except', 'Except if any of these match')}
          {!showExceptions && custom.exceptions.length > 0 && (
            <span className="font-normal text-muted-foreground">({custom.exceptions.length})</span>
          )}
        </button>
        {showExceptions && (
          <div id={exceptionsId} className="mt-2">
            <RuleItemList
              name="exceptions"
              objectName={MAIL_RULE_CONDITION_OBJECT}
              value={body.exceptions}
              onChange={changeExceptions}
              readOnly={readOnly}
              invalid={!!errors.exceptions}
              {...listBounds(fieldOf('exceptions')?.field)}
              itemLabel={exceptionLabel}
              addLabel={t('mailRules.builder.addException', 'Add exception')}
            />
          </div>
        )}
      </section>

      <Step heading={t('mailRules.builder.then', 'Then')}>
        <RuleItemList
          name="actions"
          objectName={MAIL_RULE_ACTION_OBJECT}
          value={body.actions}
          onChange={(next) => set('actions', next)}
          readOnly={readOnly}
          invalid={!!errors.actions}
          {...listBounds(fieldOf('actions')?.field)}
          canAddMore={!hasReject}
          itemLabel={actionLabel}
          addLabel={t('mailRules.builder.addAction', 'Add action')}
          disabledVariants={disabledActions}
        />
        <FieldError id={actionsErrorId} error={actionsError} />
      </Step>

      {trailing.length > 0 && (
        <div className="@container">
          {trailing.map(({ formField, field }) =>
            hasReject && formField.name === STOP_PROCESSING ? (
              <div key={formField.name}>
                <FieldRow field={field} formField={formField} value={true} onChange={() => {}} readOnly />
                <p className="pb-3 text-[12.5px] text-muted-foreground">
                  {t('mailRules.builder.rejectStops', 'A rule that rejects mail always stops processing more rules.')}
                </p>
              </div>
            ) : (
              <FieldRow
                key={formField.name}
                field={field}
                formField={formField}
                value={body[formField.name]}
                onChange={(next) => set(formField.name, next)}
                error={errors[formField.name]}
                readOnly={readOnly}
              />
            ),
          )}
        </div>
      )}

      <IssueList issues={issues} />
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
    mailboxName: mailboxes.status === 'ready' ? mailboxNameResolver(mailboxes.options) : undefined,
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
