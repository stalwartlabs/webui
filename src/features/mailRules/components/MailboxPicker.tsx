/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BufferedInput } from '@/components/forms/widgets/BufferedInputs';
import type { ControlProps } from '@/components/forms/widgets/types';
import { useMailboxOptions } from '../queries';

const INDENT_REM = 0.75;

interface MailboxPickerProps {
  accountId: string | null;
  value: unknown;
  onChange: (value: string) => void;
  readOnly: boolean;
  control: ControlProps;
}

export function MailboxPicker({ accountId, value, onChange, readOnly, control }: MailboxPickerProps) {
  const { t } = useTranslation();
  const mailboxes = useMailboxOptions(accountId);
  const current = typeof value === 'string' ? value : '';

  if (mailboxes.status !== 'ready') {
    return (
      <BufferedInput
        {...control}
        value={current}
        onCommit={onChange}
        readOnly={readOnly}
        disabled={mailboxes.status === 'loading'}
        placeholder={t('mailRules.mailboxId', 'Mailbox id')}
      />
    );
  }

  const { options } = mailboxes;
  const selected = options.find((option) => option.id === current);
  return (
    <Select value={current} onValueChange={onChange} disabled={readOnly}>
      <SelectTrigger {...control} className="w-full">
        <SelectValue placeholder={t('mailRules.chooseMailbox', 'Choose a mailbox')}>
          {selected ? selected.path.join(' / ') : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {current && !selected && (
          <SelectItem value={current}>
            {t('mailRules.unknownMailbox', 'Unknown mailbox ({{id}})', { id: current })}
          </SelectItem>
        )}
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id} textValue={option.path.join(' / ')}>
            <span style={{ paddingInlineStart: `${option.depth * INDENT_REM}rem` }}>{option.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
