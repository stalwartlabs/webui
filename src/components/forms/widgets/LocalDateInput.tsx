/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Suspense, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatLocalDate } from '@/lib/format';
import {
  formatLocalDateValue,
  localDateFromCalendarDate,
  localDateToCalendarDate,
  parseLocalDate,
} from '@/lib/localDateTime';
import { cn } from '@/lib/utils';
import { Calendar, CalendarFallback } from '@/components/forms/widgets/DateTimeWidget';
import type { ControlProps } from '@/components/forms/widgets/types';

export interface LocalDateInputProps extends ControlProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  clearable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function LocalDateInput({
  value,
  onChange,
  clearable = false,
  disabled = false,
  placeholder,
  className,
  ...control
}: LocalDateInputProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const parsed = parseLocalDate(value);
  const selected = parsed ? localDateToCalendarDate(parsed) : undefined;
  const hasValue = typeof value === 'string' && value !== '';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            {...control}
            ref={triggerRef}
            type="button"
            variant="field"
            disabled={disabled}
            className={cn('flex-1 justify-start px-3 text-left', !hasValue && 'text-dim')}
          >
            <CalendarIcon className="text-dim" aria-hidden="true" />
            {hasValue ? formatLocalDate(value) : (placeholder ?? t('field.pickDate', 'Pick a date'))}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Suspense fallback={<CalendarFallback />}>
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              autoFocus
              onSelect={(day) => {
                if (day) onChange(formatLocalDateValue(localDateFromCalendarDate(day)));
                setOpen(false);
              }}
            />
          </Suspense>
        </PopoverContent>
      </Popover>
      {clearable && hasValue && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => {
            onChange(null);
            triggerRef.current?.focus();
          }}
          aria-label={t('common.clear', 'Clear')}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
