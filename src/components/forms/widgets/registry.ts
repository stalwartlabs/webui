/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { FieldType } from '@/types/schema';

export type LabelMode = 'control' | 'group' | 'none';

type RowLayout = 'side' | 'block' | 'inline';

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
  | 'string:color'
  | 'number'
  | 'number:size'
  | 'number:duration'
  | 'utcDateTime'
  | 'boolean'
  | 'enum'
  | 'blobId'
  | 'objectId'
  | 'object'
  | 'object:x:Expression'
  | 'object:x:Rate'
  | 'object:x:OtpAuth'
  | 'object:x:PasskeyRegistration'
  | 'objectList'
  | 'set'
  | 'set:enum'
  | 'map'
  | 'unsupported';

export function widgetKey(type: FieldType): WidgetKey {
  switch (type.type) {
    case 'string':
      switch (type.format) {
        case 'secret':
        case 'secretText':
          return 'string:secret';
        case 'text':
        case 'html':
        case 'sieve':
          return 'string:multiline';
        case 'color':
          return 'string:color';
        default:
          return 'string';
      }
    case 'number':
      return type.format === 'size' ? 'number:size' : type.format === 'duration' ? 'number:duration' : 'number';
    case 'object':
      switch (type.objectName) {
        case 'x:Expression':
          return 'object:x:Expression';
        case 'x:Rate':
          return 'object:x:Rate';
        case 'x:OtpAuth':
          return 'object:x:OtpAuth';
        case 'x:PasskeyRegistration':
          return 'object:x:PasskeyRegistration';
        default:
          return 'object';
      }
    case 'set':
      return type.class.type === 'enum' ? 'set:enum' : 'set';
    case 'utcDateTime':
    case 'boolean':
    case 'enum':
    case 'blobId':
    case 'objectId':
    case 'objectList':
    case 'map':
      return type.type;
    default:
      return 'unsupported';
  }
}

const TRAITS: Record<WidgetKey, WidgetTraits> = {
  string: { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  'string:secret': { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  'string:multiline': { labelMode: 'control', readOnlyAsValue: true, layout: 'block' },
  'string:color': { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  number: { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  'number:size': { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  'number:duration': { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  utcDateTime: { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  boolean: { labelMode: 'control', readOnlyAsValue: true, layout: 'inline' },
  enum: { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  blobId: { labelMode: 'control', readOnlyAsValue: false, layout: 'block' },
  objectId: { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  object: { labelMode: 'group', readOnlyAsValue: false, layout: 'block' },
  'object:x:Expression': { labelMode: 'group', readOnlyAsValue: false, layout: 'block' },
  'object:x:Rate': { labelMode: 'control', readOnlyAsValue: false, layout: 'side' },
  'object:x:OtpAuth': { labelMode: 'none', readOnlyAsValue: false, layout: 'block' },
  'object:x:PasskeyRegistration': { labelMode: 'none', readOnlyAsValue: false, layout: 'block', createOnly: true },
  objectList: { labelMode: 'group', readOnlyAsValue: false, layout: 'block' },
  set: { labelMode: 'control', readOnlyAsValue: true, layout: 'side' },
  'set:enum': { labelMode: 'group', readOnlyAsValue: true, layout: 'side' },
  map: { labelMode: 'group', readOnlyAsValue: false, layout: 'block' },
  unsupported: { labelMode: 'none', readOnlyAsValue: false, layout: 'block' },
};

export function widgetTraits(type: FieldType): WidgetTraits {
  return TRAITS[widgetKey(type)];
}
