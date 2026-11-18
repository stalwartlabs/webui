/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useId, useState, type ClipboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EnumMultiSelect } from '@/components/forms/widgets/EnumWidgets';
import { ObjectIdMultiSelect } from '@/components/forms/widgets/ObjectIdWidgets';
import { RemovablePill } from '@/components/forms/widgets/RemovablePill';
import { formatPlaceholder } from '@/components/forms/widgets/placeholders';
import { isRecord } from '@/lib/embeddedSchema';
import { addSetEntries, joinEntries, splitEntries, type SetEntriesResult } from '@/lib/setEntries';
import type { ControlProps, WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeSet, ScalarTypeString } from '@/types/schema';

function toSetObject(items: string[]): Record<string, true> {
  const obj: Record<string, true> = {};
  for (const item of items) obj[item] = true;
  return obj;
}

export function SetWidget({ type, formField, value, onChange, readOnly, control }: WidgetProps<FieldTypeSet>) {
  const items = isRecord(value) ? Object.keys(value) : [];
  const commit = (next: string[]) => onChange(toSetObject(next));
  const scalar = type.class;

  switch (scalar.type) {
    case 'string':
      return (
        <TagInput
          type={scalar}
          label={formField.label}
          items={items}
          onChange={commit}
          readOnly={readOnly}
          minItems={type.minItems}
          maxItems={type.maxItems}
          placeholder={formField.placeholder ?? formatPlaceholder(scalar.format)}
          control={control}
        />
      );
    case 'enum':
      return (
        <EnumMultiSelect
          enumName={scalar.enumName}
          items={items}
          onChange={commit}
          readOnly={readOnly}
          minItems={type.minItems}
          control={control}
        />
      );
    case 'objectId':
      return (
        <ObjectIdMultiSelect
          objectName={scalar.objectName}
          label={formField.label}
          items={items}
          onChange={commit}
          readOnly={readOnly}
          minItems={type.minItems}
          control={control}
        />
      );
    default: {
      const unknownScalar: never = scalar;
      void unknownScalar;
      return null;
    }
  }
}

interface TagInputProps {
  type: ScalarTypeString;
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  readOnly: boolean;
  minItems?: number;
  maxItems?: number;
  placeholder?: string;
  control: ControlProps;
}

const REPORT_SAMPLE = 5;

function isNoteworthy(result: SetEntriesResult): boolean {
  return result.added.length > 1 || result.duplicates.length + result.invalid.length + result.overLimit.length > 0;
}

function TagInput({ type, label, items, onChange, readOnly, minItems, maxItems, placeholder, control }: TagInputProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [report, setReport] = useState<SetEntriesResult | null>(null);
  const statusId = useId();
  const full = maxItems != null && items.length >= maxItems;

  const addEntries = (entries: string[]) => {
    const result = addSetEntries(items, entries, type, maxItems);
    if (result.added.length > 0) onChange([...items, ...result.added]);
    setReport(isNoteworthy(result) ? result : null);
    return result;
  };

  const addTyped = () => {
    const entries = splitEntries(inputValue, type.format);
    if (entries.length === 0) return;
    const result = addEntries(entries);
    setInputValue(joinEntries(result.invalid, type.format) ?? '');
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const entries = splitEntries(e.clipboardData.getData('text'), type.format);
    if (entries.length < 2) return;
    e.preventDefault();
    const { invalid } = addEntries(entries);
    const restored = joinEntries(invalid, type.format);
    if (invalid.length > 0 && restored !== null)
      setInputValue(inputValue.trim() ? `${inputValue.trim()}, ${restored}` : restored);
  };

  const sample = (values: string[]) =>
    values.length > REPORT_SAMPLE
      ? t('field.entriesSample', '{{list}} and {{count}} more', {
          list: values.slice(0, REPORT_SAMPLE).join(', '),
          count: values.length - REPORT_SAMPLE,
        })
      : values.join(', ');

  return (
    <div>
      <div className="space-y-2">
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <RemovablePill
                key={item}
                label={item}
                onRemove={
                  readOnly
                    ? undefined
                    : () => {
                        onChange(items.filter((i) => i !== item));
                        setReport(null);
                      }
                }
                removeDisabled={minItems != null && items.length <= minItems}
              />
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Input
              {...control}
              aria-describedby={
                [control['aria-describedby'], report ? statusId : null].filter(Boolean).join(' ') || undefined
              }
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setReport(null);
              }}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTyped();
                }
              }}
              disabled={full}
              placeholder={placeholder ?? t('field.typeAndPressEnter', 'Type and press Enter...')}
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="shrink-0"
              onClick={addTyped}
              disabled={!inputValue.trim() || full}
              aria-label={t('field.addValue', 'Add {{name}}', { name: label })}
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      <div id={statusId} role="status" className="mt-2 space-y-0.5 text-[12.5px] empty:mt-0">
        {report && report.added.length > 0 && (
          <p className="text-muted-foreground">
            {t('field.entriesAdded', 'Added {{count}} values.', { count: report.added.length })}
          </p>
        )}
        {report && report.duplicates.length > 0 && (
          <p className="text-muted-foreground">
            {t('field.entriesDuplicate', 'Skipped {{count}} duplicates: {{list}}', {
              count: report.duplicates.length,
              list: sample(report.duplicates),
            })}
          </p>
        )}
        {report && report.invalid.length > 0 && (
          <p className="text-destructive">
            {t('field.entriesInvalid', 'Not added, invalid: {{list}}', {
              count: report.invalid.length,
              list: sample(report.invalid),
            })}
          </p>
        )}
        {report && report.overLimit.length > 0 && (
          <p className="text-destructive">
            {t('field.entriesOverLimit', 'Not added, the limit is {{max}}: {{list}}', {
              count: report.overLimit.length,
              max: maxItems,
              list: sample(report.overLimit),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
