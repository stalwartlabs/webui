/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BufferedInput } from '@/components/forms/widgets/BufferedInputs';
import { RemovablePill } from '@/components/forms/widgets/RemovablePill';
import type { WidgetProps } from '@/components/forms/widgets/types';
import { useRuleAccountId } from '../account';
import { toSet } from '../builder';
import { mailboxNamer } from '../mailboxes';
import { setValues } from '../model';
import { useMailboxOptions } from '../queries';

const INDENT_REM = 0.75;

export function MailboxPicker({ type, value, onChange, readOnly, control }: WidgetProps) {
  const { t } = useTranslation();
  const mailboxes = useMailboxOptions(useRuleAccountId());
  const ids = setValues(value);
  const isFull = type.type === 'set' && type.maxItems != null && ids.length >= type.maxItems;
  const nameOf = mailboxNamer(t, mailboxes.status === 'ready' ? mailboxes.options : undefined);
  const add = (entered: string) => {
    const id = entered.trim();
    if (id && !ids.includes(id)) onChange(toSet([...ids, id]));
  };
  const placeholder =
    ids.length > 0
      ? t('mailRules.addMailbox', 'Add another mailbox')
      : t('mailRules.chooseMailbox', 'Choose a mailbox');

  return (
    <div className="space-y-2">
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <RemovablePill
              key={id}
              label={nameOf(id)}
              onRemove={readOnly ? undefined : () => onChange(toSet(ids.filter((key) => key !== id)))}
            />
          ))}
        </div>
      )}
      {!readOnly &&
        !isFull &&
        (mailboxes.status === 'ready' ? (
          <Select value="" onValueChange={add}>
            <SelectTrigger {...control} className="w-full">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {mailboxes.options.map((option) => (
                <SelectItem
                  key={option.id}
                  value={option.id}
                  textValue={option.path.join(' / ')}
                  disabled={ids.includes(option.id)}
                >
                  <span style={{ paddingInlineStart: `${option.depth * INDENT_REM}rem` }}>{option.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <BufferedInput
            key={ids.length}
            {...control}
            value=""
            onCommit={add}
            disabled={mailboxes.status === 'loading'}
            placeholder={t('mailRules.mailboxId', 'Mailbox id')}
          />
        ))}
    </div>
  );
}
