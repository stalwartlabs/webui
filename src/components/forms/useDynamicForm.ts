/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useReducer, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSchemaStore } from '@/stores/schemaStore';
import { usePermissionCheckers } from '@/hooks/usePermissions';
import { useResolvedView } from '@/hooks/useResolvedView';
import { toast } from '@/hooks/use-toast';
import {
  buildCreateDefaults,
  buildEmbeddedDefaults,
  deepMerge,
  getDisplayProperty,
  resolveForm,
  resolveVariantForm,
  type ResolvedView,
} from '@/lib/schemaResolver';
import { coerceLabel } from '@/lib/objectOptions';
import { layoutViewFor } from '@/lib/layout';
import { switchVariantValues } from '@/lib/embeddedSchema';
import { errorMessage, friendlySetError, validationErrorMessage } from '@/lib/jmapErrors';
import { logFormChange } from '@/lib/debug';
import { useJmapObject } from '@/data/objects';
import { useJmapSet } from '@/data/mutations';
import {
  buildCreatePayload,
  buildSections,
  buildUpdatePatch,
  collectBlobUploads,
  collectFetchProperties,
  combineForms,
  filterAccessibleFields,
  formFieldNames,
  isOtpAuthValid,
  mapSetError,
  mergeFieldErrors,
  validateFormat,
  validateRequired,
  validatedFieldNames,
  VARIANT_FIELD,
  type FieldErrors,
  type FieldValues,
} from '@/components/forms/formLogic';
import { formReducer, initialFormState, isFormDirty, type FormState } from '@/components/forms/formReducer';
import { useUnsavedChangesGuard } from '@/components/forms/useUnsavedChangesGuard';
import type { FormMode } from '@/components/forms/formContext';
import type { JmapSetError } from '@/types/jmap';
import type { Field, Fields, Form, FormField, Schema } from '@/types/schema';

const CREATE_ID = 'new-0';
const NOISY_CREATED_KEYS = new Set(['id', 'blobId']);

function createDefaults(
  schema: Schema,
  view: ResolvedView,
  variant: string | undefined,
  createValues: FieldValues | undefined,
): FieldValues {
  const defaults = buildCreateDefaults(schema, view.object, view.resolvedSchema, variant, view.list?.filtersStatic);
  const data = createValues ? deepMerge(defaults, createValues) : defaults;
  if (variant) data[VARIANT_FIELD] = variant;
  return data;
}

function initialCreateVariant(view: ResolvedView): string | undefined {
  const { resolvedSchema, list } = view;
  if (resolvedSchema.type !== 'multiple') return undefined;
  const fromFilter = list?.filtersStatic?.[VARIANT_FIELD];
  return typeof fromFilter === 'string' ? fromFilter : (resolvedSchema.variants[0]?.name ?? '');
}

function initialState(
  schema: Schema | null,
  view: ResolvedView | null,
  mode: FormMode,
  createValues: FieldValues | undefined,
): FormState {
  if (mode !== 'create' || !schema || !view) return initialFormState();
  const variant = initialCreateVariant(view);
  return initialFormState(createDefaults(schema, view, variant, createValues), variant ?? '', view);
}

function loadedVariant(view: ResolvedView, data: FieldValues): string {
  if (view.resolvedSchema.type !== 'multiple') return '';
  const type = data[VARIANT_FIELD];
  return typeof type === 'string' ? type : (view.resolvedSchema.variants[0]?.name ?? '');
}

export interface FieldRenderProps {
  field: Field;
  formField: FormField;
  data: FieldValues;
  errors: FieldErrors;
  readOnly: boolean;
  onFieldChange: (name: string, value: unknown) => void;
}

export interface FieldOverrides {
  hidden?: readonly string[];
  render?: Readonly<Record<string, ComponentType<FieldRenderProps>>>;
  validate?: (data: FieldValues) => FieldErrors;
}

export interface DynamicFormOptions {
  accountId?: string;
  fieldOverrides?: FieldOverrides;
  createValues?: FieldValues;
}

export function useDynamicForm(
  viewName: string,
  objectId: string | null,
  { accountId, fieldOverrides, createValues }: DynamicFormOptions = {},
) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schema = useSchemaStore((s) => s.schema);
  const viewToSection = useSchemaStore((s) => s.viewToSection);
  const { canGet } = usePermissionCheckers();
  const resolved = useResolvedView(viewName);
  const mode: FormMode = objectId === null ? 'create' : 'edit';
  const isSingleton = resolved?.object.objectType.type === 'singleton';
  const objectName = resolved?.object.objectName;

  const [state, dispatch] = useReducer(formReducer, null, () => initialState(schema, resolved, mode, createValues));
  const isDirty = isFormDirty(state);

  if (mode === 'create' && schema && resolved && state.source !== resolved) {
    const variant = initialCreateVariant(resolved);
    dispatch({
      type: 'load',
      data: createDefaults(schema, resolved, variant, createValues),
      variant: variant ?? '',
      source: resolved,
    });
  }

  const objectQuery = useJmapObject(
    objectName,
    mode === 'create' ? null : isSingleton ? 'singleton' : objectId,
    schema && resolved ? collectFetchProperties(schema, resolved, viewName) : ['id'],
    { staleTime: 0, refetchOnMount: 'always', accountId },
  );
  if (objectQuery.data && objectQuery.data !== state.source && !isDirty && resolved) {
    dispatch({
      type: 'load',
      data: { ...objectQuery.data },
      variant: loadedVariant(resolved, objectQuery.data),
      source: objectQuery.data,
    });
  }

  useEffect(() => {
    logFormChange(`${viewName}${objectId ? ` (${objectId})` : ' (new)'}`, state.data);
  }, [state.data, viewName, objectId]);

  const setMutation = useJmapSet(objectName);
  const saving = setMutation.isPending;
  const guard = useUnsavedChangesGuard(isDirty && !saving);

  const sch = resolved?.resolvedSchema ?? null;
  const variant = sch?.type === 'multiple' ? sch.variants.find((v) => v.name === state.variant) : undefined;
  const rawFields: Fields | null = !sch ? null : sch.type === 'single' ? sch.fields : (variant?.fields ?? null);
  const fields = schema ? filterAccessibleFields(rawFields, schema, canGet) : null;

  let parentForm: Form | null = null;
  let variantForm: Form | null = null;
  if (schema && resolved && sch) {
    if (sch.type === 'single') {
      variantForm = resolveForm(schema, viewName, resolved.object.objectName, sch.schemaName);
    } else {
      parentForm = schema.forms[viewName] ?? schema.forms[resolved.object.objectName] ?? null;
      variantForm = variant
        ? resolveVariantForm(schema, viewName, resolved.object.objectName, variant.schemaName)
        : null;
    }
  }
  const form = sch?.type === 'multiple' ? combineForms(parentForm, variantForm) : variantForm;
  const hidden = new Set(fieldOverrides?.hidden);
  const sections = buildSections(form, fields, mode, hidden);

  const loading = mode === 'edit' && objectQuery.fetchStatus !== 'idle' && !objectQuery.isFetchedAfterMount;
  const loadError =
    mode === 'create'
      ? null
      : objectQuery.isError
        ? errorMessage(objectQuery.error, t('form.failedToLoadData', 'Failed to load data.'))
        : objectQuery.isSuccess && !objectQuery.data
          ? t('form.objectNotFound', 'Object not found.')
          : null;
  const loadFailed = mode === 'edit' && loadError !== null && !objectQuery.data;
  const retryLoad = () => void objectQuery.refetch();

  const labelProperty = schema ? (resolved?.list?.labelProperty ?? getDisplayProperty(schema, viewName)) : undefined;
  const recordLabel = labelProperty ? coerceLabel(state.data[labelProperty], '') : '';

  const listView = schema ? layoutViewFor(schema, viewToSection, viewName) : null;
  const listPath = listView ? `/${viewToSection[listView]}/${listView}` : '/';
  const leaveToList = () => {
    guard.allowNextNavigation();
    navigate(listPath);
  };

  const applySetError = (error: JmapSetError) => {
    const known = new Set(Object.keys(fields?.properties ?? {}));
    for (const name of hidden) known.delete(name);
    const { general, fieldErrors } = mapSetError(error, known, {
      general: friendlySetError(error),
      invalidValue: t('form.invalidValue', 'Invalid value.'),
      validation: validationErrorMessage,
    });
    dispatch({ type: 'setErrors', generalError: general, fieldErrors });
  };

  const notConfirmed = () =>
    dispatch({ type: 'setErrors', generalError: t('form.notConfirmed', 'The server did not confirm the change.') });

  const setField = (name: string, value: unknown) => dispatch({ type: 'setField', name, value });

  const setVariant = (next: string) => {
    if (!schema || !resolved || resolved.resolvedSchema.type !== 'multiple') return;
    const { variants } = resolved.resolvedSchema;
    const defaults =
      mode === 'create'
        ? createDefaults(schema, resolved, next, createValues)
        : buildEmbeddedDefaults(schema, resolved.object.objectName, {}, next);
    const data = switchVariantValues(
      variants.find((v) => v.name === state.variant)?.fields,
      variants.find((v) => v.name === next)?.fields,
      state.data,
      defaults,
      mode === 'edit' ? state.original : undefined,
    );
    dispatch({ type: 'setVariant', variant: next, data });
  };

  const save = async () => {
    if (!resolved || saving) return;
    if (fields) {
      const visibleNames = validatedFieldNames(formFieldNames(parentForm, variantForm), fields, hidden);
      const errors = mergeFieldErrors(
        validateRequired(
          state.data,
          fields,
          mode,
          {
            required: t('form.required', 'This field is required.'),
            minItems: (count) => t('form.minItems', 'Add at least {{count}} entries.', { count }),
          },
          visibleNames,
          schema ?? undefined,
        ),
        fieldOverrides?.validate?.(state.data) ?? {},
        schema
          ? validateFormat(
              state.data,
              fields,
              schema,
              {
                localTime: t('form.invalidLocalTime', 'Enter a valid time.'),
                localDate: t('form.invalidLocalDate', 'Enter a valid date as YYYY-MM-DD.'),
                weeklySchedule: t('form.invalidWeeklySchedule', 'Correct the intervals in this schedule.'),
              },
              visibleNames,
            )
          : {},
      );
      if (Object.keys(errors).length > 0) {
        dispatch({
          type: 'setErrors',
          generalError: t('form.correctErrorsBelow', 'Please correct the errors below.'),
          fieldErrors: errors,
        });
        return;
      }
    }
    if (!isOtpAuthValid(state.data)) {
      dispatch({
        type: 'setErrors',
        generalError: t('form.otpCodeRequired', 'Enter your current authenticator code to authorise this change.'),
      });
      return;
    }
    dispatch({ type: 'setErrors', generalError: null });

    try {
      if (mode === 'create') {
        const { blobs, payload } = collectBlobUploads(
          buildCreatePayload(state.data, fields, {
            filtersStatic: resolved.list?.filtersStatic,
            variant: resolved.resolvedSchema.type === 'multiple' ? state.variant : undefined,
          }),
          fields,
        );
        const result = await setMutation.mutateAsync({ create: { [CREATE_ID]: payload }, blobs, accountId });
        const created = result.created?.[CREATE_ID];
        if (created) {
          const extras: FieldValues = {};
          for (const [key, value] of Object.entries(created)) {
            if (!NOISY_CREATED_KEYS.has(key)) extras[key] = value;
          }
          if (Object.keys(extras).length > 0) {
            dispatch({ type: 'created', result: { id: String(created.id), values: extras } });
          } else {
            toast({ title: t('form.createdSuccess', 'Created successfully'), variant: 'success' });
            dispatch({ type: 'commit' });
            leaveToList();
          }
        } else if (result.notCreated?.[CREATE_ID]) {
          applySetError(result.notCreated[CREATE_ID]);
        } else {
          notConfirmed();
        }
        return;
      }

      const patch = buildUpdatePatch(state.original, state.data, fields);
      if (Object.keys(patch).length === 0) {
        toast({ title: t('form.noChangesToSave', 'No changes to save'), variant: 'default' });
        return;
      }
      const { blobs, payload } = collectBlobUploads(patch, fields, state.original);
      const updateId = isSingleton ? 'singleton' : objectId!;
      const result = await setMutation.mutateAsync({ update: { [updateId]: payload }, blobs, accountId });
      if (result.updated && updateId in result.updated) {
        toast({ title: t('form.savedSuccess', 'Saved successfully'), variant: 'success' });
        dispatch({ type: 'commit' });
        if (!isSingleton) leaveToList();
      } else if (result.notUpdated?.[updateId]) {
        applySetError(result.notUpdated[updateId]);
      } else {
        notConfirmed();
      }
    } catch (err) {
      dispatch({ type: 'setErrors', generalError: errorMessage(err, t('form.failedToSave', 'Failed to save.')) });
    }
  };

  const remove = async () => {
    if (!resolved || !objectId) return;
    dispatch({ type: 'setErrors', generalError: null });
    try {
      const result = await setMutation.mutateAsync({ destroy: [objectId], accountId });
      if (result.destroyed?.includes(objectId)) {
        const label = resolved.list?.singularName ?? resolved.object.objectType.description;
        toast({
          title: t('form.deletedSuccess', '{{name}} deleted successfully', {
            name: label.charAt(0).toUpperCase() + label.slice(1),
          }),
          variant: 'success',
        });
        dispatch({ type: 'commit' });
        leaveToList();
      } else if (result.notDestroyed?.[objectId]) {
        dispatch({ type: 'setErrors', generalError: friendlySetError(result.notDestroyed[objectId]) });
      } else {
        notConfirmed();
      }
    } catch (err) {
      dispatch({ type: 'setErrors', generalError: errorMessage(err, t('form.failedToDelete', 'Failed to delete.')) });
    }
  };

  const continueAfterCreate = () => {
    dispatch({ type: 'commit' });
    leaveToList();
  };

  return {
    schema,
    resolved,
    mode,
    isSingleton,
    state,
    isDirty,
    saving,
    loading,
    loadError,
    loadFailed,
    retryLoad,
    fields,
    parentForm,
    variantForm,
    form,
    sections,
    recordLabel,
    guard,
    setField,
    setVariant,
    save,
    remove,
    continueAfterCreate,
  };
}

export type DynamicFormModel = ReturnType<typeof useDynamicForm>;
