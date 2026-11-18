/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ObjectFieldFrame, ObjectSearchPopover } from '@/components/common/ObjectSearchPopover';
import { useNoPermissionMessage } from '@/lib/objectOptions';
import { useObjectOptions, useDisplayName } from '@/data/objectOptions';
import type { Schema } from '@/types/schema';

interface ObjectPickerProps {
  schema: Schema;
  objectName: string;
  label: string;
  value: string;
  onChange: (id: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

export function ObjectPicker({ schema, objectName, label, value, onChange, onClear, placeholder }: ObjectPickerProps) {
  const { t } = useTranslation();
  const list = useObjectOptions(objectName, schema);
  const fromList = list.options.find((o) => o.id === value)?.label;
  const { label: cheapLabel, loading: labelLoading } = useDisplayName(
    objectName,
    fromList ? null : value || null,
    schema,
  );
  const display = fromList ?? cheapLabel;
  const noPermissionMessage = useNoPermissionMessage(schema, objectName);

  return (
    <ObjectFieldFrame disabled={!!noPermissionMessage} single>
      {value && (
        <Badge
          variant="secondary"
          className="h-7 min-w-0 max-w-full gap-1 sm:max-w-xs pl-3 pr-1 text-[13px] font-medium"
        >
          {labelLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <span className="truncate" title={display ?? value}>
              {display ?? value}
            </span>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="grid size-5 shrink-0 place-items-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-highlight hover:text-highlight-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('field.clearValue', 'Clear {{name}}', { name: label })}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </Badge>
      )}
      <ObjectSearchPopover
        label={t('field.chooseValue', 'Choose {{name}}', { name: label })}
        placeholder={value ? '' : (placeholder ?? t('field.selectEllipsis', 'Select...'))}
        options={list.options}
        loading={list.loading}
        error={list.error}
        ensureLoaded={list.ensureLoaded}
        onSelect={onChange}
        disabledMessage={noPermissionMessage}
      />
    </ObjectFieldFrame>
  );
}
