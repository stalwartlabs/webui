/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBlobText } from '@/data/objects';
import { errorMessage } from '@/lib/jmapErrors';
import { BufferedTextarea } from '@/components/forms/widgets/BufferedInputs';
import { SievepadButton } from '@/components/forms/SievepadButton';
import { useFormContext } from '@/components/forms/formContext';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeBlobId } from '@/types/schema';

export function BlobWidget({ type, value, onChange, readOnly, control }: WidgetProps<FieldTypeBlobId>) {
  const { t } = useTranslation();
  const { recordLabel } = useFormContext();
  const [edited, setEdited] = useState<string | null>(null);
  if (edited !== null && value !== edited) {
    setEdited(null);
  }
  const isOwnEdit = edited !== null && value === edited;
  const blobId = !isOwnEdit && typeof value === 'string' && value.length > 0 ? value : null;
  const blob = useBlobText(blobId);

  if (blobId && blob.isPending) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin text-brand-text" aria-hidden="true" />
        {t('field.loadingContent', 'Loading content...')}
      </div>
    );
  }

  if (blobId && (blob.isError || blob.data === null)) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-destructive-soft py-2.5 pl-4 pr-2.5">
        <p className="text-sm text-destructive" role="alert">
          {blob.isError
            ? errorMessage(blob.error, t('field.blobLoadFailed', 'Failed to load content.'))
            : t('field.blobNotFound', 'The stored content could not be found.')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void blob.refetch()}
          disabled={blob.isFetching}
        >
          {t('common.retry', 'Retry')}
        </Button>
      </div>
    );
  }

  const text = edited ?? blob.data ?? '';

  return (
    <div className="space-y-1">
      <BufferedTextarea
        {...control}
        value={text}
        onCommit={(text) => {
          setEdited(text);
          onChange(text);
        }}
        disabled={readOnly}
        rows={8}
        className="font-mono text-xs"
      />
      {isOwnEdit && (
        <p className="text-xs font-medium text-warning">
          {t('field.contentModified', 'Content modified (will be saved as a new blob)')}
        </p>
      )}
      {type.format === 'sieve' && <SievepadButton scriptName={recordLabel} source={text} />}
    </div>
  );
}
