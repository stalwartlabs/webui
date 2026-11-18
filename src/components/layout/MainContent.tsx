/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSchemaStore } from '@/stores/schemaStore';
import { usePermissionCheckers } from '@/hooks/usePermissions';
import { pageObjectId, resolvePage, type PageTarget } from '@/extensions/pages';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { DynamicList } from '@/components/lists/DynamicList';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { DynamicViewPage } from '@/components/views/DynamicViewPage';
import { LoadingFallback } from '@/components/common/LoadingFallback';

interface MainContentProps {
  viewName?: string;
  id?: string;
  section?: string;
}

function genericView(viewName: string, target: PageTarget, key: string): ReactNode {
  switch (target.mode) {
    case 'list':
      return <DynamicList key={key} viewName={viewName} />;
    case 'create':
      return <DynamicForm key={key} viewName={viewName} objectId={null} />;
    case 'singleton':
      return <DynamicForm key={key} viewName={viewName} objectId="singleton" />;
    case 'edit':
      return <DynamicForm key={key} viewName={viewName} objectId={target.id} />;
    case 'detail':
      return <DynamicViewPage key={key} viewName={viewName} objectId={target.id} />;
  }
}

export function MainContent({ viewName, id, section = '' }: MainContentProps) {
  const schema = useSchemaStore((s) => s.schema);
  const permissions = usePermissionCheckers();
  const location = useLocation();
  const { t } = useTranslation();
  const page = resolvePage(schema, viewName, id, permissions);

  let content: ReactNode;
  switch (page.kind) {
    case 'loading':
      content = <LoadingFallback />;
      break;
    case 'unknownComponent':
      content = (
        <div className="mt-3 rounded-2xl bg-muted p-10 text-center text-muted-foreground">
          {t('errors.unknownComponent', 'Unknown component: {{name}}', { name: page.name })}
        </div>
      );
      break;
    case 'unknownView':
      content = (
        <div role="alert" className="mt-3 rounded-xl bg-destructive-soft p-4 text-center text-sm text-destructive">
          {t('errors.unknownView', 'Unknown view: {{name}}', { name: viewName })}
        </div>
      );
      break;
    case 'route': {
      const Page = page.component;
      content = <Page viewName={page.viewName} objectId={id ?? null} section={section} />;
      break;
    }
    case 'object': {
      const objectId = pageObjectId(page.target);
      const key = objectId ? `${page.viewName}/${objectId}` : page.viewName;
      const Page = page.component;
      content = Page ? (
        <Page key={key} viewName={page.viewName} objectId={objectId} section={section} />
      ) : (
        genericView(page.viewName, page.target, key)
      );
      break;
    }
  }

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<LoadingFallback />}>{content}</Suspense>
    </ErrorBoundary>
  );
}
