/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { LocalDateInput } from '@/components/forms/widgets/LocalDateInput';
import { LocalTimeInput } from '@/components/forms/widgets/LocalTimeInput';
import { formatLocalDate, formatLocalTime } from '@/lib/format';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { ValueProps } from '@/extensions/types';
import type { FieldTypeString } from '@/types/schema';

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

export function LocalTimeWidget({ type, value, onChange, readOnly, control }: WidgetProps<FieldTypeString>) {
  return (
    <LocalTimeInput
      {...control}
      value={stringOrNull(value)}
      onChange={onChange}
      allowEndOfDay
      clearable={!!type.nullable}
      disabled={readOnly}
    />
  );
}

export function LocalDateWidget({ type, formField, value, onChange, readOnly, control }: WidgetProps<FieldTypeString>) {
  return (
    <LocalDateInput
      {...control}
      value={stringOrNull(value)}
      onChange={onChange}
      clearable={!!type.nullable}
      disabled={readOnly}
      placeholder={formField.placeholder}
    />
  );
}

export function LocalTimeValue({ value }: ValueProps) {
  return <span className="text-sm tabular-nums">{formatLocalTime(value)}</span>;
}

export function LocalDateValue({ value }: ValueProps) {
  return <span className="text-sm">{formatLocalDate(value)}</span>;
}
