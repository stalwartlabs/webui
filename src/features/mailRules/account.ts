/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useAuthStore } from '@/stores/authStore';
import { resolveAccountId } from '@/services/jmap/client';
import { MAIL_RULE_OBJECT } from './model';

export function useRuleAccountId(): string | null {
  return useAuthStore((s) => resolveAccountId(MAIL_RULE_OBJECT, s));
}
