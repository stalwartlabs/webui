/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { ListError, ListSpinner } from '@/components/lists/ListStates';
import { DynamicViewPage } from '@/components/views/DynamicViewPage';
import { errorMessage } from '@/lib/jmapErrors';
import type { FieldErrors } from '@/components/forms/formLogic';
import type { FieldOverrides } from '@/components/forms/useDynamicForm';
import type { ViewRenderers } from '@/components/views/DynamicView';
import type { PageProps } from '@/extensions/types';
import { useRuleAccountId } from '../account';
import { needsAction, nextRulePosition, parseCustomBody } from '../model';
import { useMailRules } from '../queries';
import { actionRequiredMessage } from '../summary';
import { RuleBuilderRow, RuleSummaryRow } from './RuleBuilder';

const RULE_ANCHOR = 'actions';
const RULE_FIELDS = ['matchAll', 'conditions', 'exceptions', 'stopProcessing', 'onlyWhenAway', 'timeZone'] as const;

function Omitted() {
  return null;
}

const FIELD_OVERRIDES: FieldOverrides = {
  hidden: ['position'],
  render: {
    ...Object.fromEntries(RULE_FIELDS.map((name) => [name, Omitted])),
    [RULE_ANCHOR]: RuleBuilderRow,
  },
};

function useFieldOverrides(): FieldOverrides {
  const { t } = useTranslation();
  return {
    ...FIELD_OVERRIDES,
    validate: (data): FieldErrors =>
      needsAction(parseCustomBody(data)) ? { [RULE_ANCHOR]: actionRequiredMessage(t) } : {},
  };
}

const VIEW_RENDERERS: ViewRenderers = {
  ...Object.fromEntries(RULE_FIELDS.map((name) => [name, Omitted])),
  [RULE_ANCHOR]: RuleSummaryRow,
};

function CreateRuleForm({
  viewName,
  accountId,
  fieldOverrides,
}: {
  viewName: string;
  accountId: string;
  fieldOverrides: FieldOverrides;
}) {
  const { t } = useTranslation();
  const rules = useMailRules(accountId);
  if (rules.isError) {
    return (
      <ListError
        message={errorMessage(rules.error, t('mailRules.loadFailed', 'Failed to load the mail rules.'))}
        onRetry={() => void rules.refetch()}
      />
    );
  }
  if (!rules.data) return <ListSpinner />;
  return (
    <DynamicForm
      viewName={viewName}
      objectId={null}
      accountId={accountId}
      fieldOverrides={fieldOverrides}
      createValues={{ position: nextRulePosition(rules.data) }}
    />
  );
}

export function MailRuleFormPage({ viewName, objectId }: PageProps) {
  const accountId = useRuleAccountId();
  const fieldOverrides = useFieldOverrides();
  if (!accountId) return null;
  if (objectId === 'new')
    return <CreateRuleForm viewName={viewName} accountId={accountId} fieldOverrides={fieldOverrides} />;
  return <DynamicForm viewName={viewName} objectId={objectId} accountId={accountId} fieldOverrides={fieldOverrides} />;
}

export function MailRuleViewPage({ viewName, objectId }: PageProps) {
  const accountId = useRuleAccountId();
  if (!accountId || !objectId) return null;
  return <DynamicViewPage viewName={viewName} objectId={objectId} accountId={accountId} renderers={VIEW_RENDERERS} />;
}
