/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldError, FieldRow } from '@/components/forms/FieldRow';
import { FieldScopeProvider } from '@/components/forms/FormProvider';
import { missingNestedFields } from '@/components/forms/formLogic';
import { EnclosingSchemaContext, fieldIds, useFieldScope, useFormContext } from '@/components/forms/formContext';
import { FieldControl } from '@/components/forms/widgets/FieldControl';
import { embeddedEntries, resolveEmbedded, switchVariantValues } from '@/lib/embeddedSchema';
import { formatList } from '@/lib/format';
import { buildEmbeddedDefaults, buildNewObjectValue } from '@/lib/schemaResolver';
import { useRuleAccountId } from '../account';
import {
  appendItem,
  isInlineField,
  listEntries,
  MAILBOX_FIELD,
  MAILBOX_SCHEMA,
  removeItem,
  replaceItem,
} from '../builder';
import { MailboxPicker } from './MailboxPicker';

const NO_MISSING: ReadonlySet<string> = new Set();

interface RuleItemListProps {
  name: string;
  objectName: string;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  invalid: boolean;
  minItems?: number;
  maxItems?: number;
  canAddMore?: boolean;
  itemLabel: (n: number) => string;
  addLabel: string;
  disabledVariants?: ReadonlyMap<string, string>;
}

interface RuleItemProps {
  objectName: string;
  itemKey: string;
  item: Record<string, unknown>;
  label: string;
  onChange: (item: Record<string, unknown>) => void;
  onRemove: (() => void) | null;
  readOnly: boolean;
  invalid: boolean;
  disabledVariants?: ReadonlyMap<string, string>;
}

function RuleItem({
  objectName,
  itemKey,
  item,
  label,
  onChange,
  onRemove,
  readOnly,
  invalid,
  disabledVariants,
}: RuleItemProps) {
  const { t } = useTranslation();
  const { schema, idPrefix, mode, baseline } = useFormContext();
  const scope = useFieldScope();
  const accountId = useRuleAccountId();
  const [initial, setInitial] = useState({ baseline, item });
  if (initial.baseline !== baseline) setInitial({ baseline, item });
  const resolved = resolveEmbedded(schema, objectName, item);
  if (!resolved) return null;
  const variant = resolved.variant?.name ?? '';
  const schemaName = resolved.variant?.schemaName;
  const entries = embeddedEntries(resolved).filter(({ field }) => field.update !== 'serverSet');
  const inline = entries.filter(({ field }) => isInlineField(field));
  const block = entries.filter(({ field }) => !isInlineField(field));
  const path = [...scope.path, itemKey];
  const missing = invalid ? new Set(missingNestedFields(schema, objectName, item)) : NO_MISSING;
  const missingInline = inline.filter(({ formField }) => missing.has(formField.name));
  const itemErrorId = fieldIds(idPrefix, path).errorId;
  const requiredMessage = t('form.required', 'This field is required.');

  const changeVariant = (next: string) => {
    const defaults = buildEmbeddedDefaults(schema, objectName, {}, next);
    const target = resolveEmbedded(schema, objectName, defaults);
    const original = mode === 'edit' ? initial.item : undefined;
    onChange(switchVariantValues(resolved.fields, target?.fields, item, defaults, original));
  };

  return (
    <li className="rounded-xl bg-card px-3 py-2.5 shadow-tile" data-testid="mail-rule-item">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={variant} onValueChange={changeVariant} disabled={readOnly}>
          <SelectTrigger
            id={fieldIds(idPrefix, [...path, '@type']).inputId}
            aria-label={label}
            className="min-w-0 flex-1 gap-2 sm:min-w-56 sm:max-w-sm sm:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(resolved.variants ?? []).map((option) => {
              const reason = option.name !== variant ? disabledVariants?.get(option.name) : undefined;
              return (
                <SelectItem key={option.name} value={option.name} disabled={!!reason}>
                  {reason ? (
                    <span className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{reason}</span>
                    </span>
                  ) : (
                    option.label
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {inline.map(({ formField, field }) => {
          const ids = fieldIds(idPrefix, [...path, formField.name]);
          const fieldValue = item[formField.name];
          const setValue = (next: unknown) => onChange({ ...item, [formField.name]: next });
          const isMissing = missing.has(formField.name);
          const control = {
            id: ids.inputId,
            'aria-label': `${label}: ${formField.label}`,
            'aria-invalid': isMissing || undefined,
            'aria-describedby': isMissing ? itemErrorId : undefined,
          };
          const isMailbox = schemaName === MAILBOX_SCHEMA && formField.name === MAILBOX_FIELD;
          return (
            <div
              key={formField.name}
              className="order-2 flex min-w-0 flex-1 basis-full items-center gap-2 sm:order-none sm:basis-40"
            >
              {!isMailbox && field.type.type !== 'enum' && (
                <label htmlFor={ids.inputId} className="shrink-0 text-[12.5px] text-muted-foreground">
                  {formField.label}
                </label>
              )}
              <div className="min-w-0 flex-1">
                {isMailbox ? (
                  <MailboxPicker
                    accountId={accountId}
                    value={fieldValue}
                    onChange={setValue}
                    readOnly={readOnly}
                    control={control}
                  />
                ) : (
                  <FieldScopeProvider name={itemKey} readOnly={readOnly}>
                    <FieldControl
                      type={field.type}
                      field={field}
                      formField={formField}
                      value={fieldValue}
                      onChange={setValue}
                      readOnly={readOnly}
                      control={control}
                    />
                  </FieldScopeProvider>
                )}
              </div>
            </div>
          );
        })}
        {onRemove && (
          <Button
            type="button"
            variant="ghost-danger"
            size="icon-sm"
            className="order-1 ml-auto shrink-0 sm:order-none"
            onClick={onRemove}
            aria-label={t('mailRules.removeItem', 'Remove {{label}}', { label })}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {missingInline.length > 0 && (
        <div className="mt-1.5">
          <FieldError
            id={itemErrorId}
            error={t('mailRules.builder.missingFields', 'Fill in {{fields}}.', {
              fields: formatList(missingInline.map(({ formField }) => formField.label)),
            })}
          />
        </div>
      )}
      {block.length > 0 && (
        <FieldScopeProvider name={itemKey} readOnly={readOnly}>
          <EnclosingSchemaContext value={resolved.schemaName}>
            <div className="@container mt-1 divide-y divide-border [&>[data-slot=field-row]]:py-3">
              {block.map(({ formField, field }) => (
                <FieldRow
                  key={formField.name}
                  field={field}
                  formField={formField}
                  value={item[formField.name]}
                  onChange={(next) => onChange({ ...item, [formField.name]: next })}
                  error={missing.has(formField.name) ? requiredMessage : undefined}
                />
              ))}
            </div>
          </EnclosingSchemaContext>
        </FieldScopeProvider>
      )}
    </li>
  );
}

export function RuleItemList({
  name,
  objectName,
  value,
  onChange,
  readOnly,
  invalid,
  minItems,
  maxItems,
  canAddMore = true,
  itemLabel,
  addLabel,
  disabledVariants,
}: RuleItemListProps) {
  const { schema } = useFormContext();
  const entries = listEntries(value);
  const canRemove = !readOnly && (minItems == null || entries.length > minItems);
  const canAdd = !readOnly && canAddMore && (maxItems == null || entries.length < maxItems);
  return (
    <FieldScopeProvider name={name} readOnly={readOnly}>
      {entries.length > 0 && (
        <ol className="space-y-2">
          {entries.map(([key, item], index) => (
            <RuleItem
              key={key}
              objectName={objectName}
              itemKey={key}
              item={item}
              label={itemLabel(index + 1)}
              onChange={(next) => onChange(replaceItem(value, key, next))}
              onRemove={canRemove ? () => onChange(removeItem(value, key)) : null}
              readOnly={readOnly}
              invalid={invalid}
              disabledVariants={disabledVariants}
            />
          ))}
        </ol>
      )}
      {canAdd && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => onChange(appendItem(value, buildNewObjectValue(schema, objectName)))}
        >
          <Plus className="size-4" aria-hidden="true" />
          {addLabel}
        </Button>
      )}
    </FieldScopeProvider>
  );
}
