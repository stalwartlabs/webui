/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ComponentType } from 'react';
import { Markdown } from '@/components/common/Markdown';
import { FieldError, FieldLabel, type FieldRowProps } from '@/components/forms/FieldRow';
import { fieldIds, useFieldScope, useFormContext } from '@/components/forms/formContext';
import { widgetTraits } from '@/extensions/widgets';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/components/forms/widgets/types';

interface RuleFieldRowProps extends Omit<FieldRowProps, 'readOnly'> {
  Edit: ComponentType<WidgetProps>;
}

export function RuleFieldRow({ field, formField, value, onChange, error, Edit }: RuleFieldRowProps) {
  const { idPrefix } = useFormContext();
  const { path, readOnly } = useFieldScope();
  const ids = fieldIds(idPrefix, [...path, formField.name]);
  const inline = widgetTraits(field.type).layout === 'inline';
  const describedBy =
    [field.description ? ids.descriptionId : null, error ? ids.errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div
      data-slot="field-row"
      className={cn('py-4', inline ? 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-8 gap-y-2' : 'field-grid')}
    >
      <div className={cn('min-w-0 space-y-1', !inline && '@xl:pt-2')}>
        <FieldLabel id={ids.labelId} htmlFor={ids.inputId} label={formField.label} marker={null} locked={false} />
        {field.description && (
          <div id={ids.descriptionId}>
            <Markdown source={field.description} className="text-[12.5px] leading-relaxed text-muted-foreground" />
          </div>
        )}
      </div>
      <div className={cn('min-w-0 space-y-1.5', inline && 'pt-0.5')}>
        <Edit
          type={field.type}
          field={field}
          formField={formField}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          control={{ id: ids.inputId, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy }}
        />
        <FieldError id={ids.errorId} error={error} />
      </div>
    </div>
  );
}
