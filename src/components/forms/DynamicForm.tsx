/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useId, useState, useSyncExternalStore, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FloatingActionBar, FloatingActionDivider, FloatingActionDot } from '@/components/common/FloatingActionBar';
import { useCanAccess } from '@/hooks/usePermissions';
import { coerceLabel } from '@/lib/objectOptions';
import { TENANT_PROPERTY } from '@/lib/schemaResolver';
import { CreatedValuesDialog } from '@/components/forms/CreatedValuesDialog';
import { FormProvider } from '@/components/forms/FormProvider';
import { FormSections } from '@/components/forms/FormSections';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { formFieldLabels } from '@/components/forms/formLogic';
import { useDynamicForm, type DynamicFormModel, type DynamicFormOptions } from '@/components/forms/useDynamicForm';
import type { FieldValues, RenderableSection } from '@/components/forms/formLogic';
import { cn } from '@/lib/utils';

const SECTION_INDEX_MIN = 3;

export interface AfterSectionsProps {
  data: FieldValues;
  readOnly: boolean;
}

interface DynamicFormProps extends DynamicFormOptions {
  viewName: string;
  objectId: string | null;
  afterSections?: ComponentType<AfterSectionsProps>;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function useFormTitle(model: DynamicFormModel): string {
  const { t } = useTranslation();
  const { resolved, mode, isSingleton, state, parentForm, variantForm } = model;
  if (!resolved) return '';
  const titleForm = parentForm ?? variantForm;
  if (isSingleton) return titleForm?.title ?? resolved.object.objectType.description;
  const name = resolved.list?.singularName ?? resolved.object.objectType.description;
  if (mode === 'create') return t('form.createTitle', 'Create {{name}}', { name });
  const labelProperty = resolved.list?.labelProperty;
  const value = labelProperty ? coerceLabel(state.data[labelProperty], '') : '';
  return value
    ? t('form.editTitleWithValue', 'Edit {{name}}: {{value}}', { name, value })
    : t('form.editTitle', 'Edit {{name}}', { name });
}

const WIDE_QUERY = '(min-width: 80rem)';

function subscribeWide(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isWide(): boolean {
  return window.matchMedia(WIDE_QUERY).matches;
}

function useActiveSection(ids: readonly string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  const key = ids.join('|');
  useEffect(() => {
    if (!key) return;
    const list = key.split('|');
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = list.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: '-80px 0px -55% 0px' },
    );
    for (const id of list) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);
  return active;
}

function SectionIndex({ sections, sectionId }: { sections: RenderableSection[]; sectionId: (key: string) => string }) {
  const { t } = useTranslation();
  const titled = sections.filter((s) => s.title);
  const active = useActiveSection(titled.map((s) => sectionId(s.key)));
  return (
    <nav
      aria-label={t('form.sectionIndex', 'Form sections')}
      className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col gap-0.5 overflow-y-auto pt-1"
    >
      {titled.map((section) => {
        const id = sectionId(section.key);
        return (
          <button
            key={section.key}
            type="button"
            aria-current={active === id ? 'location' : undefined}
            onClick={() => {
              const section = document.getElementById(id);
              section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              section?.focus({ preventScroll: true });
            }}
            className={cn(
              'rounded-[10px] px-3 py-1.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground',
              active === id &&
                'bg-highlight font-semibold text-highlight-foreground hover:bg-highlight hover:text-highlight-foreground',
            )}
          >
            {section.title}
          </button>
        );
      })}
    </nav>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center p-12 text-muted-foreground" role="status">
      <Loader2 className="mr-2 h-6 w-6 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function DynamicForm({
  viewName,
  objectId,
  accountId,
  fieldOverrides,
  createValues,
  afterSections: AfterSections,
}: DynamicFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canUpdate = useCanAccess(viewName, 'Update');
  const canDestroy = useCanAccess(viewName, 'Destroy');
  const model = useDynamicForm(viewName, objectId, { accountId, fieldOverrides, createValues });
  const { schema, resolved, mode, isSingleton, state, isDirty, saving, loading, loadError } = model;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const title = useFormTitle(model);
  const sectionPrefix = useId();
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);

  if (!schema || !resolved) return <Loading label={t('form.loadingSchema', 'Loading schema...')} />;
  if (loading) return <Loading label={t('form.loadingData', 'Loading data...')} />;

  const isCreate = mode === 'create';
  const readOnly = !isCreate && !canUpdate;
  const canDelete = !isCreate && !isSingleton && canDestroy;
  const subtitle = (model.parentForm ?? model.variantForm)?.subtitle;
  const errorText = state.generalError ?? loadError;
  const header = (
    <div className="flex items-start gap-3.5 px-1 pb-1 pt-3">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="shrink-0"
        onClick={() => navigate(-1)}
        aria-label={t('common.back', 'Back')}
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </Button>
      <div className="min-w-0 flex-1 pt-1">
        <h1 className="page-title break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );

  if (model.loadFailed) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        {header}
        <div className="rounded-xl bg-destructive-soft p-4" role="alert">
          <p className="whitespace-pre-line text-sm text-destructive">{loadError}</p>
        </div>
        <Button type="button" variant="outline" onClick={model.retryLoad}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('common.retry', 'Retry')}
        </Button>
      </div>
    );
  }
  const deleteLabel = (
    resolved.list?.singularName ??
    resolved.object.objectType.description ??
    t('form.item', 'item')
  ).toLowerCase();
  const sch = resolved.resolvedSchema;
  const tenantValue = state.data[TENANT_PROPERTY];
  const sectionId = (key: string) => `${sectionPrefix}-section-${key.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  const showIndex = model.sections.filter((s) => s.title).length >= SECTION_INDEX_MIN;

  return (
    <div className={cn('mx-auto space-y-5', showIndex ? 'max-w-6xl' : 'max-w-5xl')}>
      {header}

      {errorText && (
        <div className="rounded-xl bg-destructive-soft p-4" role="alert">
          <p className="whitespace-pre-line text-sm text-destructive">{errorText}</p>
        </div>
      )}

      <div className={cn(showIndex && 'xl:grid xl:grid-cols-[11rem_minmax(0,1fr)] xl:items-start xl:gap-6')}>
        {showIndex && wide && <SectionIndex sections={model.sections} sectionId={sectionId} />}
        <div className="space-y-3.5">
          <FormProvider
            schema={schema}
            mode={mode}
            readOnly={readOnly}
            recordLabel={model.recordLabel}
            baseline={state.original}
            tenantId={typeof tenantValue === 'string' ? tenantValue : null}
          >
            <FormSections
              sections={model.sections}
              sectionId={sectionId}
              data={state.data}
              errors={state.fieldErrors}
              readOnly={readOnly}
              onFieldChange={model.setField}
              renderers={fieldOverrides?.render}
              variant={
                sch.type === 'multiple'
                  ? { variants: sch.variants, value: state.variant, onChange: model.setVariant }
                  : undefined
              }
            />
            {AfterSections && <AfterSections data={state.data} readOnly={readOnly} />}
          </FormProvider>
        </div>
      </div>

      <FloatingActionBar label={t('form.actions', 'Form actions')}>
        {canDelete && (
          <>
            <Button
              type="button"
              variant="ink-danger"
              size="sm"
              disabled={saving}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="max-sm:sr-only">{t('common.delete', 'Delete')}</span>
            </Button>
            <FloatingActionDivider />
          </>
        )}
        {isDirty && (
          <span className="flex items-center gap-2 px-2 text-[13px] text-ink-muted max-sm:hidden">
            <FloatingActionDot />
            {t('form.unsavedChangesLabel', 'Unsaved changes')}
          </span>
        )}
        <Button type="button" variant="ink" size="sm" onClick={() => navigate(-1)} disabled={saving}>
          {t('common.cancel', 'Cancel')}
        </Button>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            className="shadow-none"
            onClick={() => void model.save()}
            disabled={saving || (!isCreate && !isDirty)}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
            {isCreate ? t('common.create', 'Create') : t('common.save', 'Save')}
          </Button>
        )}
      </FloatingActionBar>

      <UnsavedChangesDialog blocker={model.guard.blocker} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        variant="destructive"
        title={t('form.deleteTitle', 'Delete {{name}}?', { name: capitalize(deleteLabel) })}
        description={t(
          'form.deleteDescription',
          'This action cannot be undone. This will permanently delete this {{name}}.',
          { name: deleteLabel },
        )}
        confirmLabel={t('common.delete', 'Delete')}
        onConfirm={model.remove}
      />

      <CreatedValuesDialog
        values={state.created?.values ?? null}
        labels={formFieldLabels(model.parentForm, model.variantForm)}
        onContinue={model.continueAfterCreate}
      />
    </div>
  );
}

export default DynamicForm;
