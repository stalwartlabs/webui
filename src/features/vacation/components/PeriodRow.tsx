/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { FieldError, FieldLabel } from '@/components/forms/FieldRow';
import { fieldIds, useFormContext } from '@/components/forms/formContext';
import type { FieldRenderProps } from '@/components/forms/useDynamicForm';
import { rangeOf, utcDateValue } from '../model';
import { DateRangePicker } from './DateRangePicker';
import { VacationStatusLine } from './VacationStatusLine';

export function PeriodRow({ formField, data, errors, readOnly, onFieldChange }: FieldRenderProps) {
  const { t } = useTranslation();
  const ctx = useFormContext();
  const ids = fieldIds(ctx.idPrefix, [formField.name]);
  const error = errors.fromDate ?? errors.toDate;
  const describedBy = [ids.descriptionId, error ? ids.errorId : null].filter(Boolean).join(' ');

  return (
    <div data-slot="field-row" className="field-grid py-4">
      <div className="min-w-0 space-y-1 @xl:pt-2">
        <FieldLabel
          id={ids.labelId}
          htmlFor={ids.inputId}
          label={t('vacation.period', 'Period')}
          marker={null}
          locked={false}
        />
        <p id={ids.descriptionId} className="text-[12.5px] leading-relaxed text-muted-foreground">
          {t(
            'vacation.periodHelp',
            'Replies are sent only within this period. Leave the start open to begin now, or the end open to continue until you turn replies off.',
          )}
        </p>
      </div>
      <div className="min-w-0 space-y-2">
        <DateRangePicker
          value={rangeOf(data)}
          readOnly={readOnly}
          onChange={({ from, to }) => {
            onFieldChange('fromDate', utcDateValue(from));
            onFieldChange('toDate', utcDateValue(to));
          }}
          control={{
            id: ids.inputId,
            'aria-labelledby': `${ids.labelId} ${ids.inputId}`,
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
          }}
        />
        <FieldError id={ids.errorId} error={error} />
        <VacationStatusLine data={data} />
      </div>
    </div>
  );
}
