/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleDot, CircleX, Clock } from 'lucide-react';
import { formatElapsed, formatTime } from '@/lib/format';
import { traceEventKind } from '../format';
import { useTraceLabels } from '../hooks/useTraceLabels';
import type { TraceEvent } from '../types';
import { TraceKeyValueList } from './TraceValue';

const STICKY_BOTTOM_PX = 50;

interface TraceTimelineProps {
  events: TraceEvent[];
  anchorTimestamp?: string;
  keyOffset?: number;
}

export function TraceTimeline({ events, anchorTimestamp, keyOffset = 0 }: TraceTimelineProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastKey = keyOffset + events.length;

  useEffect(() => {
    const el = containerRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastKey]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_BOTTOM_PX;
  };

  if (events.length === 0) {
    return (
      <div className="rounded-xl bg-muted p-10 text-center text-muted-foreground">
        {t('tracing.noEvents', 'No trace events to display.')}
      </div>
    );
  }

  const anchorMs = new Date(anchorTimestamp ?? events[0].timestamp).getTime();

  return (
    <div className="relative">
      <div ref={containerRef} onScroll={handleScroll} className="max-h-[70vh] overflow-y-auto scroll-smooth">
        <ol className="space-y-1 pb-6">
          {events.map((event, idx) => (
            <TraceEventItem key={keyOffset + idx} event={event} anchorMs={anchorMs} />
          ))}
        </ol>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
    </div>
  );
}

function TraceEventIcon({ eventType }: { eventType: string }) {
  switch (traceEventKind(eventType)) {
    case 'error':
      return (
        <span className="grid size-7 place-items-center rounded-full bg-destructive-soft text-destructive">
          <CircleX aria-hidden="true" className="size-3.5" />
        </span>
      );
    case 'span':
      return (
        <span className="grid size-7 place-items-center rounded-full bg-highlight text-highlight-foreground">
          <Clock aria-hidden="true" className="size-3.5" />
        </span>
      );
    default:
      return (
        <span className="grid size-7 place-items-center rounded-full bg-muted text-muted-foreground">
          <CircleDot aria-hidden="true" className="size-3.5" />
        </span>
      );
  }
}

function TraceEventItem({ event, anchorMs }: { event: TraceEvent; anchorMs: number }) {
  const labels = useTraceLabels();
  const { label, explanation, known } = labels.event(event.event);
  const offset = new Date(event.timestamp).getTime() - anchorMs;

  return (
    <li className="flex gap-3 rounded-xl px-2 py-2.5">
      <div className="shrink-0">
        <TraceEventIcon eventType={event.event} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-7 items-start justify-between gap-2">
          <div className="min-w-0 pt-1">
            {known ? (
              <span className="text-sm font-semibold">{label}</span>
            ) : (
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px]">{label}</span>
            )}
            {explanation && <p className="mt-0.5 text-xs text-muted-foreground">{explanation}</p>}
          </div>
          <div className="shrink-0 pt-1 text-right text-xs tabular-nums">
            <time dateTime={event.timestamp} className="block text-muted-foreground">
              {formatTime(event.timestamp, { seconds: true, milliseconds: /\.\d/.test(event.timestamp) })}
            </time>
            <div className="text-dim">(+{formatElapsed(offset)})</div>
          </div>
        </div>
        {event.keyValues.length > 0 && (
          <div className="mt-2 space-y-1 rounded-xl bg-muted p-3">
            <TraceKeyValueList keyValues={event.keyValues} />
          </div>
        )}
      </div>
    </li>
  );
}
