/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeUtcDateTime } from '@/types/schema';

export const Calendar = lazy(() => import('@/components/ui/calendar').then((m) => ({ default: m.Calendar })));

export function CalendarFallback() {
  return (
    <div className="flex h-72 w-64 items-center justify-center" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-brand-text" aria-hidden="true" />
    </div>
  );
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function DateTimeWidget({ type, value, onChange, readOnly, control }: WidgetProps<FieldTypeUtcDateTime>) {
  const { t } = useTranslation();
  const selected = parseDate(value);
  const localTime = (selected ?? new Date()).toTimeString().slice(0, 5);

  const commit = (day: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const next = new Date(day);
    next.setHours(hours || 0, minutes || 0, 0, 0);
    onChange(next.toISOString());
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            {...control}
            type="button"
            variant="field"
            disabled={readOnly}
            className={cn('flex-1 justify-start px-3 text-left', !selected && 'text-dim')}
          >
            <CalendarIcon className="text-dim" aria-hidden="true" />
            {selected ? formatDateTime(selected) : t('field.pickDate', 'Pick a date')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Suspense fallback={<CalendarFallback />}>
            <Calendar
              mode="single"
              selected={selected ?? undefined}
              defaultMonth={selected ?? undefined}
              autoFocus
              onSelect={(day) => {
                if (day) commit(day, localTime);
              }}
            />
          </Suspense>
          <div className="border-t border-border bg-muted/60 p-3">
            <Input
              type="time"
              value={localTime}
              disabled={!selected}
              onChange={(e) => {
                if (selected && e.target.value) commit(selected, e.target.value);
              }}
              aria-label={t('field.time', 'Time')}
            />
          </div>
        </PopoverContent>
      </Popover>
      {type.nullable && selected && !readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange(null)}
          aria-label={t('common.clear', 'Clear')}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
