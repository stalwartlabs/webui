/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Suspense, useId, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CalendarRange, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, CalendarFallback } from '@/components/forms/widgets/DateTimeWidget';
import { LocalTimeInput } from '@/components/forms/widgets/LocalTimeInput';
import { formatDateTime } from '@/lib/format';
import { localTimeFromMinutes, parseLocalTime } from '@/lib/localDateTime';
import { cn } from '@/lib/utils';
import { atLocalTime, localMinutes, pickRangeDay, type DateRange, type RangeEdge } from '../model';
import type { ControlProps } from '@/components/forms/widgets/types';

const TWO_MONTHS_QUERY = '(min-width: 48rem)';

function subscribeTwoMonths(onChange: () => void): () => void {
  const query = window.matchMedia(TWO_MONTHS_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function showsTwoMonths(): boolean {
  return window.matchMedia(TWO_MONTHS_QUERY).matches;
}

function hasMoreBelow(scroller: HTMLElement): boolean {
  return scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  readOnly?: boolean;
  control?: ControlProps;
}

export function DateRangePicker({ value, onChange, readOnly = false, control }: DateRangePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [edge, setEdge] = useState<RangeEdge>('start');
  const [moreBelow, setMoreBelow] = useState(false);
  const twoMonths = useSyncExternalStore(subscribeTwoMonths, showsTwoMonths, () => false);
  const idPrefix = useId();
  const { from, to } = value;

  const startText = from ? formatDateTime(from) : t('vacation.startsNow', 'Starts immediately');
  const endText = to ? formatDateTime(to) : t('vacation.noEnd', 'No end date');
  const edges: readonly { edge: RangeEdge; label: string; text: string; date: Date | null; clearLabel: string }[] = [
    {
      edge: 'start',
      label: t('vacation.start', 'Start'),
      text: startText,
      date: from,
      clearLabel: t('vacation.startNow', 'Start immediately'),
    },
    {
      edge: 'end',
      label: t('vacation.end', 'End'),
      text: endText,
      date: to,
      clearLabel: t('vacation.removeEnd', 'No end date'),
    },
  ];

  const setEdgeDate = (target: RangeEdge, date: Date | null) =>
    onChange(target === 'start' ? { from: date, to } : { from, to: date });

  const trackOverflow = (scroller: HTMLDivElement | null) => {
    const content = scroller?.firstElementChild;
    if (!scroller || !content) return;
    const observer = new ResizeObserver(() => setMoreBelow(hasMoreBelow(scroller)));
    observer.observe(scroller);
    observer.observe(content);
    return () => observer.disconnect();
  };

  const openWith = (next: boolean) => {
    if (next) setEdge(from || !to ? 'start' : 'end');
    setOpen(next);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={openWith}>
        <PopoverTrigger asChild>
          <Button
            {...control}
            type="button"
            variant="field"
            disabled={readOnly}
            className="h-auto min-h-9 flex-1 flex-wrap justify-start gap-x-2 gap-y-0.5 px-3 py-1.5 text-left"
          >
            <CalendarRange className="text-dim" aria-hidden="true" />
            <span className={cn(!from && 'text-dim')}>{startText}</span>
            <ArrowRight className="size-3.5 text-dim" aria-hidden="true" />
            <span className="sr-only">{` ${t('vacation.until', 'until')} `}</span>
            <span className={cn(!to && 'text-dim')}>{endText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          ref={trackOverflow}
          onScroll={(event) => setMoreBelow(hasMoreBelow(event.currentTarget))}
          className="max-h-(--radix-popover-content-available-height) w-auto max-w-[calc(100vw-2rem)] overflow-y-auto p-0"
          align="start"
          collisionPadding={16}
        >
          <div>
            <div
              role="group"
              aria-label={t('vacation.editingEdge', 'Date to set')}
              className="grid grid-cols-2 gap-1 border-b border-border bg-muted/60 p-2"
            >
              {edges.map((item) => (
                <button
                  key={item.edge}
                  type="button"
                  aria-pressed={edge === item.edge}
                  onClick={() => setEdge(item.edge)}
                  className={cn(
                    'min-w-0 rounded-[10px] px-3 py-1.5 text-left transition-colors hover:bg-card',
                    edge === item.edge && 'bg-card ring-1 ring-border',
                  )}
                >
                  <span className="eyebrow block">{item.label}</span>
                  <span className={cn('block truncate text-[13px] font-medium', !item.date && 'text-dim')}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
            <Suspense fallback={<CalendarFallback />}>
              <Calendar
                className="mx-auto"
                mode="range"
                numberOfMonths={twoMonths ? 2 : 1}
                selected={{ from: from ?? undefined, to: to ?? undefined }}
                defaultMonth={(edge === 'start' ? from : to) ?? from ?? to ?? undefined}
                autoFocus
                onSelect={(_range, day) => {
                  onChange(pickRangeDay(value, day, edge));
                  if (edge === 'start') setEdge('end');
                }}
              />
            </Suspense>
            <div className="grid gap-3 border-t border-border bg-muted/60 p-3 sm:grid-cols-2">
              {edges.map((item) => {
                const labelId = `${idPrefix}-${item.edge}-time`;
                return (
                  <div key={item.edge} className="space-y-1.5">
                    <span id={labelId} className="eyebrow block">
                      {item.edge === 'start'
                        ? t('vacation.startTime', 'Start time')
                        : t('vacation.endTime', 'End time')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <LocalTimeInput
                        aria-labelledby={labelId}
                        value={item.date ? localTimeFromMinutes(localMinutes(item.date)) : null}
                        disabled={!item.date}
                        onChange={(time) => {
                          const minutes = parseLocalTime(time);
                          if (item.date && minutes !== null) {
                            setEdgeDate(item.edge, atLocalTime(item.date, minutes, item.edge));
                          }
                        }}
                      />
                      {item.date && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEdgeDate(item.edge, null)}>
                          {item.clearLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {moreBelow && (
            <div
              aria-hidden="true"
              className="pointer-events-none sticky bottom-0 -mt-10 h-10 bg-gradient-to-t from-popover to-transparent"
            />
          )}
        </PopoverContent>
      </Popover>
      {(from || to) && !readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onChange({ from: null, to: null })}
          aria-label={t('vacation.clearPeriod', 'Clear period')}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
