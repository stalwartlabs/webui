/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { create } from 'zustand';
import { isCommunityEdition } from '@/lib/permissions';

export const DEFAULT_LOCALE = 'en-US';

export type Edition = 'enterprise' | 'community' | (string & {});

export interface AccountState {
  permissions: string[];
  edition: Edition;
  locale: string;

  setAccountInfo: (permissions: string[], edition: Edition, locale: string) => void;
  hasPermission: (perm: string) => boolean;
  hasObjectPermission: (prefix: string, action: 'Get' | 'Query' | 'Create' | 'Update' | 'Destroy') => boolean;
}

export const useAccountStore = create<AccountState>()((set, get) => ({
  permissions: [],
  edition: 'community',
  locale: DEFAULT_LOCALE,

  setAccountInfo: (permissions, edition, locale) => {
    set({ permissions, edition, locale });
  },

  hasPermission: (perm) => {
    return get().permissions.includes(perm);
  },

  hasObjectPermission: (prefix, action) => {
    return get().permissions.includes(`${prefix}${action}`);
  },
}));

export const selectIsCommunity = (s: AccountState): boolean => isCommunityEdition(s.edition);
