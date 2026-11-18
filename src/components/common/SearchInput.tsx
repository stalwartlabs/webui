/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useRef, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SearchInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  icon?: boolean;
};

export function SearchInput({ value, onValueChange, icon = false, className, ...props }: SearchInputProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const clear = () => {
    onValueChange('');
    input.current?.focus();
  };
  return (
    <div data-slot="search-input" className="relative w-full">
      {icon && (
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim"
          aria-hidden="true"
        />
      )}
      <Input
        {...props}
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          '[&::-webkit-search-cancel-button]:appearance-none',
          icon && 'pl-9',
          value !== '' && 'pr-9',
          className,
        )}
      />
      {value !== '' && !props.disabled && (
        <button
          type="button"
          onClick={clear}
          aria-label={t('common.clearSearch', 'Clear search')}
          className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-dim transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
