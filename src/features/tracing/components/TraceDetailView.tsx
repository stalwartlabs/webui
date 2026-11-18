/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useResolvedView } from '@/hooks/useResolvedView';
import { useJmapObject } from '@/data/objects';
import type { PageProps } from '@/extensions/types';
import { errorMessage } from '@/lib/jmapErrors';
import { normalizeTraceEvents } from '../normalize';
import { TraceTimeline } from './TraceTimeline';
import { TraceSummaryCards } from './TraceSummaryCards';

export function TraceDetailView({ viewName, objectId }: PageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolved = useResolvedView(viewName);
  const objectName = resolved?.object.objectName;
  const query = useJmapObject(objectName, objectId);
  const trace = query.data;
  const events = useMemo(() => (trace ? normalizeTraceEvents(trace.events) : null), [trace]);

  const backButton = (
    <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
      <ArrowLeft aria-hidden="true" />
      {t('common.back', 'Back')}
    </Button>
  );

  if (query.isPending && query.fetchStatus !== 'idle') {
    return (
      <div
        className="flex items-center justify-center p-12"
        role="status"
        aria-label={t('common.loading', 'Loading...')}
      >
        <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const error = !resolved
    ? t('view.couldNotResolve', 'Could not resolve object')
    : query.isError
      ? errorMessage(query.error, t('tracing.failedToLoadTrace', 'Failed to load trace'))
      : query.isSuccess && !query.data
        ? t('tracing.traceNotFound', 'Trace not found')
        : null;

  if (error) {
    return (
      <div className="space-y-3.5 pt-3">
        {backButton}
        <div role="alert" className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!events) return null;

  return (
    <div className="space-y-3.5 pt-3">
      {backButton}
      <TraceSummaryCards events={events} />
      <Card>
        <CardContent className="p-5">
          <TraceTimeline events={events} anchorTimestamp={events[0]?.timestamp} />
        </CardContent>
      </Card>
    </div>
  );
}
