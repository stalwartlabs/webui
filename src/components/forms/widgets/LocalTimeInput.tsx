/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Fragment, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatLocalTime, localeClock, type LocaleClock } from '@/lib/format';
import {
  HOURS_PER_HALF_DAY,
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  hour12Of,
  hours24From,
  localTimeFromMinutes,
  meridiemOf,
  parseLocalTime,
  type Meridiem,
} from '@/lib/localDateTime';
import { useAccountStore } from '@/stores/accountStore';
import { cn } from '@/lib/utils';
import type { ControlProps } from '@/components/forms/widgets/types';

export interface LocalTimeInputProps extends ControlProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  allowEndOfDay?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  pickerStep?: 15 | 30;
  className?: string;
}

type Segment = 'hours' | 'minutes' | 'meridiem';

interface PendingDigit {
  segment: Segment;
  digit: number;
}

type PickerMove = 'left' | 'right' | 'up' | 'down' | 'first' | 'last';

const LAST_MINUTE = MINUTES_PER_HOUR - 1;
const END_OF_DAY_HOUR = MINUTES_PER_DAY / MINUTES_PER_HOUR;
const DIGIT = /^\d$/;
const SEGMENT_CLASS =
  'rounded-sm bg-transparent text-center tabular-nums outline-none placeholder:text-dim focus:bg-highlight focus:text-highlight-foreground disabled:cursor-not-allowed';
const PICKER_COLUMNS_24H = 4;
const PICKER_COLUMNS_12H = 3;
const PICKER_KEYS = new Map<string, PickerMove>([
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['Home', 'first'],
  ['End', 'last'],
]);

function twoDigits(value: number | null): string {
  return value === null ? '' : String(value).padStart(2, '0');
}

function wrap(value: number, max: number): number {
  return ((value % (max + 1)) + max + 1) % (max + 1);
}

function meridiemForKey(key: string, clock: LocaleClock): Meridiem | null {
  const typed = key.toLocaleLowerCase();
  const am = clock.am.charAt(0).toLocaleLowerCase();
  const pm = clock.pm.charAt(0).toLocaleLowerCase();
  if (am !== pm) {
    if (typed === am) return 'am';
    if (typed === pm) return 'pm';
  }
  return typed === 'a' ? 'am' : typed === 'p' ? 'pm' : null;
}

export function LocalTimeInput({
  value,
  onChange,
  allowEndOfDay = false,
  clearable = false,
  disabled = false,
  pickerStep = 30,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: LocalTimeInputProps) {
  const { t } = useTranslation();
  useAccountStore((s) => s.locale);
  const [pending, setPending] = useState<PendingDigit | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const meridiemRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const segmentLabelId = useId();

  const clock = localeClock();
  const twelve = clock.hour12;
  const total = parseLocalTime(value);
  const hours = total === null ? null : Math.floor(total / MINUTES_PER_HOUR);
  const minutes = total === null ? null : total % MINUTES_PER_HOUR;
  const atEndOfDay = hours === END_OF_DAY_HOUR;
  const maxHour = allowEndOfDay || atEndOfDay ? END_OF_DAY_HOUR : END_OF_DAY_HOUR - 1;
  const meridiem: Meridiem | null = hours === null ? null : atEndOfDay ? 'am' : meridiemOf(hours);
  const hourMin = twelve ? 1 : 0;
  const hourMax = twelve ? HOURS_PER_HALF_DAY : maxHour;
  const shownHour = hours === null ? null : twelve ? hour12Of(hours) : hours;
  const endOfDayText = twelve && atEndOfDay ? t('field.endOfDay', 'End of day') : null;
  const order: readonly Segment[] = !twelve
    ? ['hours', 'minutes']
    : clock.meridiemFirst
      ? ['meridiem', 'hours', 'minutes']
      : ['hours', 'minutes', 'meridiem'];

  const refFor = (segment: Segment) =>
    segment === 'hours' ? hoursRef : segment === 'minutes' ? minutesRef : meridiemRef;
  const neighbour = (segment: Segment, delta: number): Segment | undefined => order[order.indexOf(segment) + delta];
  const focusAfter = (segment: Segment) => {
    const next = neighbour(segment, 1);
    if (next) refFor(next).current?.focus();
  };

  const emit = (h: number, m: number) => onChange(localTimeFromMinutes(h * MINUTES_PER_HOUR + m));
  const setHours = (h: number) => emit(h, h === END_OF_DAY_HOUR ? 0 : (minutes ?? 0));
  const setShownHour = (h: number) => setHours(twelve ? hours24From(h, meridiem ?? 'am') : h);
  const setMinutes = (m: number) => {
    if (!atEndOfDay) emit(hours ?? 0, m);
  };
  const setMeridiem = (next: Meridiem) => {
    const hour12 = hours === null || atEndOfDay ? HOURS_PER_HALF_DAY : hour12Of(hours);
    emit(hours24From(hour12, next), atEndOfDay ? 0 : (minutes ?? 0));
  };

  const typeDigit = (segment: Segment, digit: number) => {
    const previous = pending?.segment === segment ? pending.digit : null;
    if (segment === 'hours') {
      const combined = previous === null ? null : previous * 10 + digit;
      if (combined !== null && combined >= hourMin && combined <= hourMax) {
        setShownHour(combined);
        setPending(null);
        focusAfter('hours');
      } else if (digit * 10 > hourMax) {
        setShownHour(digit);
        setPending(null);
        focusAfter('hours');
      } else {
        if (digit >= hourMin) setShownHour(digit);
        setPending({ segment, digit });
      }
      return;
    }
    if (segment !== 'minutes' || atEndOfDay) return;
    if (previous !== null) {
      setMinutes(previous * 10 + digit);
      setPending(null);
      focusAfter('minutes');
    } else if (digit * 10 > LAST_MINUTE) {
      setMinutes(digit);
      setPending(null);
      focusAfter('minutes');
    } else {
      setMinutes(digit);
      setPending({ segment, digit });
    }
  };

  const step = (segment: Segment, delta: number) => {
    setPending(null);
    if (segment === 'hours') {
      if (twelve && atEndOfDay) {
        setHours(delta > 0 ? 0 : END_OF_DAY_HOUR - 1);
      } else if (twelve && allowEndOfDay && hours === (delta > 0 ? END_OF_DAY_HOUR - 1 : 0)) {
        setHours(END_OF_DAY_HOUR);
      } else if (twelve) {
        setShownHour(
          shownHour === null
            ? delta > 0
              ? hourMin
              : hourMax
            : wrap(shownHour - 1 + delta, HOURS_PER_HALF_DAY - 1) + 1,
        );
      } else {
        setHours(hours === null ? (delta > 0 ? 0 : maxHour) : wrap(hours + delta, maxHour));
      }
    } else if (segment === 'minutes') {
      setMinutes(minutes === null ? (delta > 0 ? 0 : LAST_MINUTE) : wrap(minutes + delta, LAST_MINUTE));
    } else {
      setMeridiem(meridiem === 'am' ? 'pm' : 'am');
    }
  };

  const clear = () => {
    setPending(null);
    if (clearable) onChange(null);
  };

  const onSegmentChange = (segment: Segment) => (e: ChangeEvent<HTMLInputElement>) => {
    const inputType = (e.nativeEvent as Partial<InputEvent>).inputType ?? '';
    if (inputType.startsWith('delete')) {
      clear();
      return;
    }
    const text = e.target.value;
    const typed = text.charAt((e.target.selectionStart ?? text.length) - 1);
    if (segment === 'meridiem') {
      const next = meridiemForKey(typed, clock);
      if (next) {
        setMeridiem(next);
        focusAfter('meridiem');
      }
    } else if (DIGIT.test(typed)) {
      typeDigit(segment, Number(typed));
    }
  };

  const onSegmentKeyDown = (segment: Segment) => (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowUp':
        step(segment, 1);
        break;
      case 'ArrowDown':
        step(segment, -1);
        break;
      case 'Home':
      case 'End': {
        setPending(null);
        const first = e.key === 'Home';
        if (segment === 'hours') {
          if (twelve && allowEndOfDay && !first) setHours(END_OF_DAY_HOUR);
          else setShownHour(first ? hourMin : hourMax);
        } else if (segment === 'minutes') setMinutes(first ? 0 : LAST_MINUTE);
        else setMeridiem(first ? 'am' : 'pm');
        break;
      }
      case 'Backspace':
      case 'Delete':
        clear();
        break;
      case ':':
      case '.':
        if (segment !== 'hours') return;
        minutesRef.current?.focus();
        break;
      case 'ArrowRight':
      case 'ArrowLeft': {
        const target = neighbour(segment, e.key === 'ArrowRight' ? 1 : -1);
        if (!target) return;
        refFor(target).current?.focus();
        break;
      }
      default: {
        const next = segment === 'meridiem' ? meridiemForKey(e.key, clock) : null;
        if (next) {
          setMeridiem(next);
          focusAfter('meridiem');
        } else if (endOfDayText !== null && segment === 'hours' && DIGIT.test(e.key)) {
          typeDigit('hours', Number(e.key));
        } else {
          return;
        }
      }
    }
    e.preventDefault();
  };

  const segmentLabel = (segment: Segment) =>
    segment === 'hours'
      ? t('field.hours', 'Hours')
      : segment === 'minutes'
        ? t('field.minutes', 'Minutes')
        : t('field.dayPeriod', 'AM/PM');

  const segmentName = (segment: Segment) => {
    if (ariaLabelledBy) return { 'aria-labelledby': `${ariaLabelledBy} ${segmentLabelId}-${segment}` };
    if (ariaLabel) {
      return {
        'aria-label': t('field.segmentOf', '{{field}}, {{segment}}', {
          field: ariaLabel,
          segment: segmentLabel(segment),
        }),
      };
    }
    return { 'aria-label': segmentLabel(segment) };
  };

  const segmentProps = (segment: Segment, current: number | null, min: number, max: number, text: string) => ({
    ...segmentName(segment),
    type: 'text',
    inputMode: segment === 'meridiem' ? ('text' as const) : ('numeric' as const),
    role: 'spinbutton',
    autoComplete: 'off',
    disabled,
    placeholder: '--',
    value: text,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': current ?? undefined,
    'aria-valuetext': current === null ? t('field.notSet', 'Not set') : text,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
    'aria-describedby': ariaDescribedBy,
    onChange: onSegmentChange(segment),
    onKeyDown: onSegmentKeyDown(segment),
    onFocus: (e: { currentTarget: HTMLInputElement }) => e.currentTarget.select(),
    onBlur: () => setPending(null),
    className: SEGMENT_CLASS,
  });

  const meridiemText = meridiem === null ? '' : meridiem === 'am' ? clock.am : clock.pm;
  const meridiemWidth = `${Math.max(2, clock.am.length, clock.pm.length) + 0.5}ch`;
  const segments: Record<Segment, ReactNode> = {
    hours: (
      <input
        key="hours"
        {...segmentProps('hours', shownHour, hourMin, hourMax, endOfDayText ?? twoDigits(shownHour))}
        ref={hoursRef}
        id={id}
        readOnly={endOfDayText !== null}
        style={{ width: endOfDayText === null ? '2.5ch' : `${endOfDayText.length + 1}ch` }}
      />
    ),
    minutes: endOfDayText === null && (
      <Fragment key="minutes">
        <span aria-hidden="true" className="px-0.5 text-dim">
          :
        </span>
        <input
          {...segmentProps('minutes', minutes, 0, LAST_MINUTE, twoDigits(minutes))}
          ref={minutesRef}
          readOnly={atEndOfDay}
          style={{ width: '2.5ch' }}
        />
      </Fragment>
    ),
    meridiem: endOfDayText === null && (
      <input
        key="meridiem"
        {...segmentProps('meridiem', meridiem === null ? null : meridiem === 'am' ? 0 : 1, 0, 1, meridiemText)}
        ref={meridiemRef}
        className={cn(SEGMENT_CLASS, clock.meridiemFirst ? 'me-1' : 'ms-1')}
        style={{ width: meridiemWidth }}
      />
    ),
  };

  const options: number[] = [];
  for (let m = 0; m < MINUTES_PER_DAY; m += pickerStep) options.push(m);
  if (allowEndOfDay) options.push(MINUTES_PER_DAY);
  const focusTarget = total !== null && options.includes(total) ? total : options[0];

  const columns = twelve ? PICKER_COLUMNS_12H : PICKER_COLUMNS_24H;
  const onPickerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const move = PICKER_KEYS.get(e.key);
    const buttons = pickerRef.current?.querySelectorAll<HTMLButtonElement>('button');
    if (move === undefined || !buttons) return;
    e.preventDefault();
    const current = Array.prototype.indexOf.call(buttons, document.activeElement);
    const delta = move === 'left' ? -1 : move === 'right' ? 1 : move === 'up' ? -columns : columns;
    const next = move === 'first' ? 0 : move === 'last' ? buttons.length - 1 : current + delta;
    buttons[Math.min(buttons.length - 1, Math.max(0, next))]?.focus();
  };

  const pick = (m: number) => {
    setPending(null);
    onChange(localTimeFromMinutes(m));
    setPickerOpen(false);
  };

  return (
    <div
      role={ariaLabelledBy ? undefined : 'group'}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-describedby={ariaLabelledBy ? undefined : ariaDescribedBy}
      aria-invalid={ariaInvalid}
      data-slot="local-time-input"
      className={cn(
        'field-surface inline-flex h-9 items-center gap-1 rounded-lg pr-1 pl-3 text-base md:text-sm',
        disabled && 'opacity-50',
        className,
      )}
    >
      <div dir="ltr" className="flex items-center">
        {order.map((segment) => segments[segment])}
      </div>
      {ariaLabelledBy && (
        <span hidden>
          {order.map((segment) => (
            <span key={segment} id={`${segmentLabelId}-${segment}`}>
              {segmentLabel(segment)}
            </span>
          ))}
        </span>
      )}
      {!disabled && (
        <div className="ml-auto flex items-center">
          {clearable && total !== null && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => {
                clear();
                hoursRef.current?.focus();
              }}
              aria-label={t('common.clear', 'Clear')}
            >
              <X aria-hidden="true" />
            </Button>
          )}
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                aria-label={t('field.chooseTime', 'Choose a time')}
              >
                <Clock aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <div
                ref={pickerRef}
                className={cn('grid max-h-64 gap-1 overflow-y-auto', twelve ? 'grid-cols-3' : 'grid-cols-4')}
                dir="ltr"
                onKeyDown={onPickerKeyDown}
              >
                {options.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={m === total ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn('px-0 tabular-nums', m === MINUTES_PER_DAY && 'col-span-full')}
                    tabIndex={m === focusTarget ? 0 : -1}
                    aria-current={m === total ? 'time' : undefined}
                    autoFocus={m === focusTarget}
                    onClick={() => pick(m)}
                  >
                    {m === MINUTES_PER_DAY
                      ? twelve
                        ? t('field.endOfDay', 'End of day')
                        : t('field.endOfDayOption', 'End of day (24:00)')
                      : twelve
                        ? formatLocalTime(localTimeFromMinutes(m))
                        : localTimeFromMinutes(m)}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
