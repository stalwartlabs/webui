/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, Suspense } from 'react';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeObject } from '@/types/schema';

const OtpAuthField = lazy(() =>
  import('@/components/forms/widgets/OtpAuthField').then((m) => ({ default: m.OtpAuthField })),
);

const PasskeyRegistrationField = lazy(() =>
  import('@/components/forms/widgets/PasskeyRegistrationField').then((m) => ({
    default: m.PasskeyRegistrationField,
  })),
);

export function OtpAuthWidget(props: WidgetProps<FieldTypeObject>) {
  return (
    <Suspense fallback={null}>
      <OtpAuthField {...props} />
    </Suspense>
  );
}

export function PasskeyRegistrationWidget(props: WidgetProps<FieldTypeObject>) {
  return (
    <Suspense fallback={null}>
      <PasskeyRegistrationField {...props} />
    </Suspense>
  );
}
