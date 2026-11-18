/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/common/SearchInput';
import { Textarea } from '@/components/ui/textarea';
import { Markdown } from '@/components/common/Markdown';
import { ListError, ListMessage, ListSpinner } from '@/components/lists/ListStates';
import { useJmapSet } from '@/data/mutations';
import { toast } from '@/hooks/use-toast';
import { useHasObjectPermission } from '@/hooks/usePermissions';
import { useResolvedView } from '@/hooks/useResolvedView';
import { formatList, formatNumber } from '@/lib/format';
import { errorMessage, friendlySetError } from '@/lib/jmapErrors';
import type { PageProps } from '@/extensions/types';
import type { JmapSetError } from '@/types/jmap';
import { useRuleAccountId } from '../account';
import { useCreateSenderEntries, useSenderEntries } from '../queries';
import {
  ADDRESS_PROPERTY,
  filterSenders,
  MAX_SENDER_ENTRIES,
  planSenders,
  type SenderEntry,
  type SenderPlan,
} from '../senders';

interface AddReport {
  added: string[];
  duplicates: string[];
  invalid: string[];
  overLimit: string[];
  failed: { address: string; error: JmapSetError }[];
}

const SEARCH_THRESHOLD = 8;

function emptyReport(plan: SenderPlan): AddReport {
  return { ...plan, added: [], failed: [] };
}

function ReportLines({ report }: { report: AddReport }) {
  const { t } = useTranslation();
  const lines: { key: string; text: string; tone: 'success' | 'muted' | 'destructive' }[] = [];
  if (report.added.length > 0) {
    lines.push({
      key: 'added',
      tone: 'success',
      text: t('senderLists.added', 'Added {{count}} entries.', { count: report.added.length }),
    });
  }
  if (report.duplicates.length > 0) {
    lines.push({
      key: 'duplicates',
      tone: 'muted',
      text: t('senderLists.duplicates', 'Already in the list: {{list}}.', { list: formatList(report.duplicates) }),
    });
  }
  if (report.invalid.length > 0) {
    lines.push({
      key: 'invalid',
      tone: 'destructive',
      text: t('senderLists.invalid', 'Not an email address or a domain: {{list}}.', {
        list: formatList(report.invalid),
      }),
    });
  }
  if (report.overLimit.length > 0) {
    lines.push({
      key: 'overLimit',
      tone: 'destructive',
      text: t('senderLists.overLimit', 'The list holds at most {{max}} entries; not added: {{list}}.', {
        max: formatNumber(MAX_SENDER_ENTRIES),
        list: formatList(report.overLimit),
      }),
    });
  }
  for (const { address, error } of report.failed) {
    lines.push({
      key: `failed:${address}`,
      tone: 'destructive',
      text: t('senderLists.failed', 'Could not add {{address}}: {{reason}}', {
        address,
        reason: friendlySetError(error),
      }),
    });
  }
  if (lines.length === 0) return null;
  return (
    <ul className="space-y-1 text-[13px]" role="status" data-testid="sender-list-report">
      {lines.map((line) => (
        <li
          key={line.key}
          className={
            line.tone === 'success'
              ? 'text-success'
              : line.tone === 'destructive'
                ? 'text-destructive'
                : 'text-muted-foreground'
          }
        >
          {line.text}
        </li>
      ))}
    </ul>
  );
}

function AddEntries({
  objectName,
  accountId,
  existing,
  label,
  description,
}: {
  objectName: string;
  accountId: string;
  existing: readonly string[];
  label: string;
  description: string | undefined;
}) {
  const { t } = useTranslation();
  const create = useCreateSenderEntries(objectName);
  const [draft, setDraft] = useState('');
  const [report, setReport] = useState<AddReport | null>(null);
  const inputId = `sender-add-${objectName}`;
  const descriptionId = `${inputId}-description`;

  const submit = async () => {
    const plan = planSenders(existing, draft);
    if (plan.added.length === 0) {
      setReport(emptyReport(plan));
      setDraft(plan.invalid.join('\n'));
      return;
    }
    try {
      const outcome = await create.mutateAsync({ addresses: plan.added, accountId });
      const failed = outcome.failed.map((entry) => entry.address);
      setReport({
        added: outcome.created,
        duplicates: [...plan.duplicates, ...outcome.duplicates],
        invalid: plan.invalid,
        overLimit: plan.overLimit,
        failed: outcome.failed,
      });
      setDraft([...plan.invalid, ...failed].join('\n'));
    } catch (err) {
      toast({
        title: t('senderLists.addFailed', 'Could not add the entries'),
        description: errorMessage(err),
        variant: 'destructive',
      });
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form className="tile space-y-3 px-5 py-4" onSubmit={onSubmit} aria-busy={create.isPending}>
      <div className="space-y-1">
        <label htmlFor={inputId} className="text-[13.5px] font-semibold">
          {label}
        </label>
        <div id={descriptionId} className="space-y-1">
          {description && (
            <Markdown source={description} className="text-[12.5px] leading-relaxed text-muted-foreground" />
          )}
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {t(
              'senderLists.addHint',
              'Enter one or more entries, or paste a list separated by commas, spaces or new lines. Press Enter to add them.',
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Textarea
          id={inputId}
          aria-describedby={descriptionId}
          value={draft}
          rows={2}
          placeholder={t('senderLists.placeholder', 'name@example.org or @example.org')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={create.isPending}
          className="min-h-[44px] flex-1 resize-y"
        />
        <Button type="submit" disabled={create.isPending || draft.trim() === ''} className="shrink-0">
          {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {t('senderLists.add', 'Add')}
        </Button>
      </div>
      {report && <ReportLines report={report} />}
    </form>
  );
}

function EntryRow({
  entry,
  canRemove,
  removing,
  onRemove,
}: {
  entry: SenderEntry;
  canRemove: boolean;
  removing: boolean;
  onRemove: (entry: SenderEntry) => void;
}) {
  const { t } = useTranslation();
  const isDomain = entry.address.startsWith('@');
  return (
    <li
      className="flex items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0 sm:px-5"
      data-testid="sender-entry"
    >
      <span className="min-w-0 flex-1 break-all text-sm">{entry.address}</span>
      {isDomain && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11.5px] text-muted-foreground">
          {t('senderLists.domain', 'Domain')}
        </span>
      )}
      {canRemove && (
        <Button
          type="button"
          variant="ghost-danger"
          size="icon-sm"
          disabled={removing}
          onClick={() => onRemove(entry)}
          aria-label={t('senderLists.remove', 'Remove {{address}}', { address: entry.address })}
        >
          {removing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
        </Button>
      )}
    </li>
  );
}

export function SenderListPage({ viewName }: PageProps) {
  const { t } = useTranslation();
  const resolved = useResolvedView(viewName);
  const accountId = useRuleAccountId();
  const objectName = resolved?.object.objectName ?? '';
  const prefix = resolved?.object.permissionPrefix;
  const canCreate = useHasObjectPermission(prefix, 'Create');
  const canDestroy = useHasObjectPermission(prefix, 'Destroy');
  const entries = useSenderEntries(objectName, accountId);
  const remove = useJmapSet(objectName);
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  const [search, setSearch] = useState('');
  const list = resolved?.list;

  if (!resolved || !list || !accountId) return null;

  const fields = resolved.resolvedSchema.type === 'single' ? resolved.resolvedSchema.fields : null;
  const label = list.columns.find((column) => column.name === ADDRESS_PROPERTY)?.label ?? ADDRESS_PROPERTY;
  const description = fields?.properties[ADDRESS_PROPERTY]?.description;
  const all = entries.data ?? [];
  const shown = filterSenders(all, search);

  const onRemove = async (entry: SenderEntry) => {
    setRemoving((prev) => new Set(prev).add(entry.id));
    try {
      const result = await remove.mutateAsync({ destroy: [entry.id], accountId });
      const error = result.notDestroyed?.[entry.id];
      if (error) {
        toast({
          title: t('senderLists.removeFailed', 'Could not remove {{address}}', { address: entry.address }),
          description: friendlySetError(error),
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: t('senderLists.removeFailed', 'Could not remove {{address}}', { address: entry.address }),
        description: errorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3.5">
      <div className="px-1 pb-1 pt-3">
        <h1 className="page-title">{list.title}</h1>
        {list.subtitle && <p className="mt-1 text-sm text-muted-foreground">{list.subtitle}</p>}
      </div>

      {canCreate && entries.data && (
        <AddEntries
          key={`${objectName}:${accountId}`}
          objectName={objectName}
          accountId={accountId}
          existing={all.map((entry) => entry.address)}
          label={label}
          description={description}
        />
      )}

      {entries.isError && (
        <ListError
          message={errorMessage(entries.error, t('senderLists.loadFailed', 'Failed to load the list.'))}
          onRetry={() => void entries.refetch()}
        />
      )}
      {entries.isPending && entries.fetchStatus !== 'idle' && <ListSpinner />}

      {entries.data &&
        (all.length === 0 ? (
          <ListMessage>{t('senderLists.empty', 'No entries yet. Add an email address or a domain.')}</ListMessage>
        ) : (
          <section className="tile overflow-hidden p-0" aria-labelledby={`${objectName}-entries`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <h2 id={`${objectName}-entries`} className="text-[13.5px] font-semibold">
                {t('senderLists.count', '{{count}} entries', { count: all.length })}
              </h2>
              {all.length > SEARCH_THRESHOLD && (
                <div className="w-full sm:w-64">
                  <SearchInput
                    icon
                    value={search}
                    onValueChange={setSearch}
                    placeholder={t('senderLists.search', 'Search')}
                    aria-label={t('senderLists.searchLabel', 'Search {{label}}', { label: list.title })}
                  />
                </div>
              )}
            </div>
            {shown.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                {t('senderLists.noMatch', 'No entries match “{{search}}”.', { search: search.trim() })}
              </p>
            ) : (
              <ul aria-label={list.title}>
                {shown.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    canRemove={canDestroy}
                    removing={removing.has(entry.id)}
                    onRemove={(target) => void onRemove(target)}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
    </div>
  );
}
