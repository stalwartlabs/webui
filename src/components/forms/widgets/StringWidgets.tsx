/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { useResetOnChange } from '@/hooks/useBufferedValue';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SECRET_MASK } from '@/lib/jmapUtils';
import { cn } from '@/lib/utils';
import { BufferedInput, BufferedTextarea } from '@/components/forms/widgets/BufferedInputs';
import { formatPlaceholder, inputTypeFor } from '@/components/forms/widgets/placeholders';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeString } from '@/types/schema';

function stringCommitter({ type, onChange }: WidgetProps<FieldTypeString>) {
  return (v: string) => onChange(type.nullable && v === '' ? null : v);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function TextWidget(props: WidgetProps<FieldTypeString>) {
  const { type, formField, value, readOnly, control } = props;
  const commit = stringCommitter(props);
  return (
    <BufferedInput
      {...control}
      type={inputTypeFor(type.format)}
      value={stringValue(value)}
      onCommit={commit}
      disabled={readOnly}
      placeholder={formField.placeholder ?? formatPlaceholder(type.format)}
      minLength={type.minLength}
      maxLength={type.maxLength}
    />
  );
}

export function MultilineWidget(props: WidgetProps<FieldTypeString>) {
  const { type, formField, value, readOnly, control } = props;
  const commit = stringCommitter(props);
  const common = {
    ...control,
    value: stringValue(value),
    onCommit: commit,
    disabled: readOnly,
    placeholder: formField.placeholder,
    minLength: type.minLength,
    maxLength: type.maxLength,
  };

  if (type.format === 'html') {
    return (
      <div className="field-surface overflow-hidden rounded-xl">
        <div className="flex items-center gap-2 bg-muted px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-dim">
          <span className="font-mono">HTML</span>
        </div>
        <BufferedTextarea
          {...common}
          rows={10}
          spellCheck={false}
          variant="bare"
          className="resize-y font-mono text-xs"
        />
      </div>
    );
  }
  return <BufferedTextarea {...common} rows={4} />;
}

export function SieveWidget(props: WidgetProps<FieldTypeString>) {
  const { type, formField, value, readOnly, control } = props;
  return (
    <BufferedTextarea
      {...control}
      value={stringValue(value)}
      onCommit={stringCommitter(props)}
      disabled={readOnly}
      placeholder={formField.placeholder}
      minLength={type.minLength}
      maxLength={type.maxLength}
      rows={16}
      spellCheck={false}
      className="font-mono text-xs"
    />
  );
}

export function ColorWidget(props: WidgetProps<FieldTypeString>) {
  const { t } = useTranslation();
  const { value, readOnly, control } = props;
  const commit = stringCommitter(props);
  const str = stringValue(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={str || '#000000'}
        onChange={(e) => commit(e.target.value)}
        disabled={readOnly}
        aria-label={t('field.colorPicker', 'Color picker')}
        className="h-9 w-14 cursor-pointer field-surface rounded-full p-1 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <BufferedInput
        {...control}
        value={str}
        onCommit={commit}
        disabled={readOnly}
        placeholder="#000000"
        className="max-w-[10rem]"
      />
    </div>
  );
}

export function SecretWidget(props: WidgetProps<FieldTypeString>) {
  const { t } = useTranslation();
  const { type, formField, value, readOnly, control } = props;
  const commitValue = stringCommitter(props);
  const strValue = stringValue(value);
  const multiline = type.format === 'secretText';

  const [visible, setVisible] = useState(false);
  const [localValue, setLocalValue] = useState(() => (strValue === SECRET_MASK ? '' : strValue));
  const [isMasked, setIsMasked] = useState(() => strValue === SECRET_MASK);

  useResetOnChange(strValue, () => {
    setLocalValue(strValue === SECRET_MASK ? '' : strValue);
    setIsMasked(strValue === SECRET_MASK);
  });

  const handleLocalChange = (v: string) => {
    setLocalValue(v);
    setIsMasked(false);
  };

  const commit = () => {
    if (isMasked && localValue === '') return;
    if (localValue !== strValue) commitValue(localValue);
  };

  const displayValue = isMasked && !visible ? '' : localValue;
  const placeholder = isMasked ? SECRET_MASK : formField.placeholder;
  const managerIgnore = { 'data-1p-ignore': true, 'data-lpignore': 'true', 'data-bwignore': true };

  const toggle = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0"
      onClick={() => setVisible((p) => !p)}
      aria-label={visible ? t('field.hideValue', 'Hide value') : t('field.showValue', 'Show value')}
      aria-pressed={visible}
      tabIndex={-1}
    >
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>
  );

  if (multiline) {
    return (
      <div className="relative">
        <Textarea
          {...control}
          {...managerIgnore}
          value={displayValue}
          onChange={(e) => handleLocalChange(e.target.value)}
          onBlur={commit}
          disabled={readOnly}
          placeholder={placeholder}
          minLength={type.minLength}
          maxLength={type.maxLength}
          rows={4}
          autoComplete="off"
          className={cn(!visible && 'tracking-widest')}
          style={visible ? undefined : ({ WebkitTextSecurity: 'disc' } as CSSProperties)}
        />
        <div className="absolute right-1 top-1">{toggle}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        {...control}
        {...managerIgnore}
        type={visible ? 'text' : 'password'}
        value={displayValue}
        onChange={(e) => handleLocalChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        disabled={readOnly}
        placeholder={placeholder}
        minLength={type.minLength}
        maxLength={type.maxLength}
        autoComplete="off"
        className="flex-1"
      />
      {toggle}
    </div>
  );
}
