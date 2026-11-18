/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { errorMessage } from '@/lib/jmapErrors';
import { cn } from '@/lib/utils';
import type { ObjectOption } from '@/data/objectOptions';
import type { ControlProps } from '@/components/forms/widgets/types';

export interface ObjectSearchPopoverProps {
  options: ObjectOption[];
  loading: boolean;
  error: Error | null;
  ensureLoaded: () => void | Promise<void>;
  onSelect: (id: string) => void;
  disabledMessage?: string | null;
  disabled?: boolean;
  label: string;
  control?: ControlProps;
  placeholder?: string;
}

export function ObjectFieldFrame({
  disabled,
  single,
  children,
}: {
  disabled?: boolean;
  single?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="object-field"
      className={cn(
        'field-surface flex min-h-9 w-full items-center gap-1.5 rounded-lg p-1',
        single ? 'flex-nowrap' : 'flex-wrap',
        disabled && 'opacity-60',
      )}
    >
      {children}
    </div>
  );
}

const INLINE_TRIGGER =
  'h-7 flex-1 justify-between gap-2 rounded-md px-2 text-sm font-normal text-dim shadow-none hover:bg-transparent hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0';

function inlineTrigger(placeholder: string): string {
  return cn(INLINE_TRIGGER, placeholder ? 'min-w-[6rem]' : 'min-w-8 justify-end');
}

export function ObjectSearchPopover({
  options,
  loading,
  error,
  ensureLoaded,
  onSelect,
  disabledMessage,
  disabled,
  label,
  control,
  placeholder,
}: ObjectSearchPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  if (disabledMessage) {
    return (
      <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>
          <Button
            {...control}
            type="button"
            variant="ghost"
            size={placeholder === undefined ? 'icon' : 'sm'}
            className={cn(
              'cursor-not-allowed',
              placeholder === undefined ? 'h-8 w-8 bg-muted opacity-60' : inlineTrigger(placeholder),
            )}
            aria-label={label}
            aria-disabled="true"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTooltipOpen(true);
            }}
          >
            <TriggerContent placeholder={placeholder} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{disabledMessage}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void ensureLoaded();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          {...control}
          type="button"
          variant="ghost"
          size={placeholder === undefined ? 'icon' : 'sm'}
          className={
            placeholder === undefined
              ? 'h-8 w-8 bg-muted hover:bg-highlight hover:text-highlight-foreground'
              : inlineTrigger(placeholder)
          }
          aria-label={label}
          disabled={disabled}
        >
          <TriggerContent placeholder={placeholder} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 overflow-hidden p-0" align="start">
        <Command>
          <CommandInput placeholder={t('common.searchPlaceholder', 'Search...')} />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                {t('common.loading', 'Loading...')}
              </div>
            )}
            {!loading && error && (
              <div className="m-2 space-y-2 rounded-xl bg-destructive-soft px-3 py-4 text-center text-sm" role="alert">
                <p className="text-destructive">
                  {errorMessage(error, t('field.optionsLoadFailed', 'Failed to load options.'))}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => void ensureLoaded()}>
                  {t('common.retry', 'Retry')}
                </Button>
              </div>
            )}
            {!loading && !error && <CommandEmpty>{t('common.noResultsDot', 'No results.')}</CommandEmpty>}
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  keywords={[opt.label]}
                  onSelect={() => {
                    onSelect(opt.id);
                    setOpen(false);
                  }}
                >
                  <span className="truncate" title={opt.label}>
                    {opt.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TriggerContent({ placeholder }: { placeholder?: string }) {
  if (placeholder === undefined) return <Search className="h-4 w-4" aria-hidden="true" />;
  return (
    <>
      <span className="truncate">{placeholder}</span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
    </>
  );
}
