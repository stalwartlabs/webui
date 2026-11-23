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
import {
  appendItem,
  isInlineField,
  KEYWORD_TEST_SCHEMA,
  KEYWORDS_FIELD,
  listEntries,
  removeItem,
  replaceItem,
  type ListItems,
} from '../builder';
import { KeywordInput } from './KeywordInput';
import { RuleFieldRow } from './RuleFieldRow';

const NO_MISSING: ReadonlySet<string> = new Set();

export interface RuleItemListProps {
  name: string;
  objectName: string;
  value: unknown;
  onChange: (value: ListItems) => void;
  readOnly: boolean;
  invalid: boolean;
  maxItems?: number;
  itemLabel: (n: number) => string;
  addLabel: string;
  joiner?: string;
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
  joiner?: string;
}

function RuleItem({ objectName, itemKey, item, label, onChange, onRemove, readOnly, invalid, joiner }: RuleItemProps) {
  const { t } = useTranslation();
  const { schema, idPrefix, mode, baseline } = useFormContext();
  const scope = useFieldScope();
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
    <li data-testid="mail-rule-item">
      {joiner && (
        <p className="py-0.5 pl-3 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {joiner}
        </p>
      )}
      <div className="rounded-xl bg-card px-3 py-2.5 shadow-tile">
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
              {(resolved.variants ?? []).map((option) => (
                <SelectItem key={option.name} value={option.name}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inline.map(({ formField, field }) => {
            const ids = fieldIds(idPrefix, [...path, formField.name]);
            const fieldValue = item[formField.name];
            const setValue = (next: unknown) => onChange({ ...item, [formField.name]: next });
            const isMissing = missing.has(formField.name);
            const control = {
              id: ids.inputId,
              'aria-label': t('mailRules.builder.itemField', '{{item}}: {{field}}', {
                item: label,
                field: formField.label,
              }),
              'aria-invalid': isMissing || undefined,
              'aria-describedby': isMissing ? itemErrorId : undefined,
            };
            return (
              <div
                key={formField.name}
                className="order-2 flex min-w-0 flex-1 basis-full items-center gap-2 sm:order-none sm:basis-40"
              >
                {field.type.type !== 'enum' && (
                  <label htmlFor={ids.inputId} className="shrink-0 text-[12.5px] text-muted-foreground">
                    {formField.label}
                  </label>
                )}
                <div className="min-w-0 flex-1">
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
                {block.map(({ formField, field }) => {
                  const row = {
                    field,
                    formField,
                    value: item[formField.name],
                    onChange: (next: unknown) => onChange({ ...item, [formField.name]: next }),
                    error: missing.has(formField.name) ? requiredMessage : undefined,
                  };
                  return schemaName === KEYWORD_TEST_SCHEMA && formField.name === KEYWORDS_FIELD ? (
                    <RuleFieldRow key={formField.name} {...row} Edit={KeywordInput} />
                  ) : (
                    <FieldRow key={formField.name} {...row} />
                  );
                })}
              </div>
            </EnclosingSchemaContext>
          </FieldScopeProvider>
        )}
      </div>
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
  maxItems,
  itemLabel,
  addLabel,
  joiner,
}: RuleItemListProps) {
  const { schema } = useFormContext();
  const entries = listEntries(value);
  const canAdd = !readOnly && (maxItems == null || entries.length < maxItems);
  return (
    <FieldScopeProvider name={name} readOnly={readOnly}>
      {entries.length > 0 && (
        <ol className="space-y-1">
          {entries.map(([key, item], index) => (
            <RuleItem
              key={key}
              joiner={index > 0 ? joiner : undefined}
              objectName={objectName}
              itemKey={key}
              item={item}
              label={itemLabel(index + 1)}
              onChange={(next) => onChange(replaceItem(value, key, next))}
              onRemove={readOnly ? null : () => onChange(removeItem(value, key))}
              readOnly={readOnly}
              invalid={invalid}
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
