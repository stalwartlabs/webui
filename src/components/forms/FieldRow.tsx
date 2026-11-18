/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Markdown } from '@/components/common/Markdown';
import { HelpTooltip } from '@/components/common/HelpTooltip';
import { FieldValue } from '@/components/values/FieldValue';
import { FieldScopeProvider } from '@/components/forms/FormProvider';
import { FieldControl } from '@/components/forms/widgets/FieldControl';
import { resolveWidget } from '@/extensions/widgets';
import { fieldIds, isEnterpriseLockedIn, useFieldScope, useFormContext } from '@/components/forms/formContext';
import { requiredMarker } from '@/components/forms/formLogic';
import { resolveObject } from '@/lib/schemaResolver';
import { cn } from '@/lib/utils';
import type { ControlProps } from '@/components/forms/widgets/types';
import type { Field, FormField } from '@/types/schema';

const ARIA_REQUIRED_TYPES = new Set(['string', 'number', 'enum', 'blobId']);

export interface FieldRowProps {
  field: Field;
  formField: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  readOnly?: boolean;
}

interface FieldLabelProps {
  id: string;
  htmlFor?: string;
  label: string;
  marker: 'required' | 'optional' | null;
  locked: boolean;
}

export function FieldLabel({ id, htmlFor, label, marker, locked }: FieldLabelProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5">
      <Label id={id} htmlFor={htmlFor} className="text-[13.5px] font-semibold leading-snug">
        {label}
        {marker === 'required' && (
          <span className="ml-1 text-brand-text" aria-hidden="true">
            *
          </span>
        )}
        {marker === 'optional' && (
          <span className="ml-1.5 text-xs font-normal text-dim">{t('field.optional', '(optional)')}</span>
        )}
      </Label>
      {locked && (
        <HelpTooltip
          icon={Lock}
          label={label}
          content={t('enterprise.featureDisabled', 'This feature requires an Enterprise license.')}
        />
      )}
    </div>
  );
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {error}
    </p>
  );
}

export function FieldRow({ field, formField, value, onChange, error, readOnly: forceReadOnly = false }: FieldRowProps) {
  const ctx = useFormContext();
  const scope = useFieldScope();
  if (field.enterprise && ctx.hideEnterprise) return null;

  const ft = field.type;
  const ids = fieldIds(ctx.idPrefix, [...scope.path, formField.name]);
  const topLevel = scope.path.length === 0;
  const referencesLocked =
    ft.type === 'objectId' && ctx.isCommunity && !!resolveObject(ctx.schema, ft.objectName)?.enterprise;
  const locked = isEnterpriseLockedIn(ctx, field.enterprise);
  const readOnly =
    scope.readOnly ||
    forceReadOnly ||
    locked ||
    referencesLocked ||
    field.update === 'serverSet' ||
    (topLevel && ctx.mode === 'edit' && field.update === 'immutable');
  const { traits, RowAddon } = resolveWidget(ft);
  const asValue = readOnly && traits.readOnlyAsValue;
  const marker = requiredMarker(field, readOnly);
  const describedBy =
    [field.description ? ids.descriptionId : null, error ? ids.errorId : null].filter(Boolean).join(' ') || undefined;
  const control: ControlProps = {
    id: ids.inputId,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    'aria-labelledby': traits.labelMode === 'group' ? ids.labelId : undefined,
    'aria-required': marker === 'required' && ARIA_REQUIRED_TYPES.has(ft.type) ? true : undefined,
  };

  const widgetProps = { type: ft, field, formField, value, onChange, readOnly, control, error };
  let body: ReactNode = asValue ? (
    <FieldValue schema={ctx.schema} type={ft} value={value} />
  ) : (
    <FieldScopeProvider name={formField.name} readOnly={readOnly}>
      <FieldControl {...widgetProps} />
    </FieldScopeProvider>
  );
  if (!asValue && traits.labelMode === 'group') {
    body = (
      <div role="group" aria-labelledby={ids.labelId} aria-describedby={describedBy}>
        {body}
      </div>
    );
  }

  if (traits.labelMode === 'none') {
    return (
      <div data-slot="field-row" className="space-y-1.5 py-4">
        {body}
        {RowAddon && <RowAddon {...widgetProps} />}
        <FieldError id={ids.errorId} error={error} />
      </div>
    );
  }

  const layout = asValue && traits.layout === 'inline' ? 'side' : traits.layout;
  return (
    <div
      data-slot="field-row"
      className={cn(
        'py-4',
        layout === 'side' ? 'field-grid' : 'grid gap-x-8 gap-y-2',
        layout === 'inline' && 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      <div className={cn('min-w-0 space-y-1', layout === 'side' && '@xl:pt-2')}>
        <FieldLabel
          id={ids.labelId}
          htmlFor={traits.labelMode === 'control' && !asValue ? ids.inputId : undefined}
          label={formField.label}
          marker={marker}
          locked={locked}
        />
        {field.description && (
          <div id={ids.descriptionId}>
            <Markdown source={field.description} className="text-[12.5px] leading-relaxed text-muted-foreground" />
          </div>
        )}
      </div>
      <div className={cn('min-w-0 space-y-1.5', layout === 'inline' && 'pt-0.5', asValue && '@xl:pt-2')}>
        <div className={cn(locked && 'opacity-60')}>{body}</div>
        {RowAddon && <RowAddon {...widgetProps} />}
        {layout !== 'inline' && <FieldError id={ids.errorId} error={error} />}
      </div>
      {layout === 'inline' && error && (
        <div className="col-span-full">
          <FieldError id={ids.errorId} error={error} />
        </div>
      )}
    </div>
  );
}
