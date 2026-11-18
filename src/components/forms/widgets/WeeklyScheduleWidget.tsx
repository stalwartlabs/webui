/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEnclosingSchema, useFormContext, useInPanel } from '@/components/forms/formContext';
import { LocalTimeInput } from '@/components/forms/widgets/LocalTimeInput';
import { WeekChart } from '@/components/values/WeeklyScheduleValue';
import { formatSlot, localeWeekdayOrder } from '@/lib/scheduleFormat';
import { formatWeekday } from '@/lib/format';
import { buildNewObjectValue } from '@/lib/schemaResolver';
import { isRecord } from '@/lib/embeddedSchema';
import {
  PRESETS,
  WORKING_HOURS_SLOT,
  daysValue,
  isOvernight,
  nextSlotKey,
  parseSlot,
  presetsFor,
  scheduleRules,
  slotEntries,
  slotIssue,
  slotsValue,
  type PresetName,
  type ScheduleRules,
  type Slot,
  type SlotIssue,
  type Weekday,
} from '@/lib/weeklySchedule';
import { cn } from '@/lib/utils';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeObjectList } from '@/types/schema';

const FIRST_SLOT_DAYS: readonly Weekday[] = PRESETS.workdays[0].days;

export interface WeeklyScheduleEditorProps {
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  rules: ScheduleRules;
  readOnly?: boolean;
  minItems?: number;
  maxItems?: number;
}

function useIssueMessage(): (issue: SlotIssue) => string {
  const { t } = useTranslation();
  return (issue) => {
    switch (issue) {
      case 'noDays':
        return t('schedule.issueNoDays', 'Choose at least one day.');
      case 'missingTime':
        return t('schedule.issueMissingTime', 'Enter a start and an end time.');
      case 'endNotAfterStart':
        return t(
          'schedule.issueEndNotAfterStart',
          'The end must be later than the start. Split hours that cross midnight into two intervals.',
        );
      case 'startAtEndOfDay':
        return t('schedule.issueStartAtEndOfDay', 'The start must be before 24:00.');
      case 'sameStartEnd':
        return t('schedule.issueSameStartEnd', 'The start and the end cannot be the same time.');
    }
  };
}

interface DayTogglesProps {
  days: readonly Weekday[];
  order: readonly Weekday[];
  onToggle: (day: Weekday) => void;
  disabled: boolean;
  label: string;
}

function DayToggles({ days, order, onToggle, disabled, label }: DayTogglesProps) {
  const inPanel = useInPanel();
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex shrink-0 gap-0.5 rounded-full p-1', inPanel ? 'bg-muted' : 'bg-card')}
    >
      {order.map((day) => {
        const on = days.includes(day);
        const name = formatWeekday(day, 'long');
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            aria-label={name}
            title={name}
            disabled={disabled}
            onClick={() => onToggle(day)}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-full text-[12.5px] font-semibold outline-none transition-[color,background-color] duration-200 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
              on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span aria-hidden="true">{formatWeekday(day, 'narrow')}</span>
          </button>
        );
      })}
    </div>
  );
}

export function WeeklyScheduleEditor({
  value,
  onChange,
  rules,
  readOnly = false,
  minItems,
  maxItems,
}: WeeklyScheduleEditorProps) {
  const { t } = useTranslation();
  const { schema } = useFormContext();
  const inPanel = useInPanel();
  const baseId = useId();
  const issueMessage = useIssueMessage();
  const order = localeWeekdayOrder();
  const items = isRecord(value) ? value : {};
  const raw = slotEntries(items);
  const entries = raw.map(([key, item]): [string, Slot] => [key, parseSlot(item)]);
  const canAdd = !readOnly && (maxItems == null || entries.length < maxItems);
  const canRemove = !readOnly && (minItems == null || entries.length > minItems);
  const summary = entries.map(([, slot]) => formatSlot(t, slot, order, rules));

  const slotRecord = (key: string): Record<string, unknown> => {
    const item = items[key];
    return isRecord(item) ? item : {};
  };

  const timeValue = (key: string, name: 'start' | 'end'): string | null => {
    const time = slotRecord(key)[name];
    return typeof time === 'string' ? time : null;
  };

  const update = (key: string, patch: Record<string, unknown>) =>
    onChange({ ...items, [key]: { ...slotRecord(key), ...patch } });

  const toggleDay = (key: string, slot: Slot, day: Weekday) => {
    const days = slot.days.includes(day) ? slot.days.filter((d) => d !== day) : [...slot.days, day];
    update(key, { days: daysValue(days) });
  };

  const addSlot = () => {
    const last = entries.at(-1)?.[1];
    const days = last && last.days.length > 0 ? last.days : FIRST_SLOT_DAYS;
    onChange({
      ...items,
      [nextSlotKey(raw)]: { ...buildNewObjectValue(schema, WORKING_HOURS_SLOT), days: daysValue(days) },
    });
  };

  const removeSlot = (key: string) => {
    const copy = { ...items };
    delete copy[key];
    onChange(copy);
  };

  const applyPreset = (preset: PresetName) => onChange(slotsValue(PRESETS[preset]));

  return (
    <div className="space-y-3" data-slot="weekly-schedule">
      {entries.length > 0 ? (
        <div className={cn('rounded-xl p-3', inPanel ? 'bg-card shadow-tile' : 'bg-muted')}>
          <WeekChart entries={entries} rules={rules} order={order} label={summary.join('; ')} />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t('schedule.empty', 'No intervals yet.')}</p>
          {!readOnly && (
            <div className="space-y-1.5">
              <p className="text-[13px] text-muted-foreground">{t('schedule.startFrom', 'Start from:')}</p>
              <div className="flex flex-wrap gap-2">
                {presetsFor(rules).map((preset) => (
                  <Button key={preset} type="button" variant="outline" size="sm" onClick={() => applyPreset(preset)}>
                    {preset === 'outsideWorkdays'
                      ? t('schedule.presetOutsideWorkdays', 'Evenings, nights and weekends')
                      : formatSlot(t, parseSlot(slotsValue(PRESETS[preset])[0]), order, rules)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {minItems != null && minItems > 0 && (
            <p className="text-xs font-medium text-destructive">
              {t('schedule.issueEmpty', 'Add at least one interval.')}
            </p>
          )}
        </div>
      )}
      {entries.map(([key, slot], position) => {
        const issue = slotIssue(slot, rules);
        const slotLabel = t('schedule.interval', 'Interval {{n}}', { n: position + 1 });
        const issueId = `${baseId}-${key}-issue`;
        const describedBy = issue ? issueId : undefined;
        return (
          <div
            key={key}
            role="group"
            aria-label={slotLabel}
            data-slot="schedule-slot"
            className={cn('space-y-2 rounded-xl p-3', inPanel ? 'bg-card shadow-tile' : 'bg-muted')}
          >
            <div className="flex items-start gap-2 sm:items-center">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
                <DayToggles
                  days={slot.days}
                  order={order}
                  onToggle={(day) => toggleDay(key, slot, day)}
                  disabled={readOnly}
                  label={t('schedule.days', 'Days')}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <LocalTimeInput
                    value={timeValue(key, 'start')}
                    onChange={(start) => update(key, { start })}
                    disabled={readOnly}
                    aria-label={t('schedule.start', '{{slot}} start', { slot: slotLabel })}
                    aria-invalid={issue !== null && issue !== 'noDays' ? true : undefined}
                    aria-describedby={describedBy}
                  />
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] text-muted-foreground">{t('schedule.to', 'to')}</span>
                    <LocalTimeInput
                      value={timeValue(key, 'end')}
                      onChange={(end) => update(key, { end })}
                      allowEndOfDay
                      disabled={readOnly}
                      aria-label={t('schedule.end', '{{slot}} end', { slot: slotLabel })}
                      aria-invalid={issue !== null && issue !== 'noDays' ? true : undefined}
                      aria-describedby={describedBy}
                    />
                  </span>
                  {isOvernight(slot, rules) && (
                    <span className="text-[12.5px] text-muted-foreground">{t('schedule.nextDay', 'next day')}</span>
                  )}
                </div>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost-danger"
                  size="icon-sm"
                  className="mt-0.5 shrink-0 sm:mt-0"
                  onClick={() => removeSlot(key)}
                  disabled={!canRemove}
                  aria-label={t('schedule.remove', 'Remove {{slot}}', { slot: slotLabel })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
            {issue && (
              <p id={issueId} className="text-xs font-medium text-destructive">
                {issueMessage(issue)}
              </p>
            )}
          </div>
        );
      })}
      {canAdd && (
        <Button type="button" variant="secondary" size="sm" onClick={addSlot}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('schedule.add', 'Add interval')}
        </Button>
      )}
    </div>
  );
}

export function WeeklyScheduleWidget({ type, value, onChange, readOnly }: WidgetProps<FieldTypeObjectList>) {
  const rules = scheduleRules(useEnclosingSchema());
  return (
    <WeeklyScheduleEditor
      value={value}
      onChange={onChange}
      rules={rules}
      readOnly={readOnly}
      minItems={type.minItems}
      maxItems={type.maxItems}
    />
  );
}
