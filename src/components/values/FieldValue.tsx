/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HelpTooltip } from '@/components/common/HelpTooltip';
import { formatDateTime } from '@/lib/format';
import { resolveWidget } from '@/extensions/widgets';
import { getEnumVariant, mapEntryValueType } from '@/lib/schemaResolver';
import {
  embeddedEntries,
  embeddedSummary,
  isEmptyValue,
  isMultilineFormat,
  type EmbeddedSummary,
  isRecord,
  resolveEmbedded,
  variantLabel,
} from '@/lib/embeddedSchema';
import {
  BooleanValue,
  EmptyValue,
  EnumValue,
  NumberValue,
  ObjectIdValue,
  ScalarLabel,
  StringValue,
  type ValueVariant,
} from '@/components/values/ScalarValues';
import type { Field, FieldType, MapValueType, ScalarType, Schema } from '@/types/schema';

export interface FieldValueProps {
  schema: Schema;
  type: FieldType | ScalarType | MapValueType;
  value: unknown;
  variant?: ValueVariant;
  className?: string;
}

export function FieldValue({ schema, type, value, variant = 'full', className }: FieldValueProps) {
  const content = renderValue(schema, type as FieldType, value, variant);
  return className ? <span className={className}>{content}</span> : content;
}

function renderValue(schema: Schema, type: FieldType, value: unknown, variant: ValueVariant): ReactNode {
  if (isEmptyValue(value)) return <EmptyValue variant={variant} />;
  const { View } = resolveWidget(type);
  if (View) return <View schema={schema} type={type} value={value} variant={variant} />;
  switch (type.type) {
    case 'string':
      return <StringValue value={value} format={type.format} variant={variant} />;
    case 'number':
      return <NumberValue value={value} format={type.format} />;
    case 'utcDateTime':
      return (
        <span className="text-sm">
          {typeof value === 'string' || typeof value === 'number'
            ? formatDateTime(value, variant === 'compact' ? 'medium' : 'short')
            : String(value)}
        </span>
      );
    case 'boolean':
      return <BooleanValue value={value} />;
    case 'enum':
      return <EnumValue schema={schema} enumName={type.enumName} value={value} />;
    case 'blobId':
      return <span className="font-mono text-xs break-all">{String(value)}</span>;
    case 'objectId':
      return <ObjectIdValue schema={schema} objectName={type.objectName} id={String(value)} variant={variant} />;
    case 'object':
      return variant === 'compact' ? (
        <EmbeddedSummaryValue schema={schema} objectName={type.objectName} value={value} />
      ) : (
        <ObjectValue schema={schema} objectName={type.objectName} value={value} />
      );
    case 'objectList':
      return <ObjectListValue schema={schema} objectName={type.objectName} value={value} variant={variant} />;
    case 'set':
      return <SetValue schema={schema} itemType={type.class} value={value} variant={variant} />;
    case 'map':
      return (
        <MapValue
          schema={schema}
          keyClass={type.keyClass}
          valueClass={type.valueClass}
          value={value}
          variant={variant}
        />
      );
    default: {
      const unknownType: never = type;
      void unknownType;
      return <span className="text-sm">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>;
    }
  }
}

function SetValue({
  schema,
  itemType,
  value,
  variant,
}: {
  schema: Schema;
  itemType: ScalarType;
  value: unknown;
  variant: ValueVariant;
}) {
  const items = isRecord(value) ? Object.keys(value) : Array.isArray(value) ? value.map(String) : [];
  if (items.length === 0) return <EmptyValue variant={variant} />;
  if (variant === 'compact') {
    return (
      <span>
        {items.map((item, i) => (
          <Fragment key={item}>
            {i > 0 && ', '}
            <ScalarLabel schema={schema} type={itemType} value={item} />
          </Fragment>
        ))}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const color = itemType.type === 'enum' ? getEnumVariant(schema, itemType.enumName, item)?.color : undefined;
        return (
          <Badge key={item} variant="secondary" className="h-6 gap-1.5 font-medium">
            {color && (
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            )}
            <ScalarLabel schema={schema} type={itemType} value={item} />
          </Badge>
        );
      })}
    </span>
  );
}

function MapValue({
  schema,
  keyClass,
  valueClass,
  value,
  variant,
}: {
  schema: Schema;
  keyClass: ScalarType;
  valueClass: MapValueType;
  value: unknown;
  variant: ValueVariant;
}) {
  if (!isRecord(value)) return <EmptyValue variant={variant} />;
  const entries = Object.entries(value);
  if (entries.length === 0) return <EmptyValue variant={variant} />;
  if (variant === 'compact') {
    return (
      <span>
        {entries.map(([key], i) => (
          <Fragment key={key}>
            {i > 0 && ', '}
            <ScalarLabel schema={schema} type={keyClass} value={key} />
          </Fragment>
        ))}
      </span>
    );
  }
  return (
    <dl className="@container divide-y divide-border border-l-2 border-input pl-4">
      {entries.map(([key, val]) => (
        <ValueRow
          key={key}
          schema={schema}
          label={<ScalarLabel schema={schema} type={keyClass} value={key} />}
          type={mapEntryValueType(schema, keyClass, valueClass, key) as FieldType}
          value={val}
        />
      ))}
    </dl>
  );
}

function ObjectListValue({
  schema,
  objectName,
  value,
  variant,
}: {
  schema: Schema;
  objectName: string;
  value: unknown;
  variant: ValueVariant;
}) {
  const { t } = useTranslation();
  const entries = isRecord(value)
    ? Object.entries(value).sort(([a], [b]) => Number(a) - Number(b))
    : Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : [];
  if (entries.length === 0) return <EmptyValue variant={variant} />;
  if (variant === 'compact') {
    return <span>{t('value.itemCount', '{{count}} items', { count: entries.length })}</span>;
  }
  return (
    <div className="space-y-1.5">
      {entries.map(([key, item]) => (
        <ObjectValue key={key} schema={schema} objectName={objectName} value={item} />
      ))}
    </div>
  );
}

function SummaryText({
  schema,
  summary: { variantLabel: typeLabel, summary },
}: {
  schema: Schema;
  summary: EmbeddedSummary;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {typeLabel && (
        <Badge variant="secondary" className="text-xs">
          {typeLabel}
        </Badge>
      )}
      {summary &&
        (summary.type ? (
          <FieldValue schema={schema} type={summary.type} value={summary.value} variant="compact" />
        ) : (
          <span className="truncate">{String(summary.value)}</span>
        ))}
    </span>
  );
}

export function EmbeddedSummaryValue({
  schema,
  objectName,
  value,
}: {
  schema: Schema;
  objectName: string;
  value: unknown;
}) {
  const summary = embeddedSummary(schema, objectName, value);
  if (!summary.variantLabel && !summary.summary) return <EmptyValue variant="compact" />;
  return <SummaryText schema={schema} summary={summary} />;
}

export function VariantValue({ schema, objectName, value }: { schema: Schema; objectName: string; value: unknown }) {
  const label = variantLabel(schema, objectName, value);
  if (label) return <Badge variant="secondary">{label}</Badge>;
  return <span>{String(value ?? '-')}</span>;
}

interface ObjectEntry {
  key: string;
  label: string;
  field: Field | undefined;
  value: unknown;
}

function objectEntries(schema: Schema, objectName: string, data: Record<string, unknown>): ObjectEntry[] {
  const resolved = resolveEmbedded(schema, objectName, data);
  const entries: ObjectEntry[] = [];
  const seen = new Set<string>(['@type', 'id']);
  if (resolved) {
    for (const { formField, field } of embeddedEntries(resolved)) {
      seen.add(formField.name);
      if (isEmptyValue(data[formField.name])) continue;
      entries.push({ key: formField.name, label: formField.label, field, value: data[formField.name] });
    }
  }
  for (const [key, val] of Object.entries(data)) {
    if (seen.has(key) || isEmptyValue(val)) continue;
    entries.push({ key, label: key, field: resolved?.fields?.properties[key], value: val });
  }
  return entries;
}

export function ObjectValue({
  schema,
  objectName,
  value,
  defaultOpen = false,
}: {
  schema: Schema;
  objectName: string;
  value: unknown;
  defaultOpen?: boolean;
}) {
  if (!isRecord(value)) return <EmptyValue />;
  const entries = objectEntries(schema, objectName, value);
  const summary = embeddedSummary(schema, objectName, value);
  const typeLabel = summary.variantLabel;
  if (entries.length === 0) {
    return typeLabel ? <Badge variant="secondary">{typeLabel}</Badge> : <EmptyValue />;
  }

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="-ml-1 flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&[data-state=open]>svg]:rotate-90"
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" aria-hidden="true" />
          {typeLabel || summary.summary ? (
            <SummaryText schema={schema} summary={summary} />
          ) : (
            <span>{objectName.replace(/^x:/, '')}</span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="@container mt-1.5 ml-1.5 divide-y divide-border border-l-2 border-input pl-4">
          {entries.map((entry) => (
            <ValueRow
              key={entry.key}
              schema={schema}
              label={entry.label}
              description={entry.field?.description}
              type={entry.field?.type}
              value={entry.value}
            />
          ))}
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}

function isBlockValue(type: FieldType | undefined, value: unknown): boolean {
  if (!type) return false;
  switch (type.type) {
    case 'object':
    case 'objectList':
    case 'map':
      return true;
    case 'string':
      return isMultilineFormat(type.format) || (typeof value === 'string' && value.includes('\n'));
    case 'set':
      return isRecord(value) && Object.keys(value).length > 5;
    default:
      return false;
  }
}

export interface ValueRowProps {
  schema: Schema;
  label: ReactNode;
  description?: string;
  type: FieldType | undefined;
  value: unknown;
}

export function ValueRow({ schema, label, description, type, value }: ValueRowProps) {
  const block = isBlockValue(type, value);
  return (
    <div data-slot="value-row" className={cn('py-3', block ? 'grid gap-y-1.5' : 'field-grid')}>
      <dt className="flex min-w-0 items-center gap-1 text-[13px] font-medium text-muted-foreground">
        {label}
        {description && typeof label === 'string' && <HelpTooltip content={description} label={label} />}
      </dt>
      <dd className="min-w-0 text-sm">
        {type ? (
          <FieldValue schema={schema} type={type} value={value} />
        ) : (
          <span>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}</span>
        )}
      </dd>
    </div>
  );
}
