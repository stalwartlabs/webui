/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AccountInfo {
  name: string;
  isPersonal: boolean;
  hasManagement: boolean;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  tokenLifetime: number | null;
  tokenEndpoint: string | null;
  endSessionEndpoint: string | null;
  clientId: string | null;
  resource: string | null;
  accounts: Record<string, AccountInfo>;
  primaryAccountId: string | null;
  activeAccountId: string | null;
  apiUrl: string | null;
  maxObjectsInGet: number;
  maxObjectsInSet: number;
  sessionExpired: boolean;

  setTokens: (
    access: string,
    refresh: string | null,
    expiresIn: number,
    tokenEndpoint: string,
    endSessionEndpoint?: string | null,
    clientId?: string | null,
    resource?: string | null,
  ) => void;
  setSession: (
    accounts: Record<string, AccountInfo>,
    primaryAccountId: string,
    apiUrl: string,
    maxObjectsInGet?: number,
    maxObjectsInSet?: number,
  ) => void;
  switchAccount: (accountId: string) => void;
  logout: () => void;
  expireSession: () => void;
  isAuthenticated: () => boolean;
  isTokenExpiringSoon: () => boolean;
}

const REFRESH_MARGIN_MS = 60_000;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      tokenLifetime: null,
      tokenEndpoint: null,
      endSessionEndpoint: null,
      clientId: null,
      resource: null,
      accounts: {},
      primaryAccountId: null,
      activeAccountId: null,
      apiUrl: null,
      maxObjectsInGet: 500,
      maxObjectsInSet: 500,
      sessionExpired: false,

      setTokens: (access, refresh, expiresIn, tokenEndpoint, endSessionEndpoint, clientId, resource) => {
        const lifetime = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : null;
        set({
          accessToken: access,
          refreshToken: refresh,
          tokenExpiresAt: lifetime === null ? null : Date.now() + lifetime,
          tokenLifetime: lifetime,
          tokenEndpoint,
          endSessionEndpoint: endSessionEndpoint === undefined ? get().endSessionEndpoint : endSessionEndpoint,
          clientId: clientId === undefined ? get().clientId : clientId,
          resource: resource === undefined ? get().resource : resource,
          sessionExpired: false,
        });
      },

      setSession: (accounts, primaryAccountId, apiUrl, maxObjectsInGet, maxObjectsInSet) => {
        const current = get().activeAccountId;
        set({
          accounts,
          primaryAccountId,
          activeAccountId: current && accounts[current] ? current : primaryAccountId,
          apiUrl,
          ...(maxObjectsInGet !== undefined ? { maxObjectsInGet } : {}),
          ...(maxObjectsInSet !== undefined ? { maxObjectsInSet } : {}),
        });
      },

      switchAccount: (accountId) => {
        const { accounts, activeAccountId } = get();
        if (accounts[accountId] && accountId !== activeAccountId) {
          set({ activeAccountId: accountId });
        }
      },

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          tokenLifetime: null,
          tokenEndpoint: null,
          endSessionEndpoint: null,
          clientId: null,
          resource: null,
          accounts: {},
          primaryAccountId: null,
          activeAccountId: null,
          apiUrl: null,
          sessionExpired: false,
        });
      },

      expireSession: () => {
        if (get().accessToken === null) return;
        get().logout();
        set({ sessionExpired: true });
      },

      isAuthenticated: () => {
        const { accessToken, refreshToken, tokenExpiresAt } = get();
        if (accessToken === null) return false;
        if (refreshToken) return true;
        return tokenExpiresAt === null || Date.now() < tokenExpiresAt;
      },

      isTokenExpiringSoon: () => {
        const { tokenExpiresAt, tokenLifetime } = get();
        if (tokenExpiresAt === null) return false;
        const margin = tokenLifetime === null ? REFRESH_MARGIN_MS : Math.min(REFRESH_MARGIN_MS, tokenLifetime / 2);
        return tokenExpiresAt - Date.now() < margin;
      },
    }),
    {
      name: 'stalwart-auth',
      storage: {
        getItem: (name) => {
          const value = sessionStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
      partialize: (state) =>
        ({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          tokenExpiresAt: state.tokenExpiresAt,
          tokenLifetime: state.tokenLifetime,
          tokenEndpoint: state.tokenEndpoint,
          endSessionEndpoint: state.endSessionEndpoint,
          clientId: state.clientId,
          resource: state.resource,
          activeAccountId: state.activeAccountId,
        }) as AuthState,
    },
  ),
);

export function selectActiveAccountIsPersonal(state: AuthState): boolean {
  const { accounts, activeAccountId } = state;
  if (!activeAccountId || !Object.hasOwn(accounts, activeAccountId)) return true;
  return accounts[activeAccountId].isPersonal;
}

export function applyAccessTokenOverride(): void {
  const token = import.meta.env.VITE_ACCESS_TOKEN as string | undefined;
  if (!token) return;
  const { accessToken } = useAuthStore.getState();
  if (!accessToken || accessToken === token) {
    useAuthStore.getState().setTokens(token, '', 86400, '');
  }
}
