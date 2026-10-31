/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

// SPDX-SnippetBegin
// SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
// SPDX-License-Identifier: LicenseRef-SEL
import type { Dashboard } from '@/features/dashboard/types/schema';
// SPDX-SnippetEnd

export interface Schema {
  objects: Record<string, ObjectType>;
  schemas: Record<string, ObjectSchema>;
  fields: Record<string, Fields>;
  forms: Record<string, Form>;
  lists: Record<string, List>;
  enums: Record<string, EnumVariant[]>;
  // SPDX-SnippetBegin
  // SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
  // SPDX-License-Identifier: LicenseRef-SEL
  dashboards: Dashboard[];
  // SPDX-SnippetEnd
  layouts: Layout[];
}

export type ObjectType = ObjectTypeSingleton | ObjectTypeObject | ObjectTypeView;

export interface ObjectTypeSingleton {
  type: 'singleton';
  description: string;
  permissionPrefix: string;
  enterprise?: boolean;
}

export interface ObjectTypeObject {
  type: 'object';
  description: string;
  permissionPrefix: string;
  enterprise?: boolean;
}

export interface ObjectTypeView {
  type: 'view';
  objectName: string;
}

export type ObjectSchema = ObjectSchemaSingle | ObjectSchemaMultiple;

export interface ObjectSchemaSingle {
  type: 'single';
  schemaName: string;
}

export interface ObjectSchemaMultiple {
  type: 'multiple';
  variants: ObjectVariant[];
}

export interface ObjectVariant {
  name: string;
  label: string;
  schemaName?: string;
}

export interface Fields {
  properties: Record<string, Field>;
  defaults?: Record<string, unknown>;
}

export interface Field {
  description: string;
  type: FieldType;
  update: FieldUpdate;
  enterprise?: boolean;
}

export type FieldUpdate = 'mutable' | 'immutable' | 'serverSet';

export type FieldType =
  | FieldTypeString
  | FieldTypeNumber
  | FieldTypeUtcDateTime
  | FieldTypeBoolean
  | FieldTypeEnum
  | FieldTypeBlobId
  | FieldTypeObjectId
  | FieldTypeObject
  | FieldTypeObjectList
  | FieldTypeSet
  | FieldTypeMap;

export interface FieldTypeString {
  type: 'string';
  format: StringFormat;
  minLength?: number;
  maxLength?: number;
  nullable?: boolean;
}

export interface FieldTypeNumber {
  type: 'number';
  format: NumberFormat;
  min?: number;
  max?: number;
  nullable?: boolean;
}

export interface FieldTypeUtcDateTime {
  type: 'utcDateTime';
  nullable?: boolean;
}

export interface FieldTypeBoolean {
  type: 'boolean';
}

export interface FieldTypeEnum {
  type: 'enum';
  enumName: string;
  nullable?: boolean;
}

export type BlobFormat = 'sieve';

export interface FieldTypeBlobId {
  type: 'blobId';
  format?: BlobFormat;
}

export interface FieldTypeObjectId {
  type: 'objectId';
  objectName: string;
  nullable?: boolean;
}

export interface FieldTypeObject {
  type: 'object';
  objectName: string;
  nullable?: boolean;
}

export interface FieldTypeObjectList {
  type: 'objectList';
  objectName: string;
  minItems?: number;
  maxItems?: number;
}

export interface FieldTypeSet {
  type: 'set';
  class: ScalarType;
  minItems?: number;
  maxItems?: number;
}

export interface FieldTypeMap {
  type: 'map';
  keyClass: ScalarType;
  valueClass: MapValueType;
  minItems?: number;
  maxItems?: number;
}

export type ScalarType = ScalarTypeString | ScalarTypeObjectId | ScalarTypeEnum;

export interface ScalarTypeString {
  type: 'string';
  format: StringFormat;
  minLength?: number;
  maxLength?: number;
}

export interface ScalarTypeObjectId {
  type: 'objectId';
  objectName: string;
}

export interface ScalarTypeEnum {
  type: 'enum';
  enumName: string;
}

export type MapValueType = MapValueTypeString | MapValueTypeNumber | MapValueTypeEnum | MapValueTypeObject;

export interface MapValueTypeString {
  type: 'string';
  format: StringFormat;
  minLength?: number;
  maxLength?: number;
}

export interface MapValueTypeNumber {
  type: 'number';
  format: NumberFormat;
  min?: number;
  max?: number;
}

export interface MapValueTypeEnum {
  type: 'enum';
  enumName: string;
}

export interface MapValueTypeObject {
  type: 'object';
  objectName: string;
}

export type StringFormat =
  | 'string'
  | 'ipAddress'
  | 'ipNetwork'
  | 'socketAddress'
  | 'emailAddress'
  | 'secret'
  | 'secretText'
  | 'uri'
  | 'color'
  | 'text'
  | 'html'
  | 'sieve';

export type NumberFormat = 'integer' | 'unsignedInteger' | 'float' | 'size' | 'duration';

export interface EnumVariant {
  name: string;
  label: string;
  explanation?: string;
  color?: string;
}

export interface List {
  title: string;
  subtitle: string;
  labelProperty?: string;
  singularName: string;
  pluralName: string;
  columns: Column[];
  filters?: Filter[];
  filtersStatic?: Record<string, unknown>;
  sort?: string[];
  massActions?: MassAction[];
  itemActions?: ItemAction[];
}

export interface Column {
  name: string;
  label: string;
}

export type MassAction = MassActionSetProperty | MassActionDelete | MassActionSeparator;

export interface MassActionSetProperty {
  type: 'setProperty';
  label: string;
  properties: Record<string, unknown>;
}

export interface MassActionDelete {
  type: 'delete';
  label: string;
}

export interface MassActionSeparator {
  type: 'separator';
}

export type ItemAction =
  ItemActionDelete | ItemActionSetProperty | ItemActionQuery | ItemActionView | ItemActionSeparator;

export interface ItemActionDelete {
  type: 'delete';
  label: string;
}

export interface ItemActionSetProperty {
  type: 'setProperty';
  label: string;
  properties: Record<string, unknown>;
}

export interface ItemActionQuery {
  type: 'query';
  label: string;
  objectName: string;
  fieldName: string;
}

export interface ItemActionView {
  type: 'view';
  label: string;
  objectName: string;
}

export interface ItemActionSeparator {
  type: 'separator';
}

export type Filter = FilterText | FilterEnum | FilterInteger | FilterDate | FilterObjectId;

export interface FilterText {
  type: 'text';
  field: string;
  label: string;
}

export interface FilterEnum {
  type: 'enum';
  field: string;
  enumName: string;
  label: string;
}

export interface FilterInteger {
  type: 'integer';
  field: string;
  label: string;
}

export interface FilterDate {
  type: 'date';
  field: string;
  label: string;
}

export interface FilterObjectId {
  type: 'objectId';
  field: string;
  objectName: string;
  label: string;
}

export interface Form {
  title?: string;
  subtitle?: string;
  sections: FormSection[];
}

export interface FormSection {
  title?: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  label: string;
  keyLabel?: string;
  valueLabel?: string;
  placeholder?: string;
}

export interface Layout {
  name: string;
  icon: string;
  items: LayoutItem[];
}

export type LayoutItem = LayoutItemContainer | LayoutItemLink;

export interface LayoutItemContainer {
  container: {
    name: string;
    icon: string;
    items: LayoutSubItem[];
  };
}

export interface LayoutItemLink {
  link: {
    name: string;
    icon: string;
    viewName: string;
  };
}

export type LayoutSubItem = LayoutSubItemContainer | LayoutSubItemLink;

export interface LayoutSubItemContainer {
  type: 'container';
  name: string;
  items: LayoutSubItem[];
}

export interface LayoutSubItemLink {
  type: 'link';
  name: string;
  viewName: string;
}

// SPDX-SnippetBegin
// SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
// SPDX-License-Identifier: LicenseRef-SEL
export type {
  Dashboard,
  Card,
  Chart,
  Series,
  Aggregate,
  MetricScope,
  ChartKind,
  CardSource,
  MetricFormat,
} from '@/features/dashboard/types/schema';
// SPDX-SnippetEnd
