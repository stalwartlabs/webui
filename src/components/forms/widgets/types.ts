/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Field, FieldType, FormField } from '@/types/schema';

export interface ControlProps {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  'aria-required'?: boolean;
  'aria-label'?: string;
}

export interface WidgetProps<T extends FieldType = FieldType> {
  type: T;
  field: Field;
  formField: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  control: ControlProps;
  error?: string;
}
