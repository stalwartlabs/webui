/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { SECRET_MASK } from '@/lib/jmapUtils';
import type { Field, FieldType, Fields, Form, FormField, Schema, StringFormat } from '@/types/schema';

export interface EmbeddedVariant {
  name: string;
  label: string;
  schemaName?: string;
}

export interface ResolvedEmbedded {
  objectName: string;
  variants: EmbeddedVariant[] | null;
  variant: EmbeddedVariant | null;
  fields: Fields | null;
  form: Form | null;
}

export interface EmbeddedEntry {
  formField: FormField;
  field: Field;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function resolveEmbedded(schema: Schema, objectName: string, value: unknown): ResolvedEmbedded | null {
  const entry = schema.schemas[objectName];
  if (!entry) return null;
  if (entry.type === 'single') {
    return {
      objectName,
      variants: null,
      variant: null,
      fields: schema.fields[entry.schemaName] ?? null,
      form: schema.forms[entry.schemaName] ?? schema.forms[objectName] ?? null,
    };
  }
  const typeName = isRecord(value) && typeof value['@type'] === 'string' ? value['@type'] : undefined;
  const variant = (typeName ? entry.variants.find((v) => v.name === typeName) : entry.variants[0]) ?? null;
  const schemaName = variant?.schemaName;
  return {
    objectName,
    variants: entry.variants,
    variant,
    fields: schemaName ? (schema.fields[schemaName] ?? null) : null,
    form: schemaName ? (schema.forms[schemaName] ?? null) : null,
  };
}

export function containsSecretMask(value: unknown): boolean {
  if (value === SECRET_MASK) return true;
  if (Array.isArray(value)) return value.some(containsSecretMask);
  if (isRecord(value)) return Object.values(value).some(containsSecretMask);
  return false;
}

export function carryOverSharedValues(
  from: Fields | null | undefined,
  to: Fields | null | undefined,
  current: unknown,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  if (!from || !to || !isRecord(current)) return defaults;
  const result = { ...defaults };
  for (const [name, field] of Object.entries(to.properties)) {
    if (name === '@type' || name === 'id' || field.update === 'serverSet') continue;
    const previous = from.properties[name];
    const value = current[name];
    if (!previous || value === undefined || containsSecretMask(value)) continue;
    if (JSON.stringify(previous.type) !== JSON.stringify(field.type)) continue;
    result[name] = value;
  }
  return result;
}

export function switchVariantValues(
  from: Fields | null | undefined,
  to: Fields | null | undefined,
  current: unknown,
  defaults: Record<string, unknown>,
  original?: unknown,
): Record<string, unknown> {
  if (isRecord(original) && defaults['@type'] !== undefined && original['@type'] === defaults['@type']) {
    return { ...original };
  }
  return carryOverSharedValues(from, to, current, defaults);
}

export function embeddedEntries(resolved: ResolvedEmbedded): EmbeddedEntry[] {
  const { fields, form } = resolved;
  if (!fields) return [];
  const entries: EmbeddedEntry[] = [];
  const formFields = form?.sections.flatMap((s) => s.fields) ?? [];
  if (formFields.length > 0) {
    for (const formField of formFields) {
      const field = fields.properties[formField.name];
      if (field) entries.push({ formField, field });
    }
    return entries;
  }
  for (const [name, field] of Object.entries(fields.properties)) {
    entries.push({ formField: { name, label: name }, field });
  }
  return entries;
}

export function variantLabel(schema: Schema, objectName: string, typeName: unknown): string | undefined {
  if (typeof typeName !== 'string') return undefined;
  const entry = schema.schemas[objectName];
  if (entry?.type !== 'multiple') return undefined;
  return entry.variants.find((v) => v.name === typeName)?.label;
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function isMultilineFormat(format: StringFormat): boolean {
  return format === 'text' || format === 'html' || format === 'sieve';
}

const SUMMARY_MAX_LENGTH = 80;

const NON_SUMMARY_FORMATS = new Set(['secret', 'secretText', 'text', 'html', 'sieve']);

function isSummarisable(type: FieldType): boolean {
  switch (type.type) {
    case 'string':
      return !NON_SUMMARY_FORMATS.has(type.format);
    case 'number':
    case 'utcDateTime':
    case 'enum':
    case 'objectId':
      return true;
    default:
      return false;
  }
}

export interface EmbeddedSummary {
  variantLabel?: string;
  summary?: { name: string; value: unknown; type: FieldType | null };
}

export function embeddedSummary(schema: Schema, objectName: string, value: unknown): EmbeddedSummary {
  if (!isRecord(value)) return {};
  const resolved = resolveEmbedded(schema, objectName, value);
  const result: EmbeddedSummary = { variantLabel: variantLabel(schema, objectName, value['@type']) };

  const candidates: NonNullable<EmbeddedSummary['summary']>[] = [];
  for (const formField of resolved?.form?.sections.flatMap((s) => s.fields) ?? []) {
    if (formField.name === '@type') continue;
    const field = resolved?.fields?.properties[formField.name];
    if (field && isSummarisable(field.type) && !isEmptyValue(value[formField.name])) {
      candidates.push({ name: formField.name, value: value[formField.name], type: field.type });
    }
  }
  const pick = candidates.find((c) => c.type?.type !== 'number') ?? candidates[0];
  if (pick) {
    result.summary = pick;
    return result;
  }

  for (const [key, val] of Object.entries(value)) {
    if (key === '@type' || key === 'id') continue;
    if (typeof val === 'string' && val.length > 0 && val.length <= SUMMARY_MAX_LENGTH) {
      const field = resolved?.fields?.properties[key];
      if (field && !isSummarisable(field.type)) continue;
      result.summary = { name: key, value: val, type: field?.type ?? null };
      return result;
    }
  }
  return result;
}
