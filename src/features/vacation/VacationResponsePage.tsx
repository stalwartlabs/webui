/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { DynamicForm } from '@/components/forms/DynamicForm';
import type { FieldOverrides } from '@/components/forms/useDynamicForm';
import type { PageProps } from '@/extensions/types';
import { formatNumber } from '@/lib/format';
import { validateVacation } from './model';
import { PeriodRow } from './components/PeriodRow';
import { VacationPreview } from './components/VacationPreview';

export function VacationResponsePage({ viewName, objectId }: PageProps) {
  const { t } = useTranslation();
  const fieldOverrides: FieldOverrides = {
    hidden: ['toDate'],
    render: { fromDate: PeriodRow },
    validate: (data) =>
      validateVacation(data, {
        tooLong: (limit) =>
          t('vacation.tooLong', 'Too long: the server accepts up to {{limit}} bytes.', {
            limit: formatNumber(limit),
          }),
        endBeforeStart: t('vacation.endBeforeStart', 'The end must be after the start.'),
      }),
  };
  return (
    <DynamicForm
      viewName={viewName}
      objectId={objectId}
      fieldOverrides={fieldOverrides}
      afterSections={VacationPreview}
    />
  );
}
