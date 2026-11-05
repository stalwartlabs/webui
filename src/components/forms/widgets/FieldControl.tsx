/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, Suspense } from 'react';
import { ColorWidget, MultilineWidget, SecretWidget, TextWidget } from '@/components/forms/widgets/StringWidgets';
import { DurationWidget, NumberWidget, SizeWidget } from '@/components/forms/widgets/NumberWidgets';
import { DateTimeWidget } from '@/components/forms/widgets/DateTimeWidget';
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
import { UnsupportedWidget } from '@/components/forms/widgets/UnsupportedWidget';
import { widgetKey } from '@/components/forms/widgets/registry';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type {
  FieldType,
  FieldTypeBlobId,
  FieldTypeBoolean,
  FieldTypeEnum,
  FieldTypeMap,
  FieldTypeNumber,
  FieldTypeObject,
  FieldTypeObjectId,
  FieldTypeObjectList,
  FieldTypeSet,
  FieldTypeString,
  FieldTypeUtcDateTime,
} from '@/types/schema';

const OtpAuthField = lazy(() =>
  import('@/components/forms/widgets/OtpAuthField').then((m) => ({ default: m.OtpAuthField })),
);

const PasskeyRegistrationField = lazy(() =>
  import('@/components/forms/widgets/PasskeyRegistrationField').then((m) => ({
    default: m.PasskeyRegistrationField,
  })),
);

function narrow<T extends FieldType>(props: WidgetProps): WidgetProps<T> {
  return props as WidgetProps<T>;
}

export function FieldControl(props: WidgetProps) {
  switch (widgetKey(props.type)) {
    case 'string':
      return <TextWidget {...narrow<FieldTypeString>(props)} />;
    case 'string:secret':
      return <SecretWidget {...narrow<FieldTypeString>(props)} />;
    case 'string:multiline':
      return <MultilineWidget {...narrow<FieldTypeString>(props)} />;
    case 'string:color':
      return <ColorWidget {...narrow<FieldTypeString>(props)} />;
    case 'number':
      return <NumberWidget {...narrow<FieldTypeNumber>(props)} />;
    case 'number:size':
      return <SizeWidget {...narrow<FieldTypeNumber>(props)} />;
    case 'number:duration':
      return <DurationWidget {...narrow<FieldTypeNumber>(props)} />;
    case 'utcDateTime':
      return <DateTimeWidget {...narrow<FieldTypeUtcDateTime>(props)} />;
    case 'boolean':
      return <BooleanWidget {...narrow<FieldTypeBoolean>(props)} />;
    case 'enum':
      return <EnumWidget {...narrow<FieldTypeEnum>(props)} />;
    case 'blobId':
      return <BlobWidget {...narrow<FieldTypeBlobId>(props)} />;
    case 'objectId':
      return <ObjectIdWidget {...narrow<FieldTypeObjectId>(props)} />;
    case 'object':
      return <EmbeddedObjectWidget {...narrow<FieldTypeObject>(props)} />;
    case 'object:x:Expression':
      return <ExpressionWidget {...narrow<FieldTypeObject>(props)} />;
    case 'object:x:Rate':
      return <RateWidget {...narrow<FieldTypeObject>(props)} />;
    case 'object:x:OtpAuth':
      return (
        <Suspense fallback={null}>
          <OtpAuthField {...narrow<FieldTypeObject>(props)} />
        </Suspense>
      );
    case 'object:x:PasskeyRegistration':
      return (
        <Suspense fallback={null}>
          <PasskeyRegistrationField {...narrow<FieldTypeObject>(props)} />
        </Suspense>
      );
    case 'objectList':
      return <ObjectListWidget {...narrow<FieldTypeObjectList>(props)} />;
    case 'set':
    case 'set:enum':
      return <SetWidget {...narrow<FieldTypeSet>(props)} />;
    case 'map':
      return <MapWidget {...narrow<FieldTypeMap>(props)} />;
    case 'unsupported':
      return <UnsupportedWidget {...props} />;
  }
}
