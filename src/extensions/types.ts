/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ComponentType, LazyExoticComponent } from 'react';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { ValueVariant } from '@/components/values/ScalarValues';
import type { FieldType, NumberFormat, ScalarType, Schema, StringFormat } from '@/types/schema';

export type PageMode = 'list' | 'create' | 'edit' | 'detail' | 'singleton';

export interface PageProps {
  viewName: string;
  objectId: string | null;
  section: string;
}

export type PageComponent = LazyExoticComponent<ComponentType<PageProps>>;

export interface PageGate {
  permission: string;
  backingObject?: string;
  enterprise?: boolean;
}

export type RouteMatch = { customComponent: string } | { viewPrefix: string };

export type ObjectMatch = { object: string } | { view: string };

export type PageOverride =
  | { match: RouteMatch; component: PageComponent; gate?: PageGate }
  | { match: ObjectMatch; modes: readonly PageMode[]; component: PageComponent };

export type LabelMode = 'control' | 'group' | 'none';

export type RowLayout = 'side' | 'block' | 'inline';

export interface WidgetTraits {
  labelMode: LabelMode;
  readOnlyAsValue: boolean;
  layout: RowLayout;
  createOnly?: true;
}

export type WidgetKey =
  | 'string'
  | 'string:secret'
  | 'string:multiline'
  | 'string:sieve'
  | 'string:color'
  | 'string:localTime'
  | 'string:localDate'
  | 'number'
  | 'number:size'
  | 'number:duration'
  | 'utcDateTime'
  | 'boolean'
  | 'enum'
  | 'enum:TimeZone'
  | 'blobId'
  | 'objectId'
  | 'object'
  | 'object:x:Expression'
  | 'object:x:Rate'
  | 'object:x:OtpAuth'
  | 'object:x:PasskeyRegistration'
  | 'objectList'
  | 'objectList:x:WorkingHoursSlot'
  | 'set'
  | 'set:enum'
  | 'map'
  | 'unsupported';

export type WidgetMatch =
  | { objectName: string }
  | { listObjectName: string }
  | { enumName: string }
  | { stringFormat: readonly StringFormat[] }
  | { numberFormat: readonly NumberFormat[] }
  | { setOf: ScalarType['type'] }
  | { type: FieldType['type'] };

export interface ValueProps {
  schema: Schema;
  type: FieldType;
  value: unknown;
  variant: ValueVariant;
}

export interface WidgetDefinition {
  key: WidgetKey;
  match: WidgetMatch;
  traits: WidgetTraits;
  Edit: ComponentType<WidgetProps>;
  View?: ComponentType<ValueProps>;
  RowAddon?: ComponentType<WidgetProps>;
}

export type ResolvedWidget = Omit<WidgetDefinition, 'match'>;
