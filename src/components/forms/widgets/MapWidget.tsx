/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ObjectSearchPopover } from '@/components/common/ObjectSearchPopover';
import { FieldScopeProvider } from '@/components/forms/FormProvider';
import { PanelContext, useFormContext, useInPanel } from '@/components/forms/formContext';
import { FieldControl } from '@/components/forms/widgets/FieldControl';
import { EmbeddedObjectEditor } from '@/components/forms/widgets/EmbeddedObjectWidget';
import { formatPlaceholder } from '@/components/forms/widgets/placeholders';
import { widgetKey, widgetTraits } from '@/extensions/widgets';
import { useNoPermissionMessage } from '@/lib/objectOptions';
import { useDisplayName, useObjectOptions } from '@/data/objectOptions';
import { buildNewObjectValue, getEnum, getEnumVariant, mapEntryValueType } from '@/lib/schemaResolver';
import { isRecord } from '@/lib/embeddedSchema';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { Field, FieldType, FieldTypeMap, MapValueType, ScalarType } from '@/types/schema';

function defaultMapValue(valueClass: MapValueType, newObject: (objectName: string) => unknown): unknown {
  switch (valueClass.type) {
    case 'number':
      return 0;
    case 'object':
      return newObject(valueClass.objectName);
    default:
      return '';
  }
}

export function MapWidget({ type, formField, value, onChange, readOnly }: WidgetProps<FieldTypeMap>) {
  const { t } = useTranslation();
  const { schema } = useFormContext();
  const inPanel = useInPanel();
  const baseId = useId();
  const map = isRecord(value) ? value : {};
  const entries = Object.entries(map);
  const [newKey, setNewKey] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const canAdd = type.maxItems == null || entries.length < type.maxItems;
  const canRemove = type.minItems == null || entries.length > type.minItems;
  const trimmedKey = newKey.trim();
  const valueField: Field = { description: '', type: type.valueClass as FieldType, update: 'mutable' };

  const setOpen = (key: string, open: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });

  const addEntry = () => {
    if (!trimmedKey || Object.hasOwn(map, trimmedKey) || !canAdd) return;
    onChange({
      ...map,
      [trimmedKey]: defaultMapValue(type.valueClass, (name) => buildNewObjectValue(schema, name)),
    });
    setOpen(trimmedKey, true);
    setNewKey('');
  };

  const removeEntry = (key: string) => {
    const copy = { ...map };
    delete copy[key];
    onChange(copy);
    setOpen(key, false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEntry();
    }
  };

  const objectValues = valueField.type.type === 'object' && widgetTraits(valueField.type).layout === 'block';
  const valueLabel = formField.valueLabel ?? '';
  const removeButton = (key: string) =>
    !readOnly && (
      <Button
        type="button"
        variant="ghost-danger"
        size="icon-sm"
        className="shrink-0"
        onClick={() => removeEntry(key)}
        disabled={!canRemove}
        aria-label={t('field.removeEntry', 'Remove entry {{name}}', { name: key })}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    );
  const valueControl = (key: string, val: unknown) => (
    <FieldScopeProvider name={key} readOnly={readOnly}>
      {valueField.type.type === 'object' && widgetKey(valueField.type) === 'object' ? (
        <EmbeddedObjectEditor
          bare
          objectName={valueField.type.objectName}
          control={{ 'aria-label': valueLabel || key }}
          value={val}
          onChange={(v) => onChange({ ...map, [key]: v })}
          readOnly={readOnly}
        />
      ) : (
        <FieldControl
          type={mapEntryValueType(schema, type.keyClass, type.valueClass, key) as FieldType}
          field={valueField}
          formField={{ name: key, label: valueLabel }}
          value={val}
          onChange={(v) => onChange({ ...map, [key]: v })}
          readOnly={readOnly}
          control={{ 'aria-label': valueLabel || key }}
        />
      )}
    </FieldScopeProvider>
  );

  return (
    <PanelContext value={true}>
      <div
        data-slot="map-widget"
        className={cn('space-y-0.5 rounded-xl p-1.5', inPanel ? 'bg-card shadow-tile' : 'bg-muted')}
      >
        {!objectValues && entries.length > 0 && (formField.keyLabel || formField.valueLabel) && (
          <div
            aria-hidden="true"
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_2rem] gap-3 px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-dim"
          >
            <span>{formField.keyLabel}</span>
            <span>{formField.valueLabel}</span>
          </div>
        )}
        {entries.map(([key, val]) =>
          objectValues ? (
            <div key={key} className={cn('rounded-lg', expanded.has(key) && (inPanel ? 'bg-muted' : 'bg-card'))}>
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  onClick={() => setOpen(key, !expanded.has(key))}
                  aria-expanded={expanded.has(key)}
                  aria-controls={`${baseId}-${key}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 shrink-0 text-dim transition-transform duration-200',
                      expanded.has(key) && 'rotate-90',
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    <MapKeyLabel keyClass={type.keyClass} keyValue={key} />
                  </span>
                </button>
                {removeButton(key)}
              </div>
              {expanded.has(key) && (
                <div id={`${baseId}-${key}`} className="border-t border-border px-4">
                  {valueControl(key, val)}
                </div>
              )}
            </div>
          ) : (
            <div
              key={key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_2rem] items-center gap-3 rounded-lg py-1 pl-3 transition-colors hover:bg-muted-strong/60"
            >
              <span className="truncate text-sm font-medium">
                <MapKeyLabel keyClass={type.keyClass} keyValue={key} />
              </span>
              <div className="min-w-0">{valueControl(key, val)}</div>
              {removeButton(key)}
            </div>
          ),
        )}
        {!readOnly && canAdd && (
          <div className="flex items-center gap-2 p-1">
            <MapKeyInput
              keyClass={type.keyClass}
              label={formField.keyLabel ?? t('field.newKey', 'New key')}
              value={newKey}
              onChange={setNewKey}
              onKeyDown={handleKeyDown}
              existingKeys={map}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addEntry}
              disabled={!trimmedKey || Object.hasOwn(map, trimmedKey)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('field.add', 'Add')}
            </Button>
          </div>
        )}
        {readOnly && entries.length === 0 && (
          <p className="px-2.5 py-2 text-sm text-muted-foreground">{t('field.none', 'None')}</p>
        )}
      </div>
    </PanelContext>
  );
}

function MapKeyLabel({ keyClass, keyValue }: { keyClass: ScalarType; keyValue: string }) {
  const { schema } = useFormContext();
  if (keyClass.type === 'enum') return <>{getEnumVariant(schema, keyClass.enumName, keyValue)?.label ?? keyValue}</>;
  if (keyClass.type === 'objectId') return <ObjectIdKeyLabel objectName={keyClass.objectName} id={keyValue} />;
  return <>{keyValue}</>;
}

function ObjectIdKeyLabel({ objectName, id }: { objectName: string; id: string }) {
  const { schema } = useFormContext();
  const { label, loading } = useDisplayName(objectName, id, schema);
  if (loading && !label) return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />;
  return <>{label ?? id}</>;
}

interface MapKeyInputProps {
  keyClass: ScalarType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  existingKeys: Record<string, unknown>;
}

function MapKeyInput({ keyClass, label, value, onChange, onKeyDown, existingKeys }: MapKeyInputProps) {
  const { t } = useTranslation();
  const { schema } = useFormContext();
  switch (keyClass.type) {
    case 'enum': {
      const variants = getEnum(schema, keyClass.enumName).filter((v) => !Object.hasOwn(existingKeys, v.name));
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1" aria-label={label}>
            <SelectValue placeholder={t('field.selectKey', 'Select key...')} />
          </SelectTrigger>
          <SelectContent>
            {variants.map((v) => (
              <SelectItem key={v.name} value={v.name}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case 'objectId':
      return (
        <MapKeyObjectIdInput
          objectName={keyClass.objectName}
          label={label}
          value={value}
          onChange={onChange}
          existingKeys={existingKeys}
        />
      );
    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={label}
          placeholder={
            (keyClass.type === 'string' ? formatPlaceholder(keyClass.format) : undefined) ?? t('field.key', 'Key...')
          }
          className="flex-1"
        />
      );
  }
}

function MapKeyObjectIdInput({
  objectName,
  label,
  value,
  onChange,
  existingKeys,
}: {
  objectName: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  existingKeys: Record<string, unknown>;
}) {
  const { schema, tenantId } = useFormContext();
  const list = useObjectOptions(objectName, schema, tenantId);
  const noPermissionMessage = useNoPermissionMessage(schema, objectName);
  return (
    <div className="flex flex-1 items-center gap-2">
      {value && (
        <span className="text-sm">
          <ObjectIdKeyLabel objectName={objectName} id={value} />
        </span>
      )}
      <ObjectSearchPopover
        label={label}
        options={list.options.filter((o) => !Object.hasOwn(existingKeys, o.id))}
        loading={list.loading}
        error={list.error}
        ensureLoaded={list.ensureLoaded}
        onSelect={onChange}
        disabledMessage={noPermissionMessage}
      />
    </div>
  );
}
