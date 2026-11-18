/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { lazy, type ComponentType } from 'react';
import type { PageComponent, PageProps } from '@/extensions/types';

export function lazyPage<M>(load: () => Promise<M>, select: (module: M) => ComponentType<PageProps>): PageComponent {
  return lazy(() => load().then((module) => ({ default: select(module) })));
}
