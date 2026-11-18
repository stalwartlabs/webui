/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { ObjectFieldFrame, ObjectSearchPopover } from '@/components/common/ObjectSearchPopover';
import { useNoPermissionMessage } from '@/lib/objectOptions';
import { useObjectOptions, useDisplayName, type ObjectOption } from '@/data/objectOptions';
import { useFormContext } from '@/components/forms/formContext';
import { RemovablePill } from '@/components/forms/widgets/RemovablePill';
import type { ControlProps, WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeObjectId } from '@/types/schema';

function ObjectIdPill({
  objectName,
  id,
  options,
  onRemove,
  removeDisabled,
}: {
  objectName: string;
  id: string;
  options: ObjectOption[];
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const { schema } = useFormContext();
  const fromList = options.find((o) => o.id === id)?.label;
  const { label, loading } = useDisplayName(objectName, fromList ? null : id, schema);
  const display = fromList ?? label ?? id;
  return (
    <RemovablePill label={display} onRemove={onRemove} removeDisabled={removeDisabled}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : display}
    </RemovablePill>
  );
}

export function ObjectIdWidget({
  type,
  formField,
  value,
  onChange,
  readOnly,
  control,
}: WidgetProps<FieldTypeObjectId>) {
  const { t } = useTranslation();
  const { schema, tenantId } = useFormContext();
  const id = typeof value === 'string' ? value : '';
  const list = useObjectOptions(type.objectName, schema, tenantId);
  const noPermissionMessage = useNoPermissionMessage(schema, type.objectName);

  const pill = id ? (
    <ObjectIdPill
      objectName={type.objectName}
      id={id}
      options={list.options}
      onRemove={!readOnly && type.nullable ? () => onChange(null) : undefined}
    />
  ) : null;

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {pill ?? <span className="text-sm text-dim">{t('field.none', 'None')}</span>}
      </div>
    );
  }

  return (
    <ObjectFieldFrame disabled={!!noPermissionMessage} single>
      {pill}
      <ObjectSearchPopover
        control={control}
        label={t('field.chooseValue', 'Choose {{name}}', { name: formField.label })}
        placeholder={id ? '' : t('field.selectEllipsis', 'Select...')}
        options={list.options}
        loading={list.loading}
        error={list.error}
        ensureLoaded={list.ensureLoaded}
        onSelect={(next) => onChange(next)}
        disabledMessage={noPermissionMessage}
      />
    </ObjectFieldFrame>
  );
}

interface ObjectIdMultiSelectProps {
  objectName: string;
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  readOnly: boolean;
  minItems?: number;
  control: ControlProps;
}

export function ObjectIdMultiSelect({
  objectName,
  label,
  items,
  onChange,
  readOnly,
  minItems,
  control,
}: ObjectIdMultiSelectProps) {
  const { t } = useTranslation();
  const { schema, tenantId } = useFormContext();
  const list = useObjectOptions(objectName, schema, tenantId);
  const noPermissionMessage = useNoPermissionMessage(schema, objectName);
  const available = list.options.filter((o) => !items.includes(o.id));
  const atMinimum = minItems != null && items.length <= minItems;

  const pills = items.map((id) => (
    <ObjectIdPill
      key={id}
      objectName={objectName}
      id={id}
      options={list.options}
      removeDisabled={atMinimum}
      onRemove={readOnly ? undefined : () => onChange(items.filter((i) => i !== id))}
    />
  ));

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {pills}
        {items.length === 0 && <span className="text-sm text-dim">{t('field.none', 'None')}</span>}
      </div>
    );
  }

  return (
    <ObjectFieldFrame disabled={!!noPermissionMessage}>
      {pills}
      <ObjectSearchPopover
        control={control}
        label={t('field.addValue', 'Add {{name}}', { name: label })}
        placeholder={items.length === 0 ? t('field.selectEllipsis', 'Select...') : ''}
        options={available}
        loading={list.loading}
        error={list.error}
        ensureLoaded={list.ensureLoaded}
        onSelect={(id) => onChange([...items, id])}
        disabledMessage={noPermissionMessage}
      />
    </ObjectFieldFrame>
  );
}
