/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ComponentType } from 'react';
import {
  ColorWidget,
  MultilineWidget,
  SecretWidget,
  SieveWidget,
  TextWidget,
} from '@/components/forms/widgets/StringWidgets';
import { DurationWidget, NumberWidget, SizeWidget } from '@/components/forms/widgets/NumberWidgets';
import { DateTimeWidget } from '@/components/forms/widgets/DateTimeWidget';
import {
  LocalDateValue,
  LocalDateWidget,
  LocalTimeValue,
  LocalTimeWidget,
} from '@/components/forms/widgets/LocalDateTimeWidgets';
import { BooleanWidget } from '@/components/forms/widgets/BooleanWidget';
import { EnumWidget } from '@/components/forms/widgets/EnumWidgets';
import { BlobWidget } from '@/components/forms/widgets/BlobWidget';
import { ObjectIdWidget } from '@/components/forms/widgets/ObjectIdWidgets';
import { SetWidget } from '@/components/forms/widgets/SetWidget';
import { EmbeddedObjectWidget } from '@/components/forms/widgets/EmbeddedObjectWidget';
import { ObjectListWidget } from '@/components/forms/widgets/ObjectListWidget';
import { MapWidget } from '@/components/forms/widgets/MapWidget';
import { RateWidget } from '@/components/forms/widgets/RateWidget';
import { ExpressionWidget } from '@/components/forms/widgets/ExpressionWidget';
import { OtpAuthWidget, PasskeyRegistrationWidget } from '@/components/forms/widgets/LazyWidgets';
import { UnsupportedWidget } from '@/components/forms/widgets/UnsupportedWidget';
import { TimeZoneWidget } from '@/components/forms/widgets/TimeZoneWidget';
import { WeeklyScheduleWidget } from '@/components/forms/widgets/WeeklyScheduleWidget';
import { TimeZoneValue } from '@/components/values/TimeZoneValue';
import { WeeklyScheduleValue } from '@/components/values/WeeklyScheduleValue';
import { SievepadRowAddon } from '@/components/forms/SievepadButton';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { ResolvedWidget, WidgetDefinition, WidgetKey, WidgetMatch, WidgetTraits } from '@/extensions/types';
import type {
  FieldType,
  FieldTypeEnum,
  FieldTypeNumber,
  FieldTypeObject,
  FieldTypeObjectList,
  FieldTypeSet,
  FieldTypeString,
  NumberFormat,
  StringFormat,
} from '@/types/schema';

type MatchedType<M extends WidgetMatch> = M extends { objectName: string }
  ? FieldTypeObject
  : M extends { listObjectName: string }
    ? FieldTypeObjectList
    : M extends { enumName: string }
      ? FieldTypeEnum
      : M extends { stringFormat: readonly StringFormat[] }
        ? FieldTypeString
        : M extends { numberFormat: readonly NumberFormat[] }
          ? FieldTypeNumber
          : M extends { setOf: string }
            ? FieldTypeSet
            : M extends { type: infer T }
              ? Extract<FieldType, { type: T }>
              : never;

interface TypedDefinition<M extends WidgetMatch> extends Omit<WidgetDefinition, 'match' | 'Edit'> {
  match: M;
  Edit: ComponentType<WidgetProps<MatchedType<M>>>;
}

function widget<M extends WidgetMatch>(definition: TypedDefinition<M>): WidgetDefinition {
  return definition as unknown as WidgetDefinition;
}

const SIDE: WidgetTraits = { labelMode: 'control', readOnlyAsValue: true, layout: 'side' };
const BLOCK_TEXT: WidgetTraits = { labelMode: 'control', readOnlyAsValue: true, layout: 'block' };
const GROUP_BLOCK: WidgetTraits = { labelMode: 'group', readOnlyAsValue: false, layout: 'block' };
const UNLABELLED: WidgetTraits = { labelMode: 'none', readOnlyAsValue: false, layout: 'block' };

export const WIDGETS: readonly WidgetDefinition[] = [
  widget({ key: 'string', match: { type: 'string' }, traits: SIDE, Edit: TextWidget }),
  widget({
    key: 'string:secret',
    match: { stringFormat: ['secret', 'secretText'] },
    traits: SIDE,
    Edit: SecretWidget,
  }),
  widget({
    key: 'string:multiline',
    match: { stringFormat: ['text', 'html'] },
    traits: BLOCK_TEXT,
    Edit: MultilineWidget,
  }),
  widget({
    key: 'string:sieve',
    match: { stringFormat: ['sieve'] },
    traits: BLOCK_TEXT,
    Edit: SieveWidget,
    RowAddon: SievepadRowAddon,
  }),
  widget({ key: 'string:color', match: { stringFormat: ['color'] }, traits: SIDE, Edit: ColorWidget }),
  widget({
    key: 'string:localTime',
    match: { stringFormat: ['localTime'] },
    traits: { labelMode: 'group', readOnlyAsValue: true, layout: 'side' },
    Edit: LocalTimeWidget,
    View: LocalTimeValue,
  }),
  widget({
    key: 'string:localDate',
    match: { stringFormat: ['localDate'] },
    traits: SIDE,
    Edit: LocalDateWidget,
    View: LocalDateValue,
  }),
  widget({ key: 'number', match: { type: 'number' }, traits: SIDE, Edit: NumberWidget }),
  widget({ key: 'number:size', match: { numberFormat: ['size'] }, traits: SIDE, Edit: SizeWidget }),
  widget({ key: 'number:duration', match: { numberFormat: ['duration'] }, traits: SIDE, Edit: DurationWidget }),
  widget({ key: 'utcDateTime', match: { type: 'utcDateTime' }, traits: SIDE, Edit: DateTimeWidget }),
  widget({
    key: 'boolean',
    match: { type: 'boolean' },
    traits: { labelMode: 'control', readOnlyAsValue: true, layout: 'inline' },
    Edit: BooleanWidget,
  }),
  widget({ key: 'enum', match: { type: 'enum' }, traits: SIDE, Edit: EnumWidget }),
  widget({
    key: 'enum:TimeZone',
    match: { enumName: 'TimeZone' },
    traits: SIDE,
    Edit: TimeZoneWidget,
    View: TimeZoneValue,
  }),
  widget({
    key: 'blobId',
    match: { type: 'blobId' },
    traits: { labelMode: 'control', readOnlyAsValue: false, layout: 'block' },
    Edit: BlobWidget,
  }),
  widget({ key: 'objectId', match: { type: 'objectId' }, traits: SIDE, Edit: ObjectIdWidget }),
  widget({ key: 'object', match: { type: 'object' }, traits: GROUP_BLOCK, Edit: EmbeddedObjectWidget }),
  widget({
    key: 'object:x:Expression',
    match: { objectName: 'x:Expression' },
    traits: GROUP_BLOCK,
    Edit: ExpressionWidget,
  }),
  widget({
    key: 'object:x:Rate',
    match: { objectName: 'x:Rate' },
    traits: { labelMode: 'control', readOnlyAsValue: false, layout: 'side' },
    Edit: RateWidget,
  }),
  widget({ key: 'object:x:OtpAuth', match: { objectName: 'x:OtpAuth' }, traits: UNLABELLED, Edit: OtpAuthWidget }),
  widget({
    key: 'object:x:PasskeyRegistration',
    match: { objectName: 'x:PasskeyRegistration' },
    traits: { ...UNLABELLED, createOnly: true },
    Edit: PasskeyRegistrationWidget,
  }),
  widget({ key: 'objectList', match: { type: 'objectList' }, traits: GROUP_BLOCK, Edit: ObjectListWidget }),
  widget({
    key: 'objectList:x:WorkingHoursSlot',
    match: { listObjectName: 'x:WorkingHoursSlot' },
    traits: { labelMode: 'group', readOnlyAsValue: true, layout: 'block' },
    Edit: WeeklyScheduleWidget,
    View: WeeklyScheduleValue,
  }),
  widget({ key: 'set', match: { type: 'set' }, traits: SIDE, Edit: SetWidget }),
  widget({
    key: 'set:enum',
    match: { setOf: 'enum' },
    traits: { labelMode: 'group', readOnlyAsValue: true, layout: 'side' },
    Edit: SetWidget,
  }),
  widget({ key: 'map', match: { type: 'map' }, traits: GROUP_BLOCK, Edit: MapWidget }),
];

const UNSUPPORTED: ResolvedWidget = {
  key: 'unsupported',
  traits: UNLABELLED,
  Edit: UnsupportedWidget,
};

interface WidgetIndex {
  objectName: Map<string, WidgetDefinition>;
  listObjectName: Map<string, WidgetDefinition>;
  enumName: Map<string, WidgetDefinition>;
  stringFormat: Map<string, WidgetDefinition>;
  numberFormat: Map<string, WidgetDefinition>;
  setOf: Map<string, WidgetDefinition>;
  type: Map<string, WidgetDefinition>;
}

function buildIndex(definitions: readonly WidgetDefinition[]): WidgetIndex {
  const index: WidgetIndex = {
    objectName: new Map(),
    listObjectName: new Map(),
    enumName: new Map(),
    stringFormat: new Map(),
    numberFormat: new Map(),
    setOf: new Map(),
    type: new Map(),
  };
  for (const definition of definitions) {
    const { match } = definition;
    if ('objectName' in match) index.objectName.set(match.objectName, definition);
    else if ('listObjectName' in match) index.listObjectName.set(match.listObjectName, definition);
    else if ('enumName' in match) index.enumName.set(match.enumName, definition);
    else if ('stringFormat' in match) for (const f of match.stringFormat) index.stringFormat.set(f, definition);
    else if ('numberFormat' in match) for (const f of match.numberFormat) index.numberFormat.set(f, definition);
    else if ('setOf' in match) index.setOf.set(match.setOf, definition);
    else index.type.set(match.type, definition);
  }
  return index;
}

const INDEX = buildIndex(WIDGETS);

function specific(table: Map<string, WidgetDefinition>, name: string, type: FieldType): ResolvedWidget {
  return table.get(name) ?? INDEX.type.get(type.type) ?? UNSUPPORTED;
}

export function resolveWidget(type: FieldType): ResolvedWidget {
  switch (type.type) {
    case 'object':
      return specific(INDEX.objectName, type.objectName, type);
    case 'objectList':
      return specific(INDEX.listObjectName, type.objectName, type);
    case 'enum':
      return specific(INDEX.enumName, type.enumName, type);
    case 'string':
      return specific(INDEX.stringFormat, type.format, type);
    case 'number':
      return specific(INDEX.numberFormat, type.format, type);
    case 'set':
      return specific(INDEX.setOf, type.class.type, type);
    default:
      return INDEX.type.get(type.type) ?? UNSUPPORTED;
  }
}

export function widgetKey(type: FieldType): WidgetKey {
  return resolveWidget(type).key;
}

export function widgetTraits(type: FieldType): WidgetTraits {
  return resolveWidget(type).traits;
}
