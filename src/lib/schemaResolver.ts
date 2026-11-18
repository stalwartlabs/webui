/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type {
  Schema,
  ObjectTypeObject,
  ObjectTypeSingleton,
  Fields,
  Form,
  List,
  EnumVariant,
  MapValueType,
  ScalarType,
} from '@/types/schema';

export interface ResolvedObject {
  viewName: string;
  objectName: string;
  objectType: ObjectTypeObject | ObjectTypeSingleton;
  permissionPrefix: string;
  enterprise: boolean;
}

export function resolveObject(schema: Schema, viewName: string): ResolvedObject | null {
  const entry = schema.objects[viewName];
  if (!entry) return null;

  if (entry.type === 'view') {
    const parent = schema.objects[entry.objectName];
    if (!parent || parent.type === 'view') return null;
    return {
      viewName,
      objectName: entry.objectName,
      objectType: parent,
      permissionPrefix: parent.permissionPrefix,
      enterprise: parent.enterprise ?? false,
    };
  }

  return {
    viewName,
    objectName: viewName,
    objectType: entry,
    permissionPrefix: entry.permissionPrefix,
    enterprise: entry.enterprise ?? false,
  };
}

export interface ResolvedSingleSchema {
  type: 'single';
  schemaName: string;
  fields: Fields;
}

export interface ResolvedMultipleSchema {
  type: 'multiple';
  variants: {
    name: string;
    label: string;
    schemaName?: string;
    fields: Fields | null;
  }[];
}

export type ResolvedSchema = ResolvedSingleSchema | ResolvedMultipleSchema;

export function resolveSchema(schema: Schema, objectName: string): ResolvedSchema | null {
  const schemaEntry = schema.schemas[objectName];
  if (!schemaEntry) return null;

  if (schemaEntry.type === 'single') {
    const fields = schema.fields[schemaEntry.schemaName];
    if (!fields) return null;
    return { type: 'single', schemaName: schemaEntry.schemaName, fields };
  }

  return {
    type: 'multiple',
    variants: schemaEntry.variants.map((v) => ({
      name: v.name,
      label: v.label,
      schemaName: v.schemaName,
      fields: v.schemaName ? (schema.fields[v.schemaName] ?? null) : null,
    })),
  };
}

export const TENANT_PROPERTY = 'memberTenantId';

function hasTenantProperty(schema: Schema, schemaName: string | undefined): boolean {
  if (schemaName === undefined) return false;
  const fields = schema.fields[schemaName];
  return fields !== undefined && Object.hasOwn(fields.properties, TENANT_PROPERTY);
}

export function isTenantScoped(schema: Schema, viewOrObjectName: string): boolean {
  const entry = schema.objects[viewOrObjectName];
  const objectName = entry?.type === 'view' ? entry.objectName : viewOrObjectName;
  const schemaEntry = schema.schemas[objectName];
  if (!schemaEntry) return false;
  if (schemaEntry.type === 'single') return hasTenantProperty(schema, schemaEntry.schemaName);
  return schemaEntry.variants.some((v) => hasTenantProperty(schema, v.schemaName));
}

export function resolveList(schema: Schema, viewName: string, objectName: string): List | null {
  return schema.lists[viewName] ?? schema.lists[objectName] ?? null;
}

export function resolveForm(schema: Schema, viewName: string, objectName: string, schemaName: string): Form | null {
  return schema.forms[viewName] ?? schema.forms[objectName] ?? schema.forms[schemaName] ?? null;
}

export function resolveVariantForm(
  schema: Schema,
  _viewName: string,
  _objectName: string,
  variantSchemaName?: string,
): Form | null {
  if (variantSchemaName && schema.forms[variantSchemaName]) {
    return schema.forms[variantSchemaName];
  }
  return null;
}

export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      sourceVal &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

export function buildCreateDefaults(
  schema: Schema,
  resolvedObject: ResolvedObject,
  resolvedSchema: ResolvedSchema,
  variantName?: string,
  filtersStatic?: Record<string, unknown>,
): Record<string, unknown> {
  let defaults: Record<string, unknown> = {};
  let activeFields: Fields | null = null;

  if (resolvedSchema.type === 'single') {
    activeFields = resolvedSchema.fields;
    const childDefaults = resolvedSchema.fields.defaults ?? {};
    defaults = deepMerge(defaults, childDefaults);
  } else if (resolvedSchema.type === 'multiple' && variantName) {
    const variant = resolvedSchema.variants.find((v) => v.name === variantName);
    activeFields = variant?.fields ?? null;
    if (variant?.fields?.defaults) {
      defaults = deepMerge(defaults, variant.fields.defaults);
    }
    defaults['@type'] = variantName;
  }

  const parentSchemaEntry = schema.schemas[resolvedObject.objectName];
  if (parentSchemaEntry?.type === 'single') {
    const parentFields = schema.fields[parentSchemaEntry.schemaName];
    if (parentFields?.defaults) {
      defaults = deepMerge(defaults, parentFields.defaults);
    }
  }

  if (activeFields) {
    for (const [propName, propDef] of Object.entries(activeFields.properties)) {
      const t = propDef.type;
      if (t.type !== 'object') continue;

      if (defaults[propName] === null) continue;

      const parentChildOverride =
        defaults[propName] && typeof defaults[propName] === 'object' && !Array.isArray(defaults[propName])
          ? (defaults[propName] as Record<string, unknown>)
          : {};

      const nestedSchemaEntry = schema.schemas[t.objectName];
      let nestedVariant: string | undefined;
      if (nestedSchemaEntry?.type === 'multiple') {
        nestedVariant = (parentChildOverride['@type'] as string | undefined) ?? nestedSchemaEntry.variants[0]?.name;
      }

      const nested = buildEmbeddedDefaults(schema, t.objectName, parentChildOverride, nestedVariant);

      if (Object.keys(nested).length > 0) {
        defaults[propName] = nested;
      }
    }
  }

  if (filtersStatic && Object.keys(filtersStatic).length > 0) {
    const validKeys = new Set<string>(['@type']);
    if (activeFields) {
      for (const k of Object.keys(activeFields.properties)) validKeys.add(k);
    }
    if (resolvedSchema.type === 'multiple') {
      const parentSchemaName =
        parentSchemaEntry?.type === 'single' ? parentSchemaEntry.schemaName : resolvedObject.objectName;
      const parentProps = schema.fields[parentSchemaName]?.properties;
      if (parentProps) {
        for (const k of Object.keys(parentProps)) validKeys.add(k);
      }
    }

    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(filtersStatic)) {
      if (validKeys.has(k)) filtered[k] = v;
    }
    if (Object.keys(filtered).length > 0) {
      defaults = deepMerge(defaults, filtered);
    }
  }

  return defaults;
}

export function buildEmbeddedDefaults(
  schema: Schema,
  objectName: string,
  parentOverrides: Record<string, unknown> = {},
  variantName?: string,
): Record<string, unknown> {
  const schemaEntry = schema.schemas[objectName];
  if (!schemaEntry) return { ...parentOverrides };

  let fields: Fields | null = null;
  let result: Record<string, unknown> = {};

  if (schemaEntry.type === 'single') {
    fields = schema.fields[schemaEntry.schemaName] ?? null;
  } else {
    const variant = variantName ? schemaEntry.variants.find((v) => v.name === variantName) : schemaEntry.variants[0];
    if (!variant) return { '@type': variantName ?? '', ...parentOverrides };
    result['@type'] = variant.name;
    if (variant.schemaName) {
      fields = schema.fields[variant.schemaName] ?? null;
    }
  }

  if (fields) {
    if (fields.defaults) {
      result = deepMerge(result, fields.defaults);
    }

    for (const [propName, propDef] of Object.entries(fields.properties)) {
      const t = propDef.type;
      if (t.type !== 'object') continue;

      const parentChildOverride =
        result[propName] && typeof result[propName] === 'object' && !Array.isArray(result[propName])
          ? (result[propName] as Record<string, unknown>)
          : {};

      const nestedSchemaEntry = schema.schemas[t.objectName];
      let nestedVariant: string | undefined;
      if (nestedSchemaEntry?.type === 'multiple') {
        nestedVariant = (parentChildOverride['@type'] as string | undefined) ?? nestedSchemaEntry.variants[0]?.name;
      }

      const nestedDefaults = buildEmbeddedDefaults(schema, t.objectName, parentChildOverride, nestedVariant);

      if (Object.keys(nestedDefaults).length > 0) {
        result[propName] = nestedDefaults;
      }
    }
  }

  if (Object.keys(parentOverrides).length > 0) {
    result = deepMerge(result, parentOverrides);
  }

  return result;
}

export function buildNewObjectValue(schema: Schema, objectName: string, variantName?: string): Record<string, unknown> {
  const result = buildEmbeddedDefaults(schema, objectName, {}, variantName);
  return completeStructDefaults(schema, objectName, (result['@type'] as string | undefined) ?? variantName, result);
}

function completeStructDefaults(
  schema: Schema,
  objectName: string,
  variantName: string | undefined,
  target: Record<string, unknown>,
): Record<string, unknown> {
  const resolved = resolveSchema(schema, objectName);
  if (!resolved) return target;

  const fields =
    resolved.type === 'single'
      ? resolved.fields
      : ((variantName ? resolved.variants.find((v) => v.name === variantName) : resolved.variants[0])?.fields ?? null);
  if (!fields) return target;

  for (const [propName, propDef] of Object.entries(fields.properties)) {
    if (propDef.update === 'serverSet') continue;
    const t = propDef.type;

    if (t.type === 'boolean') {
      if (!(propName in target)) {
        target[propName] = false;
      }
      continue;
    }

    if (t.type !== 'object' || t.nullable) continue;

    const current = target[propName];
    if (current !== undefined && !isPlainRecord(current)) continue;

    const overrides = isPlainRecord(current) ? current : {};
    const nestedEntry = schema.schemas[t.objectName];
    const nestedVariant =
      nestedEntry?.type === 'multiple'
        ? ((overrides['@type'] as string | undefined) ?? nestedEntry.variants[0]?.name)
        : undefined;

    const nested = completeStructDefaults(schema, t.objectName, nestedVariant, { ...overrides });
    if (Object.keys(nested).length > 0) {
      target[propName] = nested;
    }
  }

  return target;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const EMPTY_ENUM: readonly EnumVariant[] = Object.freeze([]);

export function getEnum(schema: Schema | null | undefined, enumName: string): readonly EnumVariant[] {
  return schema?.enums[enumName] ?? EMPTY_ENUM;
}

export function getEnumVariant(
  schema: Schema | null | undefined,
  enumName: string,
  name: string,
): EnumVariant | undefined {
  return schema?.enums[enumName]?.find((v) => v.name === name);
}

export function mapEntryValueType(
  schema: Schema | null | undefined,
  keyClass: ScalarType,
  valueClass: MapValueType,
  key: string,
): MapValueType {
  if (keyClass.type !== 'enum' || valueClass.type !== 'number') return valueClass;
  const format = getEnumVariant(schema, keyClass.enumName, key)?.valueFormat;
  return format ? { ...valueClass, format } : valueClass;
}

export interface ResolvedView {
  object: ResolvedObject;
  resolvedSchema: ResolvedSchema;
  list: List | null;
}

const resolvedViewCache = new WeakMap<Schema, Map<string, ResolvedView | null>>();

export function resolveView(schema: Schema, viewName: string): ResolvedView | null {
  let perSchema = resolvedViewCache.get(schema);
  if (!perSchema) {
    perSchema = new Map();
    resolvedViewCache.set(schema, perSchema);
  }
  const cached = perSchema.get(viewName);
  if (cached !== undefined) return cached;

  let view: ResolvedView | null = null;
  const object = resolveObject(schema, viewName);
  if (object) {
    const resolvedSchema = resolveSchema(schema, object.objectName);
    if (resolvedSchema) {
      view = { object, resolvedSchema, list: resolveList(schema, viewName, object.objectName) };
    }
  }
  perSchema.set(viewName, view);
  return view;
}

function listLabelProperty(list: List | undefined): string | undefined {
  return list?.labelProperty || list?.columns?.[0]?.name || undefined;
}

const displayPropertyCache = new WeakMap<Schema, Map<string, string>>();

function computeDisplayProperty(schema: Schema, objectName: string): string {
  const own = listLabelProperty(schema.lists[objectName]);
  if (own) return own;

  const entry = schema.objects[objectName];
  const parentName = entry?.type === 'view' ? entry.objectName : objectName;
  if (parentName !== objectName) {
    const parent = listLabelProperty(schema.lists[parentName]);
    if (parent) return parent;
  }

  for (const [name, obj] of Object.entries(schema.objects)) {
    if (obj.type !== 'view' || obj.objectName !== parentName || name === objectName) continue;
    const viaView = listLabelProperty(schema.lists[name]);
    if (viaView) return viaView;
  }

  return 'name';
}

export function getDisplayProperty(schema: Schema, objectName: string): string {
  let perSchema = displayPropertyCache.get(schema);
  if (!perSchema) {
    perSchema = new Map();
    displayPropertyCache.set(schema, perSchema);
  }
  let property = perSchema.get(objectName);
  if (property === undefined) {
    property = computeDisplayProperty(schema, objectName);
    perSchema.set(objectName, property);
  }
  return property;
}
