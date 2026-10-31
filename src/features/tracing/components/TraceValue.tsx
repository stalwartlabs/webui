/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSchemaStore } from '@/stores/schemaStore';
import { formatDateTime, formatElapsed, formatNumber } from '@/lib/format';
import { intToBase32, isIdKey, isPortKey } from '../format';
import { useTraceLabels } from '../hooks/useTraceLabels';
import type { TraceKeyValue, TraceValue } from '../types';

const MAX_EVENT_DEPTH = 2;
const INLINE_LIST_MAX = 3;

export function TraceKeyValueList({ keyValues, depth = 0 }: { keyValues: TraceKeyValue[]; depth?: number }) {
  return keyValues.map((kv, i) => <TraceKeyValueRow key={`${kv.key}-${i}`} kv={kv} depth={depth} />);
}

function TraceKeyValueRow({ kv, depth }: { kv: TraceKeyValue; depth: number }) {
  const labels = useTraceLabels();
  return (
    <div className="flex gap-2 text-sm" style={{ paddingInlineStart: depth * 16 }}>
      <span className="min-w-24 shrink-0 pt-0.5 text-right text-xs font-medium text-muted-foreground">
        {labels.key(kv.key)}
      </span>
      <span className="min-w-0 break-words pt-0.5 text-xs">
        <TraceValueDisplay keyName={kv.key} value={kv.value} depth={depth} />
      </span>
    </div>
  );
}

function IdValue({ keyName, raw }: { keyName: string; raw: number | string }) {
  const section = useSchemaStore((s) => s.viewToSection['x:QueuedMessage']) ?? 'Management';
  const encoded = intToBase32(raw);
  if (keyName === 'queueId') {
    return (
      <Link
        to={`/${section}/x:QueuedMessage/${encoded}`}
        className="font-mono text-brand-text underline underline-offset-2 hover:no-underline"
      >
        {encoded}
      </Link>
    );
  }
  return <span className="font-mono">{encoded}</span>;
}

function NestedEvent({ event, value, depth }: { event: string; value: TraceKeyValue[]; depth: number }) {
  const labels = useTraceLabels();
  if (depth >= MAX_EVENT_DEPTH) {
    return (
      <pre className="whitespace-pre-wrap rounded-lg bg-muted-strong p-2.5 font-mono text-xs">
        {JSON.stringify({ event, values: value }, null, 2)}
      </pre>
    );
  }
  const { label, explanation } = labels.event(event);
  return (
    <div className="mt-1 space-y-1 border-l-2 border-input pl-3">
      <div className="text-xs font-semibold">{label}</div>
      {explanation && <div className="text-xs text-muted-foreground">{explanation}</div>}
      <TraceKeyValueList keyValues={value} depth={depth + 1} />
    </div>
  );
}

function TraceValueDisplay({ keyName, value, depth }: { keyName: string; value: TraceValue; depth: number }) {
  const { t } = useTranslation();
  switch (value['@type']) {
    case 'String':
    case 'IpAddr':
      return <>{value.value}</>;
    case 'UnsignedInt':
    case 'Integer': {
      const raw: unknown = value.value;
      const numeric =
        raw && typeof raw === 'object' && 'source' in raw ? (raw as { source: string }).source : (raw as number);
      if (isIdKey(keyName)) return <IdValue keyName={keyName} raw={numeric} />;
      if (isPortKey(keyName)) return <>{String(numeric)}</>;
      return <>{formatNumber(Number(numeric))}</>;
    }
    case 'Boolean':
      if (keyName === 'tls') {
        return <>{value.value ? t('tracing.enabled', 'enabled') : t('tracing.disabled', 'disabled')}</>;
      }
      return <>{String(value.value)}</>;
    case 'Float':
      return <>{formatNumber(value.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
    case 'UTCDateTime':
      return <>{formatDateTime(value.value, 'medium')}</>;
    case 'Duration':
      return <>{formatElapsed(value.value)}</>;
    case 'List':
      if (value.value.length <= INLINE_LIST_MAX) {
        return value.value.map((v, i) => (
          <span key={i}>
            {i > 0 && ', '}
            <TraceValueDisplay keyName={keyName} value={v} depth={depth} />
          </span>
        ));
      }
      return (
        <div className="space-y-0.5">
          {value.value.map((v, i) => (
            <div key={i}>
              <TraceValueDisplay keyName={keyName} value={v} depth={depth} />
            </div>
          ))}
        </div>
      );
    case 'Event':
      return <NestedEvent event={value.event} value={value.value} depth={depth} />;
    case 'Null':
      return <span className="text-dim">&mdash;</span>;
    default:
      return <>{JSON.stringify(value)}</>;
  }
}
