/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { useInPanel } from '@/components/forms/formContext';
import { formatNumber, formatWeekday } from '@/lib/format';
import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from '@/lib/localDateTime';
import { formatSlot, localeWeekdayOrder } from '@/lib/scheduleFormat';
import {
  daySegments,
  parseSlot,
  slotEntries,
  weekdayIndex,
  type ScheduleRules,
  type Slot,
  type Weekday,
} from '@/lib/weeklySchedule';
import { cn } from '@/lib/utils';
import type { ValueProps } from '@/extensions/types';

const AXIS_HOURS = [0, 6, 12, 18, 24] as const;

interface WeekChartProps {
  entries: readonly [string, Slot][];
  rules: ScheduleRules;
  order: readonly Weekday[];
  label: string;
}

function percent(minutes: number): string {
  return `${(minutes / MINUTES_PER_DAY) * 100}%`;
}

export function WeekChart({ entries, rules, order, label }: WeekChartProps) {
  const inPanel = useInPanel();
  const segments = daySegments(entries, rules);
  return (
    <div role="img" aria-label={label} data-slot="week-chart" className="space-y-1">
      {order.map((day) => (
        <div key={day} className="flex items-center gap-2">
          <span className="w-10 shrink-0 truncate text-[12px] text-muted-foreground" aria-hidden="true">
            {formatWeekday(day, 'short')}
          </span>
          <div className={cn('relative h-4 flex-1 overflow-hidden rounded-full', inPanel ? 'bg-muted' : 'bg-card')}>
            {AXIS_HOURS.slice(1, -1).map((hour) => (
              <span
                key={hour}
                className="absolute inset-y-0 w-px bg-border"
                style={{ insetInlineStart: percent(hour * MINUTES_PER_HOUR) }}
              />
            ))}
            {segments[weekdayIndex(day) ?? 0].map((segment) => (
              <span
                key={`${segment.key}-${segment.start}`}
                data-slot="week-chart-bar"
                className="absolute inset-y-0 rounded-full bg-primary"
                style={{ insetInlineStart: percent(segment.start), width: percent(segment.end - segment.start) }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2" aria-hidden="true">
        <span className="w-10 shrink-0" />
        <div className="relative h-4 flex-1 text-[11px] text-dim tabular-nums">
          {AXIS_HOURS.map((hour) => (
            <span
              key={hour}
              className={cn(
                'absolute',
                hour === 0 ? 'start-0' : hour === 24 ? 'end-0' : '-translate-x-1/2 rtl:translate-x-1/2',
              )}
              style={hour === 0 || hour === 24 ? undefined : { insetInlineStart: percent(hour * MINUTES_PER_HOUR) }}
            >
              {formatNumber(hour)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const DISPLAY_RULES: ScheduleRules = 'overnight';

export function WeeklyScheduleValue({ value, variant }: ValueProps) {
  const { t } = useTranslation();
  const order = localeWeekdayOrder();
  const entries = slotEntries(value).map(([key, item]): [string, Slot] => [key, parseSlot(item)]);
  const lines = entries.map(([, slot]) => formatSlot(t, slot, order, DISPLAY_RULES));
  if (variant === 'compact') return <span className="text-sm">{lines.join('; ')}</span>;
  return (
    <div className="space-y-3">
      <WeekChart entries={entries} rules={DISPLAY_RULES} order={order} label={lines.join('; ')} />
      <ul className="space-y-0.5 text-sm">
        {lines.map((line, i) => (
          <li key={entries[i][0]}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
