/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { calculateJmapPatch } from '@/lib/jmapPatch';
import { deepMerge, resolveForm, resolveObject, type ResolvedView } from '@/lib/schemaResolver';
import { SECRET_MASK } from '@/lib/jmapUtils';
import { embeddedEntries, isRecord, resolveEmbedded } from '@/lib/embeddedSchema';
import { isMissingValue, isRequiredField, isUnchangedSecret } from '@/lib/fieldRules';
import { widgetTraits } from '@/components/forms/widgets/registry';
import type { BlobUpload } from '@/services/jmap/client';
import type { JmapSetError, ValidationError } from '@/types/jmap';
import type { Field, FieldType, Fields, Form, FormField, Schema } from '@/types/schema';
import type { FormMode } from '@/components/forms/formContext';

export type FieldValues = Record<string, unknown>;
export type FieldErrors = Record<string, string>;

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!valuesEqual(a[i], b[i])) return false;
    return true;
  }
  const ar = a as Record<string, unknown>;
  const br = b as Record<string, unknown>;
  const aKeys = Object.keys(ar);
  if (aKeys.length !== Object.keys(br).length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(br, key) || !valuesEqual(ar[key], br[key])) return false;
  }
  return true;
}

export function changedKeys(original: FieldValues, current: FieldValues): Set<string> {
  const changed = new Set<string>();
  for (const key of new Set([...Object.keys(original), ...Object.keys(current)])) {
    if (!valuesEqual(original[key], current[key])) changed.add(key);
  }
  return changed;
}

export function isRequiredEligible(type: FieldType): boolean {
  switch (type.type) {
    case 'string':
    case 'number':
    case 'utcDateTime':
    case 'enum':
    case 'blobId':
    case 'objectId':
      return true;
    default:
      return false;
  }
}

function isNullable(type: FieldType): boolean {
  return 'nullable' in type && !!type.nullable;
}

export function requiredMarker(field: Field, readOnly: boolean): 'required' | 'optional' | null {
  if (readOnly || field.update === 'serverSet' || !isRequiredEligible(field.type)) return null;
  return isNullable(field.type) ? 'optional' : 'required';
}

function hasMissingNested(schema: Schema, objectName: string, value: unknown): boolean {
  if (!isRecord(value)) return false;
  const resolved = resolveEmbedded(schema, objectName, value);
  if (!resolved) return false;
  for (const { formField, field } of embeddedEntries(resolved)) {
    if (field.update === 'serverSet') continue;
    const nested = value[formField.name];
    if (isRequiredField(field) && isMissingValue(nested)) return true;
    if (field.type.type === 'object' && hasMissingNested(schema, field.type.objectName, nested)) return true;
  }
  return false;
}

export function validateRequired(
  data: FieldValues,
  fields: Fields,
  mode: FormMode,
  message: string,
  visible?: ReadonlySet<string>,
  schema?: Schema,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [name, field] of Object.entries(fields.properties)) {
    if (visible && !visible.has(name)) continue;
    if (isRequiredField(field, mode) && isMissingValue(data[name])) errors[name] = message;
    else if (
      schema &&
      field.type.type === 'object' &&
      field.update !== 'serverSet' &&
      !(mode === 'edit' && field.update === 'immutable') &&
      hasMissingNested(schema, field.type.objectName, data[name])
    ) {
      errors[name] = message;
    }
  }
  return errors;
}

export function isOtpAuthValid(data: unknown): boolean {
  if (!isRecord(data)) return true;
  for (const key of Object.keys(data)) {
    if (!isOtpAuthValid(data[key])) return false;
  }
  if (!('otpUrl' in data) || !('otpCode' in data)) return true;
  if (data.otpUrl == null || data.otpUrl === '') return true;
  return !(data.otpCode == null || data.otpCode === '' || data.otpCode === SECRET_MASK);
}

export function buildCreatePayload(
  data: FieldValues,
  fields: Fields | null,
  options: { filtersStatic?: Record<string, unknown>; variant?: string } = {},
): FieldValues {
  const validKeys = new Set<string>(['@type', ...Object.keys(fields?.properties ?? {})]);
  const base: FieldValues = {};
  for (const [key, value] of Object.entries(options.filtersStatic ?? {})) {
    if (validKeys.has(key)) base[key] = value;
  }
  const input: FieldValues = {};
  if (options.variant) input['@type'] = options.variant;
  for (const [name, field] of Object.entries(fields?.properties ?? {})) {
    if (field.update === 'serverSet' || !(name in data)) continue;
    if (isUnchangedSecret(field, data[name])) continue;
    input[name] = data[name];
  }
  return deepMerge(base, input);
}

function withoutMaskedSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutMaskedSecrets);
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (nested !== SECRET_MASK) result[key] = withoutMaskedSecrets(nested);
  }
  return result;
}

export function buildUpdatePatch(original: FieldValues, data: FieldValues, fields: Fields | null): FieldValues {
  const patch: FieldValues = {};
  if (original[VARIANT_FIELD] !== data[VARIANT_FIELD]) {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue;
      const field = fields?.properties[key];
      if (field?.update === 'serverSet') continue;
      if (field?.update === 'immutable' && valuesEqual(original[key], value)) continue;
      if (field && isUnchangedSecret(field, value)) continue;
      patch[key] = value === undefined ? null : withoutMaskedSecrets(value);
    }
    return patch;
  }
  for (const [key, value] of Object.entries(calculateJmapPatch(original, data))) {
    const field = fields?.properties[key.split('/')[0]];
    if (field && (field.update === 'immutable' || field.update === 'serverSet')) continue;
    if (field && isUnchangedSecret(field, value)) continue;
    if (key.includes('/') && value === SECRET_MASK) continue;
    patch[key] = withoutMaskedSecrets(value);
  }
  return patch;
}

export function collectBlobUploads(
  payload: FieldValues,
  fields: Fields | null,
  original?: FieldValues,
): { blobs: Record<string, BlobUpload>; payload: FieldValues } {
  const blobs: Record<string, BlobUpload> = {};
  if (!fields) return { blobs, payload };
  const next: FieldValues = { ...payload };
  let index = 0;
  for (const [key, value] of Object.entries(payload)) {
    if (fields.properties[key.split('/')[0]]?.type.type !== 'blobId') continue;
    if (typeof value !== 'string' || !value) continue;
    if (original && value === original[key]) continue;
    const tag = `temp-blob-${index++}`;
    blobs[tag] = { data: value };
    next[key] = `#${tag}`;
  }
  return { blobs, payload: next };
}

export interface SetErrorMessages {
  general: string;
  invalidValue: string;
  validation: (ve: ValidationError) => string;
}

export function mapSetError(
  error: JmapSetError,
  knownFields: ReadonlySet<string>,
  messages: SetErrorMessages,
): { general: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const extra: string[] = [];
  for (const prop of error.properties ?? []) {
    const top = prop.split('/')[0];
    if (top && knownFields.has(top)) fieldErrors[top] = error.description ?? messages.invalidValue;
  }
  for (const ve of error.validationErrors ?? []) {
    if (!ve.property) continue;
    const top = ve.property.split('/')[0];
    if (knownFields.has(top)) {
      fieldErrors[top] = messages.validation(ve);
    } else {
      extra.push(`${ve.property}: ${ve.value && ve.value.length > 0 ? ve.value : ve.type}`);
    }
  }
  return { general: [messages.general, ...extra].join('\n'), fieldErrors };
}

export function combineForms(parent: Form | null, variant: Form | null): Form | null {
  const sections = [...(parent?.sections ?? []), ...(variant?.sections ?? [])];
  if (sections.length === 0) return null;
  return {
    title: parent?.title ?? variant?.title,
    subtitle: parent?.subtitle ?? variant?.subtitle,
    sections,
  };
}

export function formFieldNames(...forms: (Form | null | undefined)[]): Set<string> {
  const names = new Set<string>();
  for (const form of forms) {
    for (const section of form?.sections ?? []) {
      for (const ff of section.fields) names.add(ff.name);
    }
  }
  return names;
}

export function formFieldLabels(...forms: (Form | null | undefined)[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const form of forms) {
    for (const section of form?.sections ?? []) {
      for (const ff of section.fields) labels.set(ff.name, ff.label);
    }
  }
  return labels;
}

export function referencedObjectNames(type: FieldType): string[] {
  switch (type.type) {
    case 'objectId':
    case 'object':
    case 'objectList':
      return [type.objectName];
    case 'set':
      return type.class.type === 'objectId' ? [type.class.objectName] : [];
    case 'map': {
      const names: string[] = [];
      if (type.keyClass.type === 'objectId') names.push(type.keyClass.objectName);
      if (type.valueClass.type === 'object') names.push(type.valueClass.objectName);
      return names;
    }
    default:
      return [];
  }
}

export function filterAccessibleFields(
  fields: Fields | null,
  schema: Schema,
  canGet: (permissionPrefix: string) => boolean,
): Fields | null {
  if (!fields) return null;
  const properties: Record<string, Field> = {};
  for (const [name, field] of Object.entries(fields.properties)) {
    const blocked = referencedObjectNames(field.type).some((objectName) => {
      const resolved = resolveObject(schema, objectName);
      return resolved ? !canGet(resolved.permissionPrefix) : false;
    });
    if (!blocked) properties[name] = field;
  }
  return { ...fields, properties };
}

export const VARIANT_FIELD = '@type';

export interface RenderableField {
  formField: FormField;
  field: Field | null;
}

export interface RenderableSection {
  key: string;
  title?: string;
  fields: RenderableField[];
}

export function buildSections(form: Form | null, fields: Fields | null, mode: FormMode): RenderableSection[] {
  const visible = (field: Field) =>
    mode === 'create' ? field.update !== 'serverSet' : !widgetTraits(field.type).createOnly;
  if (!form) {
    if (!fields) return [];
    const all = Object.entries(fields.properties)
      .filter(([, field]) => visible(field))
      .map(([name, field]) => ({ formField: { name, label: name }, field }));
    return all.length > 0 ? [{ key: 'section-0', fields: all }] : [];
  }
  const sections: RenderableSection[] = [];
  form.sections.forEach((section, index) => {
    const rendered: RenderableField[] = [];
    for (const ff of section.fields) {
      if (ff.name === VARIANT_FIELD) {
        rendered.push({ formField: ff, field: null });
        continue;
      }
      const field = fields?.properties[ff.name];
      if (field && visible(field)) rendered.push({ formField: ff, field });
    }
    if (rendered.length > 0) sections.push({ key: `section-${index}`, title: section.title, fields: rendered });
  });
  return sections;
}

export function collectFetchProperties(schema: Schema, view: ResolvedView, viewName: string): string[] {
  const { object, resolvedSchema } = view;
  const names = new Set<string>(['id']);
  const add = (form: Form | null | undefined) => {
    for (const section of form?.sections ?? []) {
      for (const ff of section.fields) {
        if (ff.name && ff.name !== VARIANT_FIELD) names.add(ff.name);
      }
    }
  };
  if (resolvedSchema.type === 'multiple') {
    names.add(VARIANT_FIELD);
    add(schema.forms[viewName] ?? schema.forms[object.objectName]);
    for (const variant of resolvedSchema.variants) {
      if (variant.schemaName) add(schema.forms[variant.schemaName]);
    }
  } else {
    const form = resolveForm(schema, viewName, object.objectName, resolvedSchema.schemaName);
    if (form) add(form);
    else for (const name of Object.keys(resolvedSchema.fields.properties)) names.add(name);
  }
  return Array.from(names);
}
