/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { RemovablePill } from '@/components/forms/widgets/RemovablePill';
import { SetWidget } from '@/components/forms/widgets/SetWidget';
import type { WidgetProps } from '@/components/forms/widgets/types';
import { editKeywords, toSet } from '../builder';
import { setValues } from '../model';
import { keywordName } from '../summary';

export function KeywordInput(props: WidgetProps) {
  const { t } = useTranslation();
  const { type, value, onChange, readOnly } = props;
  if (type.type !== 'set') return null;
  const keywords = setValues(value);
  const named: { keyword: string; name: string }[] = [];
  const typed: string[] = [];
  for (const keyword of keywords) {
    const name = keywordName(t, keyword);
    if (name) named.push({ keyword, name });
    else typed.push(keyword);
  }
  return (
    <div className="space-y-2">
      {named.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {named.map(({ keyword, name }) => (
            <RemovablePill
              key={keyword}
              label={name}
              onRemove={readOnly ? undefined : () => onChange(toSet(keywords.filter((key) => key !== keyword)))}
            />
          ))}
        </div>
      )}
      <SetWidget
        {...props}
        type={{ ...type, minItems: undefined, maxItems: type.maxItems && type.maxItems - named.length }}
        value={toSet(typed)}
        onChange={(next) => onChange(editKeywords(value, typed, setValues(next)))}
      />
    </div>
  );
}
