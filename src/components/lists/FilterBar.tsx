/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Filter as FilterIcon, RotateCcw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Filter, Schema } from '@/types/schema';
import { filtersKey } from './listUrlState';
import { FilterField } from './FilterFields';

interface FilterBarProps {
  schema: Schema;
  filters: Filter[];
  applied: Record<string, string>;
  isXPrefixed: boolean;
  disabled: boolean;
  onApply: (values: Record<string, string>) => void;
  onReset: () => void;
}

export function FilterBar({ schema, filters, applied, isXPrefixed, disabled, onApply, onReset }: FilterBarProps) {
  const { t } = useTranslation();
  const panelId = useId();
  const appliedKey = filtersKey(applied);
  const [open, setOpen] = useState(() => Object.keys(applied).length > 0);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [draftKey, setDraftKey] = useState(appliedKey);
  if (draftKey !== appliedKey) {
    setDraftKey(appliedKey);
    setDraft(null);
  }
  const values = draft ?? applied;

  const setValue = (field: string, value: string) => setDraft({ ...values, [field]: value });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDraft(null);
    onApply(values);
  };

  const handleReset = () => {
    setDraft(null);
    onReset();
  };

  const activeCount = filters.filter((f) => Object.hasOwn(applied, f.field) && applied[f.field] !== '').length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-controls={panelId}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-200 ease-bento focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeCount > 0 || open
                ? 'bg-highlight text-highlight-foreground hover:bg-highlight-strong'
                : 'bg-muted text-muted-foreground hover:bg-muted-strong hover:text-foreground',
            )}
          >
            <FilterIcon className="h-3.5 w-3.5" aria-hidden />
            {t('list.filters', 'Filters')}
            {activeCount > 0 && (
              <span
                className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground"
                aria-hidden
              >
                {activeCount}
              </span>
            )}
            {open ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent id={panelId}>
        <form
          role="search"
          aria-label={t('list.filters', 'Filters')}
          onSubmit={handleSubmit}
          className="mx-2.5 mb-2.5 rounded-xl bg-muted p-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filters.map((filter) => (
              <FilterField
                key={filter.field}
                schema={schema}
                filter={filter}
                values={values}
                isXPrefixed={isXPrefixed}
                onChange={setValue}
                onCommit={(field, value) => onApply({ ...applied, [field]: value })}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={disabled}>
              <RotateCcw aria-hidden />
              {t('list.resetFilters', 'Reset')}
            </Button>
            <Button type="submit" size="sm" disabled={disabled}>
              <Search aria-hidden />
              {t('list.searchFilters', 'Search')}
            </Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
