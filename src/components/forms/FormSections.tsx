/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { FieldRow } from '@/components/forms/FieldRow';
import { VariantSelect } from '@/components/forms/VariantSelect';
import type { EmbeddedVariant } from '@/lib/embeddedSchema';
import { cn } from '@/lib/utils';
import type { FieldErrors, FieldValues, RenderableSection } from '@/components/forms/formLogic';
import type { FieldOverrides } from '@/components/forms/useDynamicForm';

interface VariantControl {
  variants: readonly EmbeddedVariant[];
  value: string;
  onChange: (variant: string) => void;
}

interface FormSectionsProps {
  sections: RenderableSection[];
  sectionId?: (key: string) => string;
  data: FieldValues;
  errors: FieldErrors;
  readOnly: boolean;
  onFieldChange: (name: string, value: unknown) => void;
  variant?: VariantControl;
  renderers?: FieldOverrides['render'];
}

export function FormSections({
  sections,
  sectionId,
  data,
  errors,
  readOnly,
  onFieldChange,
  variant,
  renderers,
}: FormSectionsProps) {
  return (
    <>
      {sections.map((section) => (
        <FormSectionCard key={section.key} id={sectionId?.(section.key)} title={section.title}>
          {section.fields.map(({ formField, field }) => {
            if (!field) {
              if (!variant) return null;
              return (
                <VariantSelect
                  key={formField.name}
                  label={formField.label}
                  variants={variant.variants}
                  value={variant.value}
                  onChange={variant.onChange}
                  readOnly={readOnly}
                />
              );
            }
            const Render = renderers && Object.hasOwn(renderers, formField.name) ? renderers[formField.name] : null;
            if (Render) {
              return (
                <Render
                  key={formField.name}
                  field={field}
                  formField={formField}
                  data={data}
                  errors={errors}
                  readOnly={readOnly}
                  onFieldChange={onFieldChange}
                />
              );
            }
            return (
              <FieldRow
                key={formField.name}
                field={field}
                formField={formField}
                value={data[formField.name]}
                onChange={(v) => onFieldChange(formField.name, v)}
                error={errors[formField.name]}
              />
            );
          })}
        </FormSectionCard>
      ))}
    </>
  );
}

export function FormSectionCard({ id, title, children }: { id?: string; title?: string; children: ReactNode }) {
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      className="tile @container scroll-mt-20 px-5 pb-1.5 outline-none sm:px-6"
    >
      {title && <h2 className="section-title pb-1 pt-5">{title}</h2>}
      <div className={cn('divide-y divide-border', !title && 'pt-1')}>{children}</div>
    </section>
  );
}
