/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { ObjectPicker } from '@/components/common/ObjectPicker';
import { SearchInput } from '@/components/common/SearchInput';
import { getEnum } from '@/lib/schemaResolver';
import type { Filter, FilterDate, FilterEnum, FilterInteger, FilterObjectId, FilterText, Schema } from '@/types/schema';

const ENUM_FILTER_COMBOBOX_THRESHOLD = 15;
const ALL_VALUE = '__all__';
const DEFAULT_OP = 'eq';

interface FilterFieldProps<F extends Filter> {
  schema: Schema;
  filter: F;
  values: Record<string, string>;
  isXPrefixed: boolean;
  onChange: (field: string, value: string) => void;
  onCommit: (field: string, value: string) => void;
}

function opField(filter: Filter): string {
  return `${filter.field}Op`;
}

function LabelledField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[12.5px] font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function GroupField({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-[12.5px] font-semibold text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function TextFilter({ filter, values, onChange }: FilterFieldProps<FilterText>) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <LabelledField id={id} label={filter.label}>
      <SearchInput
        id={id}
        placeholder={t('list.filterPlaceholder', 'Search {{label}}...', { label: filter.label.toLowerCase() })}
        value={values[filter.field] ?? ''}
        onValueChange={(next) => onChange(filter.field, next)}
      />
    </LabelledField>
  );
}

function EnumFilter({ schema, filter, values, onChange }: FilterFieldProps<FilterEnum>) {
  const { t } = useTranslation();
  const id = useId();
  const variants = getEnum(schema, filter.enumName);
  const value = values[filter.field] || ALL_VALUE;
  const handleChange = (next: string) => onChange(filter.field, next === ALL_VALUE ? '' : next);

  if (variants.length > ENUM_FILTER_COMBOBOX_THRESHOLD) {
    return (
      <GroupField label={filter.label}>
        <Combobox
          options={[
            { value: ALL_VALUE, label: t('filters.all', 'All') },
            ...variants.map((v) => ({ value: v.name, label: v.label })),
          ]}
          value={value}
          onValueChange={handleChange}
          searchPlaceholder={t('common.searchPlaceholder', 'Search...')}
          emptyText={t('field.noMatches', 'No matches')}
        />
      </GroupField>
    );
  }

  return (
    <LabelledField id={id} label={filter.label}>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={filter.label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{t('filters.all', 'All')}</SelectItem>
          {variants.map((v) => (
            <SelectItem key={v.name} value={v.name}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </LabelledField>
  );
}

interface OperatorOption {
  value: string;
  label: string;
}

function ComparisonFilter({
  filter,
  values,
  isXPrefixed,
  onChange,
  inputType,
  operators,
  operatorWidth,
}: FilterFieldProps<FilterInteger | FilterDate> & {
  inputType: 'number' | 'date';
  operators: OperatorOption[];
  operatorWidth: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const input = (
    <Input
      id={id}
      type={inputType}
      placeholder={inputType === 'number' ? filter.label : undefined}
      value={values[filter.field] ?? ''}
      onChange={(e) => onChange(filter.field, e.target.value)}
      className={isXPrefixed ? 'flex-1' : undefined}
    />
  );

  if (!isXPrefixed) {
    return (
      <LabelledField id={id} label={filter.label}>
        {input}
      </LabelledField>
    );
  }

  const op = opField(filter);
  return (
    <LabelledField id={id} label={filter.label}>
      <div className="flex gap-2">
        <Select value={values[op] || DEFAULT_OP} onValueChange={(v) => onChange(op, v)}>
          <SelectTrigger
            className={`${operatorWidth} shrink-0`}
            aria-label={t('list.filterOperator', '{{label}} comparison', { label: filter.label })}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {input}
      </div>
    </LabelledField>
  );
}

const INTEGER_OPERATORS: OperatorOption[] = [
  { value: 'eq', label: '=' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
];

function IntegerFilter(props: FilterFieldProps<FilterInteger>) {
  return <ComparisonFilter {...props} inputType="number" operators={INTEGER_OPERATORS} operatorWidth="w-20" />;
}

function DateFilter(props: FilterFieldProps<FilterDate>) {
  const { t } = useTranslation();
  const operators = [
    { value: 'eq', label: t('filters.on', 'On') },
    { value: 'gt', label: t('filters.after', 'After') },
    { value: 'lt', label: t('filters.before', 'Before') },
  ];
  return <ComparisonFilter {...props} inputType="date" operators={operators} operatorWidth="w-24" />;
}

function ObjectIdFilter({ schema, filter, values, onCommit }: FilterFieldProps<FilterObjectId>) {
  const { t } = useTranslation();
  return (
    <GroupField label={filter.label}>
      <ObjectPicker
        schema={schema}
        objectName={filter.objectName}
        label={filter.label}
        value={values[filter.field] ?? ''}
        onChange={(id) => onCommit(filter.field, id)}
        onClear={() => onCommit(filter.field, '')}
        placeholder={t('list.selectFilterPlaceholder', 'Select {{label}}...', {
          label: filter.label.toLowerCase(),
        })}
      />
    </GroupField>
  );
}

export function FilterField(props: FilterFieldProps<Filter>) {
  const { filter } = props;
  switch (filter.type) {
    case 'text':
      return <TextFilter {...props} filter={filter} />;
    case 'enum':
      return <EnumFilter {...props} filter={filter} />;
    case 'integer':
      return <IntegerFilter {...props} filter={filter} />;
    case 'date':
      return <DateFilter {...props} filter={filter} />;
    case 'objectId':
      return <ObjectIdFilter {...props} filter={filter} />;
    default:
      return null;
  }
}
