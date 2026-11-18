/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { lazyPage } from '@/extensions/lazyPage';
import type { PageGate, PageOverride } from '@/extensions/types';

const DashboardPage = lazyPage(
  () => import('@/features/dashboard/components/DashboardPage'),
  (m) => m.DashboardPage,
);

const METRICS_GATE: PageGate = { permission: 'liveMetrics', backingObject: 'x:Metric' };

export const SEL_PAGES: readonly PageOverride[] = [
  { match: { customComponent: 'Dashboard' }, component: DashboardPage, gate: METRICS_GATE },
  { match: { viewPrefix: 'Dashboard/' }, component: DashboardPage, gate: METRICS_GATE },
  {
    match: { customComponent: 'LiveTracing' },
    component: lazyPage(
      () => import('@/features/tracing/components/LiveTracingPage'),
      (m) => m.LiveTracingPage,
    ),
    gate: { permission: 'liveTracing', enterprise: true },
  },
  {
    match: { object: 'x:Trace' },
    modes: ['edit', 'detail'],
    component: lazyPage(
      () => import('@/features/tracing/components/TraceDetailView'),
      (m) => m.TraceDetailView,
    ),
  },
];
