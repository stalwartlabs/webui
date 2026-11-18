/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RemovablePillProps {
  label: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
  children?: ReactNode;
}

export function RemovablePill({ label, onRemove, removeDisabled, children }: RemovablePillProps) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="secondary"
      className={cn('h-7 min-w-0 max-w-full gap-1 text-[13px] font-medium', onRemove ? 'pl-3 pr-1' : 'px-3')}
    >
      <span className="truncate" title={label}>
        {children ?? label}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label={t('field.removeItem', 'Remove {{name}}', { name: label })}
          className="grid size-5 shrink-0 place-items-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-highlight hover:text-highlight-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </Badge>
  );
}
