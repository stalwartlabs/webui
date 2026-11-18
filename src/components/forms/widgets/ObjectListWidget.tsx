/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldScopeProvider } from '@/components/forms/FormProvider';
import { PanelContext, useFormContext, useInPanel } from '@/components/forms/formContext';
import { FieldControl } from '@/components/forms/widgets/FieldControl';
import { EmbeddedObjectEditor } from '@/components/forms/widgets/EmbeddedObjectWidget';
import { widgetKey } from '@/extensions/widgets';
import { FieldValue } from '@/components/values/FieldValue';
import { buildNewObjectValue } from '@/lib/schemaResolver';
import { embeddedSummary, isRecord } from '@/lib/embeddedSchema';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { Field, FieldTypeObject, FieldTypeObjectList } from '@/types/schema';

export function ObjectListWidget({
  type,
  field,
  formField,
  value,
  onChange,
  readOnly,
  control,
}: WidgetProps<FieldTypeObjectList>) {
  const { t } = useTranslation();
  const { schema } = useFormContext();
  const inPanel = useInPanel();
  const baseId = useId();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const itemType: FieldTypeObject = { type: 'object', objectName: type.objectName };
  const itemField: Field = { description: '', type: itemType, update: field.update, enterprise: field.enterprise };
  const embedded = widgetKey(itemType) === 'object';
  const items = isRecord(value) ? value : {};
  const entries = Object.entries(items).sort(([a], [b]) => Number(a) - Number(b));
  const canRemove = type.minItems == null || entries.length > type.minItems;
  const canAdd = type.maxItems == null || entries.length < type.maxItems;

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const addItem = () => {
    const next = entries.length > 0 ? Math.max(...entries.map(([k]) => Number(k) || 0)) + 1 : 0;
    onChange({ ...items, [String(next)]: buildNewObjectValue(schema, type.objectName) });
  };

  const removeItem = (key: string) => {
    const copy = { ...items };
    delete copy[key];
    onChange(copy);
    if (collapsed.has(key)) toggle(key);
  };

  return (
    <div className="space-y-2">
      {entries.map(([key, item], position) => {
        const itemLabel = t('field.itemN', '{{label}} {{n}}', { label: formField.label, n: position + 1 });
        const summary = embeddedSummary(schema, type.objectName, item);
        const open = !!control['aria-invalid'] || !collapsed.has(key);
        const bodyId = `${baseId}-${key}`;
        return (
          <div
            key={key}
            data-slot="object-list-item"
            className={cn('overflow-hidden rounded-xl', inPanel ? 'bg-card shadow-tile' : 'bg-muted')}
          >
            <div className="flex items-center gap-1 py-1.5 pl-1.5 pr-1.5">
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-expanded={open}
                aria-controls={bodyId}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight
                  className={cn('h-4 w-4 shrink-0 text-dim transition-transform duration-200', open && 'rotate-90')}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13.5px] font-semibold">{summary.variantLabel ?? itemLabel}</span>
                  {summary.summary && (
                    <span className="truncate text-[12.5px] text-muted-foreground">
                      {summary.summary.type ? (
                        <FieldValue
                          schema={schema}
                          type={summary.summary.type}
                          value={summary.summary.value}
                          variant="compact"
                        />
                      ) : (
                        String(summary.summary.value)
                      )}
                    </span>
                  )}
                </span>
              </button>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost-danger"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => removeItem(key)}
                  disabled={!canRemove}
                  aria-label={t('field.removeItemN', 'Remove item {{n}}', { n: position + 1 })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
            <div id={bodyId} hidden={!open} className="border-t border-border px-4">
              <PanelContext value={true}>
                <FieldScopeProvider name={key} readOnly={readOnly}>
                  {embedded ? (
                    <EmbeddedObjectEditor
                      bare
                      objectName={type.objectName}
                      control={{ 'aria-label': itemLabel }}
                      value={item}
                      onChange={(v) => onChange({ ...items, [key]: v })}
                      readOnly={readOnly}
                    />
                  ) : (
                    <div className="py-3">
                      <FieldControl
                        type={itemType}
                        field={itemField}
                        formField={{ name: key, label: itemLabel }}
                        value={item}
                        onChange={(v) => onChange({ ...items, [key]: v })}
                        readOnly={readOnly}
                        control={{ 'aria-label': itemLabel }}
                      />
                    </div>
                  )}
                </FieldScopeProvider>
              </PanelContext>
            </div>
          </div>
        );
      })}
      {!readOnly && canAdd && (
        <Button type="button" variant="secondary" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('field.addItem', 'Add item')}
        </Button>
      )}
    </div>
  );
}
