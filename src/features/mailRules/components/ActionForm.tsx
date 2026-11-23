/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useId, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FieldRow, type FieldRowProps } from '@/components/forms/FieldRow';
import { FieldScopeProvider } from '@/components/forms/FormProvider';
import { useFormContext } from '@/components/forms/formContext';
import { missingNestedFields } from '@/components/forms/formLogic';
import { embeddedEntries, isRecord, resolveEmbedded } from '@/lib/embeddedSchema';
import { buildNewObjectValue } from '@/lib/schemaResolver';
import { cn } from '@/lib/utils';
import { FieldControl } from '@/components/forms/widgets/FieldControl';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldType } from '@/types/schema';
import { editKeywords, setFlag, toSet } from '../builder';
import {
  FLAG_ACTIONS,
  hasFlag,
  hasOtherAction,
  isEveryMessageReply,
  MAIL_RULE_ACTIONS_OBJECT,
  otherKeywords,
  parseActions,
  setValues,
  type FlagAction,
  type KeywordSet,
  type RuleActions,
} from '../model';
import { actionLabel } from '../summary';
import { KeywordInput } from './KeywordInput';
import { MailboxPicker } from './MailboxPicker';
import { RuleFieldRow } from './RuleFieldRow';

type ObjectAction = 'redirect' | 'reply' | 'reject';
type FilledAction = 'moveTo' | 'copyTo' | 'setImportance' | KeywordSet;
type RuleAction = FilledAction | FlagAction | ObjectAction | 'clearKeywords' | 'discard';
type ActionGroup = 'file' | 'mark' | 'answer' | 'remove';

const ACTION_GROUPS: readonly { group: ActionGroup; actions: readonly RuleAction[] }[] = [
  { group: 'file', actions: ['moveTo', 'copyTo'] },
  {
    group: 'mark',
    actions: [
      'markRead',
      'flag',
      'clearFlag',
      'markNotJunk',
      'setImportance',
      'addKeywords',
      'removeKeywords',
      'clearKeywords',
    ],
  },
  { group: 'answer', actions: ['reply', 'redirect'] },
  { group: 'remove', actions: ['discard', 'reject'] },
];

interface Focus {
  action: RuleAction;
  target: 'card' | 'chip';
}

const FILLED_ACTIONS: readonly FilledAction[] = ['moveTo', 'copyTo', 'setImportance', 'addKeywords', 'removeKeywords'];

const FIRST_CONTROL = 'input:not([type="hidden"]), textarea, button, [role="combobox"]';

function focusFirstControl(card: HTMLElement | null) {
  card?.querySelector<HTMLElement>(FIRST_CONTROL)?.focus();
}

function isFilled(actions: RuleActions, action: FilledAction): boolean {
  switch (action) {
    case 'moveTo':
    case 'copyTo':
      return actions[action].length > 0;
    case 'addKeywords':
    case 'removeKeywords':
      return otherKeywords(actions, action).length > 0;
    case 'setImportance':
      return actions.setImportance !== null;
  }
}

function filledActions(value: unknown): ReadonlySet<RuleAction> {
  const actions = parseActions(isRecord(value) ? value : {});
  return new Set(FILLED_ACTIONS.filter((action) => isFilled(actions, action)));
}

function isFlag(action: RuleAction): action is FlagAction {
  return Object.hasOwn(FLAG_ACTIONS, action);
}

function LockedSwitch({ value, control }: WidgetProps) {
  return <Switch {...control} checked={value === true} disabled />;
}

interface ActionRowProps extends Pick<FieldRowProps, 'value' | 'onChange'> {
  name: string;
  label: string;
  type: FieldType | undefined;
  description?: string;
  Edit?: ComponentType<WidgetProps>;
}

function ActionRow({ name, label, type, description = '', Edit, ...props }: ActionRowProps) {
  if (!type) return null;
  const row = { field: { type, description, update: 'mutable' as const }, formField: { name, label }, ...props };
  return Edit ? <RuleFieldRow {...row} Edit={Edit} /> : <FieldRow {...row} />;
}

interface ActionDetailsProps {
  name: string;
  objectName: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  readOnly: boolean;
  invalid: boolean;
}

function ActionDetails({ name, objectName, value, onChange, readOnly, invalid }: ActionDetailsProps) {
  const { t } = useTranslation();
  const { schema } = useFormContext();
  const resolved = resolveEmbedded(schema, objectName, value);
  if (!resolved) return null;
  const missing = new Set(invalid ? missingNestedFields(schema, objectName, value) : []);
  return (
    <FieldScopeProvider name={name} readOnly={readOnly}>
      <div className="divide-y divide-border">
        {embeddedEntries(resolved).map(({ formField, field }) => (
          <FieldRow
            key={formField.name}
            field={field}
            formField={formField}
            value={value[formField.name]}
            onChange={(next) => onChange({ ...value, [formField.name]: next })}
            error={missing.has(formField.name) ? t('form.required', 'This field is required.') : undefined}
          />
        ))}
      </div>
    </FieldScopeProvider>
  );
}

interface ActionCardProps {
  label: string;
  onRemove: (() => void) | null;
  focused: boolean;
  title?: ReactNode;
  children?: ReactNode;
}

function ActionCard({ label, onRemove, focused, title, children }: ActionCardProps) {
  const { t } = useTranslation();
  return (
    <li
      ref={focused ? focusFirstControl : undefined}
      className="rounded-xl bg-card px-3 shadow-tile"
      data-testid="mail-rule-action"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {title && <div className="py-3">{title}</div>}
          {children}
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost-danger"
            size="icon-sm"
            className="mt-2.5 shrink-0"
            onClick={onRemove}
            aria-label={t('mailRules.removeItem', 'Remove {{label}}', { label })}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}

function CardTitle({ label, description }: { label: string; description?: string }) {
  return (
    <>
      <p className="text-[13.5px] font-semibold">{label}</p>
      {description && <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>}
    </>
  );
}

interface ActionFormProps {
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  readOnly: boolean;
  invalid: boolean;
}

export function ActionForm({ value, onChange, readOnly, invalid }: ActionFormProps) {
  const { t } = useTranslation();
  const { schema, mode, baseline } = useFormContext();
  const [opened, setOpened] = useState(() => filledActions(value));
  const rejectHintId = useId();
  const [focus, setFocus] = useState<Focus | null>(null);
  const raw = isRecord(value) ? value : {};
  const actions = parseActions(raw);
  const properties = resolveEmbedded(schema, MAIL_RULE_ACTIONS_OBJECT, raw)?.fields?.properties ?? {};
  const saved = mode === 'edit' && isRecord(baseline) && isRecord(baseline.actions) ? baseline.actions : {};
  const hasOther = hasOtherAction(actions);
  const rejects = actions.reject !== null;
  const rejectBlocked = hasOther && !rejects;
  const set = (name: keyof RuleActions, next: unknown) => onChange({ ...raw, [name]: next });
  const open = (action: RuleAction, on: boolean) =>
    setOpened((current) => {
      const next = new Set(current);
      if (on) next.add(action);
      else next.delete(action);
      return next;
    });

  const isActive = (action: RuleAction): boolean => {
    if (isFlag(action)) return hasFlag(actions, action);
    switch (action) {
      case 'moveTo':
      case 'copyTo':
      case 'addKeywords':
      case 'removeKeywords':
      case 'setImportance':
        return isFilled(actions, action) || opened.has(action);
      case 'clearKeywords':
      case 'discard':
        return actions[action];
      case 'redirect':
      case 'reply':
      case 'reject':
        return actions[action] !== null;
    }
  };

  const objectType = (name: ObjectAction) => {
    const type = properties[name]?.type;
    return type?.type === 'object' ? type : null;
  };

  const add = (action: RuleAction) => {
    setFocus({ action, target: 'card' });
    if (isFlag(action)) return onChange(setFlag(raw, action, true));
    switch (action) {
      case 'clearKeywords':
      case 'discard':
        return set(action, true);
      case 'redirect':
      case 'reply':
      case 'reject': {
        const type = objectType(action);
        if (!type) return;
        return set(action, isRecord(saved[action]) ? saved[action] : buildNewObjectValue(schema, type.objectName));
      }
      default:
        return open(action, true);
    }
  };

  const remove = (action: RuleAction) => {
    setFocus({ action, target: 'chip' });
    if (isFlag(action)) return onChange(setFlag(raw, action, false));
    switch (action) {
      case 'moveTo':
      case 'copyTo':
        open(action, false);
        return set(action, {});
      case 'addKeywords':
      case 'removeKeywords':
        open(action, false);
        return set(action, editKeywords(raw[action], otherKeywords(actions, action), []));
      case 'setImportance':
        open(action, false);
        return set(action, null);
      case 'clearKeywords':
      case 'discard':
        return set(action, false);
      case 'redirect':
      case 'reply':
      case 'reject':
        return set(action, null);
    }
  };

  const keywordRow = (name: KeywordSet, label: string) => {
    const shown = otherKeywords(actions, name);
    return (
      <ActionRow
        name={name}
        label={label}
        type={properties[name]?.type}
        value={toSet(shown)}
        onChange={(next) => set(name, editKeywords(raw[name], shown, setValues(next)))}
        Edit={KeywordInput}
      />
    );
  };

  const objectDetails = (name: ObjectAction) => {
    const type = objectType(name);
    const current = actions[name];
    if (!type || !current) return null;
    return (
      <ActionDetails
        name={name}
        objectName={type.objectName}
        value={current}
        onChange={(next) => set(name, next)}
        readOnly={readOnly}
        invalid={invalid}
      />
    );
  };

  const cardContent = (action: RuleAction): { title?: ReactNode; body?: ReactNode } => {
    const label = actionLabel(t, action);
    switch (action) {
      case 'moveTo':
        return {
          body: (
            <ActionRow
              name="moveTo"
              label={label}
              description={t('mailRules.builder.moveToHint', 'Moving to Junk also marks the message as spam.')}
              type={properties.moveTo?.type}
              value={raw.moveTo}
              onChange={(next) => set('moveTo', next)}
              Edit={MailboxPicker}
            />
          ),
        };
      case 'copyTo':
        return {
          body: (
            <ActionRow
              name="copyTo"
              label={label}
              type={properties.copyTo?.type}
              value={raw.copyTo}
              onChange={(next) => set('copyTo', next)}
              Edit={MailboxPicker}
            />
          ),
        };
      case 'addKeywords':
        return { body: keywordRow('addKeywords', t('mailRules.builder.keywordsToAdd', 'Keywords to add')) };
      case 'removeKeywords':
        return { body: keywordRow('removeKeywords', t('mailRules.builder.keywordsToRemove', 'Keywords to remove')) };
      case 'setImportance':
        return {
          body: (
            <ActionRow
              name="setImportance"
              label={label}
              type={properties.setImportance?.type}
              value={actions.setImportance}
              onChange={(next) => set('setImportance', next)}
              Edit={FieldControl}
            />
          ),
        };
      case 'markNotJunk':
        return {
          title: (
            <CardTitle
              label={label}
              description={t('mailRules.builder.markNotJunkHint', 'Keeps the message out of Junk.')}
            />
          ),
        };
      case 'discard':
        return {
          title: (
            <CardTitle
              label={label}
              description={t('mailRules.builder.discardHint', 'The message does not go to Trash.')}
            />
          ),
        };
      case 'reply':
        return {
          title: <CardTitle label={label} />,
          body: (
            <>
              {objectDetails('reply')}
              {isEveryMessageReply(actions.reply) && (
                <p className="pb-3 text-[12.5px] text-muted-foreground">
                  {t('mailRules.builder.replyEveryMessage', 'With 0 days between replies, every message gets a reply.')}
                </p>
              )}
            </>
          ),
        };
      case 'redirect':
        return { title: <CardTitle label={label} />, body: objectDetails('redirect') };
      case 'reject':
        return {
          title: (
            <CardTitle
              label={label}
              description={t(
                'mailRules.builder.rejectHint',
                'Reject must be the only action. The sender is told only when their address can be verified; otherwise the message is deleted without notice.',
              )}
            />
          ),
          body: objectDetails('reject'),
        };
      default:
        return { title: <CardTitle label={label} /> };
    }
  };

  const ordered = ACTION_GROUPS.flatMap(({ actions: group }) => group);
  const active = ordered.filter(isActive);
  const showChips = !readOnly && !rejects;

  return (
    <FieldScopeProvider name="actions" readOnly={readOnly}>
      <div className="@container space-y-4">
        {active.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            {readOnly
              ? t('mailRules.builder.noActionsReadOnly', 'No actions.')
              : t('mailRules.builder.noActions', 'No actions yet. Choose at least one below.')}
          </p>
        ) : (
          <ul className="space-y-2 [&_[data-slot=field-row]]:py-3">
            {active.map((action) => {
              const { title, body } = cardContent(action);
              return (
                <ActionCard
                  key={action}
                  label={actionLabel(t, action)}
                  onRemove={readOnly ? null : () => remove(action)}
                  focused={focus?.action === action && focus.target === 'card'}
                  title={title}
                >
                  {body}
                </ActionCard>
              );
            })}
          </ul>
        )}

        {showChips && active.length < ordered.length && (
          <div className="space-y-2">
            <p className="text-[13px] font-semibold">
              {active.length === 0
                ? t('mailRules.builder.addAction', 'Add an action')
                : t('mailRules.builder.addAnotherAction', 'Add another action')}
            </p>
            <dl className="space-y-2">
              {ACTION_GROUPS.map(({ group, actions: members }) => {
                const available = members.filter((action) => !isActive(action));
                if (available.length === 0) return null;
                return (
                  <div key={group} className="grid gap-x-3 gap-y-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
                    <dt className="pt-1.5 text-[12.5px] text-muted-foreground">{groupLabel(t, group)}</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {available.map((action) => {
                        const blocked = action === 'reject' && rejectBlocked;
                        return (
                          <Button
                            key={action}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className={cn(blocked && 'cursor-not-allowed opacity-50')}
                            aria-disabled={blocked || undefined}
                            aria-describedby={blocked ? rejectHintId : undefined}
                            autoFocus={focus?.action === action && focus.target === 'chip'}
                            onClick={blocked ? undefined : () => add(action)}
                          >
                            <Plus className="size-4" aria-hidden="true" />
                            {actionLabel(t, action)}
                          </Button>
                        );
                      })}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {rejectBlocked && (
              <p id={rejectHintId} className="text-[12.5px] text-muted-foreground">
                {t('mailRules.builder.rejectNotAlone', 'Reject must be the only action.')}
              </p>
            )}
          </div>
        )}

        <div className="border-t border-border [&_[data-slot=field-row]]:py-3">
          <ActionRow
            name="stopProcessing"
            label={actionLabel(t, 'stopProcessing')}
            description={
              rejects
                ? t('mailRules.builder.rejectStops', 'A rule that rejects mail always stops processing more rules.')
                : t('mailRules.builder.stopHint', 'Rules below this one in the list are skipped for matching messages.')
            }
            type={properties.stopProcessing?.type}
            value={rejects || actions.stopProcessing}
            onChange={(next) => set('stopProcessing', next)}
            Edit={rejects ? LockedSwitch : undefined}
          />
        </div>
      </div>
    </FieldScopeProvider>
  );
}

function groupLabel(t: TFunction, group: ActionGroup): string {
  switch (group) {
    case 'file':
      return t('mailRules.builder.group.file', 'File');
    case 'mark':
      return t('mailRules.builder.group.mark', 'Mark');
    case 'answer':
      return t('mailRules.builder.group.answer', 'Answer');
    case 'remove':
      return t('mailRules.builder.group.remove', 'Delete');
  }
}
