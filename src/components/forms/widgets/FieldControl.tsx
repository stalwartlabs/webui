/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { resolveWidget } from '@/extensions/widgets';
import type { WidgetProps } from '@/components/forms/widgets/types';

export function FieldControl(props: WidgetProps) {
  const { Edit } = resolveWidget(props.type);
  return <Edit {...props} />;
}
