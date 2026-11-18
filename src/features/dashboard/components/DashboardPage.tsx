/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useSchemaStore } from '@/stores/schemaStore';
import { DashboardView } from '@/features/dashboard/components/DashboardView';
import type { PageProps } from '@/extensions/types';

const DASHBOARD_PREFIX = 'Dashboard/';
const DEFAULT_DASHBOARD = 'overview';

export function DashboardPage({ viewName, section }: PageProps) {
  const firstDashboard = useSchemaStore((s) => s.schema?.dashboards?.[0]?.id);
  const dashboardId = viewName.startsWith(DASHBOARD_PREFIX)
    ? viewName.slice(DASHBOARD_PREFIX.length)
    : (firstDashboard ?? DEFAULT_DASHBOARD);
  return <DashboardView dashboardId={dashboardId} section={section} />;
}
