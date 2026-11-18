/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useFormContext } from '@/components/forms/formContext';
import { formatUtcOffset } from '@/lib/format';
import { getEnum } from '@/lib/schemaResolver';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { EnumVariant, FieldTypeEnum } from '@/types/schema';

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function zoneOffsets(variants: readonly EnumVariant[], at: Date): ReadonlyMap<string, string> {
  const offsets = new Map<string, string>();
  for (const { name } of variants) {
    const offset = formatUtcOffset(name, at);
    if (offset) offsets.set(name, offset);
  }
  return offsets;
}

export function TimeZoneWidget({ type, value, onChange, readOnly, control }: WidgetProps<FieldTypeEnum>) {
  const { t } = useTranslation();
  const { schema } = useFormContext();
  const variants = getEnum(schema, type.enumName);
  const [now] = useState(() => new Date());
  const [offsets, setOffsets] = useState<ReadonlyMap<string, string> | null>(null);
  const current = typeof value === 'string' ? value : '';
  const currentOffset = current ? (offsets?.get(current) ?? formatUtcOffset(current, now)) : null;
  const local = browserTimeZone();
  const localVariant = local ? variants.find((v) => v.name === local) : undefined;

  const options: ComboboxOption[] = variants.map((v) => {
    const offset = offsets?.get(v.name);
    return {
      value: v.name,
      label: v.label,
      description: offset,
      keywords: offset ? [v.name, offset] : [v.name],
    };
  });

  return (
    <div className="space-y-1.5">
      <Combobox
        {...control}
        options={options}
        value={current}
        onValueChange={(v) => onChange(v === '' ? null : v)}
        onFirstOpen={() => setOffsets(zoneOffsets(variants, now))}
        placeholder={t('field.selectEllipsis', 'Select...')}
        searchPlaceholder={t('timeZone.search', 'Search by city, region or offset...')}
        emptyText={t('field.noMatches', 'No matches')}
        nullLabel={t('field.none', 'None')}
        nullable={type.nullable}
        disabled={readOnly}
      />
      {(currentOffset || (localVariant && local !== current && !readOnly)) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {currentOffset && (
            <span className="text-[12.5px] text-muted-foreground tabular-nums">
              {t('timeZone.currentOffset', 'Currently {{offset}}', { offset: currentOffset })}
            </span>
          )}
          {localVariant && local !== current && !readOnly && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 py-0.5"
              onClick={() => onChange(localVariant.name)}
            >
              <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
              {t('timeZone.useMine', 'Use my time zone ({{zone}})', { zone: localVariant.label })}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
