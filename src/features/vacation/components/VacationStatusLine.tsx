/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormContext } from '@/components/forms/formContext';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { hasUnsavedStatus, nextStatusChange, vacationStatus, type VacationStatus } from '../model';
import type { FieldValues } from '@/components/forms/formLogic';

const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

type Tone = 'muted' | 'success' | 'info' | 'warning';

const TONE_CLASSES: Record<Tone, string> = {
  muted: 'bg-muted text-muted-foreground',
  success: 'bg-success-soft text-success',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
};

const DOT_CLASSES: Record<Tone, string> = {
  muted: 'bg-dim',
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
};

function useStatusText(status: VacationStatus): { tone: Tone; text: string } {
  const { t } = useTranslation();
  switch (status.kind) {
    case 'off':
      return { tone: 'muted', text: t('vacation.statusOff', 'Off: no automatic replies are sent.') };
    case 'invalidRange':
      return { tone: 'warning', text: t('vacation.statusInvalid', 'The period ends before it starts.') };
    case 'ended':
      return {
        tone: 'warning',
        text: t('vacation.statusEnded', 'The period ended on {{date}}: no replies are sent.', {
          date: formatDateTime(status.at),
        }),
      };
    case 'scheduled':
      return {
        tone: 'info',
        text: status.until
          ? t('vacation.statusScheduledUntil', 'Scheduled: replies from {{from}} until {{until}}.', {
              from: formatDateTime(status.from),
              until: formatDateTime(status.until),
            })
          : t('vacation.statusScheduled', 'Scheduled: replies from {{from}}, with no end date.', {
              from: formatDateTime(status.from),
            }),
      };
    case 'active':
      return {
        tone: 'success',
        text: status.until
          ? t('vacation.statusActiveUntil', 'Replying now, until {{until}}.', {
              until: formatDateTime(status.until),
            })
          : t('vacation.statusActive', 'Replying now, until you turn it off.'),
      };
  }
}

export function VacationStatusLine({ data }: { data: FieldValues }) {
  const { t } = useTranslation();
  const { baseline } = useFormContext();
  const [now, setNow] = useState(() => new Date());
  const status = vacationStatus(data, now);
  const changeAt = nextStatusChange(status)?.getTime() ?? null;
  useEffect(() => {
    if (changeAt === null) return;
    const delay = Math.min(Math.max(changeAt - Date.now(), 0), MAX_TIMER_DELAY_MS);
    const timer = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(timer);
  }, [changeAt, now]);
  const { tone, text } = useStatusText(status);
  return (
    <p
      role="status"
      data-status-tone={tone}
      className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium', TONE_CLASSES[tone])}
    >
      <span className={cn('size-2 shrink-0 rounded-full', DOT_CLASSES[tone])} aria-hidden="true" />
      {hasUnsavedStatus(data, baseline) ? `${text} ${t('vacation.statusUnsaved', 'Takes effect once saved.')}` : text}
    </p>
  );
}
