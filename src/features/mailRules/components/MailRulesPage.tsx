/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ListError, ListSpinner } from '@/components/lists/ListStates';
import { useHasObjectPermission, usePermissionCheckers } from '@/hooks/usePermissions';
import { useResolvedView } from '@/hooks/useResolvedView';
import { errorMessage } from '@/lib/jmapErrors';
import { useSchemaStore } from '@/stores/schemaStore';
import type { PageProps } from '@/extensions/types';
import { useRuleAccountId } from '../account';
import { mailboxNamer } from '../mailboxes';
import { useMailboxOptions, useMailRules } from '../queries';
import { CustomRuleList } from './CustomRuleList';

export function MailRulesPage({ viewName, section }: PageProps) {
  const { t } = useTranslation();
  const schema = useSchemaStore((s) => s.schema);
  const resolved = useResolvedView(viewName);
  const checkers = usePermissionCheckers();
  const accountId = useRuleAccountId();
  const prefix = resolved?.object.permissionPrefix;
  const allowed = {
    create: useHasObjectPermission(prefix, 'Create'),
    update: useHasObjectPermission(prefix, 'Update'),
    destroy: useHasObjectPermission(prefix, 'Destroy'),
  };
  const rules = useMailRules(accountId);
  const mailboxes = useMailboxOptions(accountId);
  const list = resolved?.list;

  if (!schema || !resolved || !list) return null;

  const basePath = `/${section}/${viewName}`;
  const summary = {
    t,
    schema,
    mailboxName: mailboxNamer(t, mailboxes.status === 'ready' ? mailboxes.options : undefined),
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1 pt-3">
        <div className="min-w-0">
          <h1 className="page-title">{list.title}</h1>
          {list.subtitle && <p className="mt-1 text-sm text-muted-foreground">{list.subtitle}</p>}
        </div>
        {allowed.create && accountId && (
          <Button asChild>
            <Link to={`${basePath}/new`}>
              <Plus aria-hidden="true" />
              {t('mailRules.createRule', 'Create rule')}
            </Link>
          </Button>
        )}
      </div>

      {rules.isError && (
        <ListError
          message={errorMessage(rules.error, t('mailRules.loadFailed', 'Failed to load the mail rules.'))}
          onRetry={() => void rules.refetch()}
        />
      )}
      {rules.isPending && rules.fetchStatus !== 'idle' && <ListSpinner />}

      {rules.data && accountId && (
        <CustomRuleList
          rules={rules.data}
          accountId={accountId}
          editHref={(id) => `${basePath}/${id}`}
          allowed={allowed}
          checkers={checkers}
          summary={summary}
        />
      )}
    </div>
  );
}
