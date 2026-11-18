/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { createContext, useContext } from 'react';
import type { Schema } from '@/types/schema';

export type FormMode = 'create' | 'edit';

export interface FormContextValue {
  schema: Schema;
  mode: FormMode;
  readOnly: boolean;
  hideEnterprise: boolean;
  isCommunity: boolean;
  idPrefix: string;
  recordLabel: string;
  baseline: unknown;
  tenantId: string | null;
}

export interface FieldScope {
  path: readonly string[];
  readOnly: boolean;
}

export const FormContext = createContext<FormContextValue | null>(null);

export const FieldScopeContext = createContext<FieldScope>({ path: [], readOnly: false });

export const PanelContext = createContext(false);

export const EnclosingSchemaContext = createContext<string | null>(null);

export function useFormContext(): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('Form widgets must be rendered inside a FormProvider');
  return ctx;
}

export function useFieldScope(): FieldScope {
  return useContext(FieldScopeContext);
}

export function useInPanel(): boolean {
  return useContext(PanelContext);
}

export function useEnclosingSchema(): string | null {
  return useContext(EnclosingSchemaContext);
}

export function isEnterpriseLockedIn(ctx: FormContextValue, enterprise: boolean | undefined): boolean {
  return !!enterprise && ctx.isCommunity;
}

export function fieldDomId(idPrefix: string, path: readonly string[]): string {
  const suffix = path.map((p) => p.replace(/[^A-Za-z0-9_-]/g, '_')).join('-');
  return suffix ? `${idPrefix}-${suffix}` : idPrefix;
}

export interface FieldIds {
  inputId: string;
  labelId: string;
  descriptionId: string;
  errorId: string;
}

export function fieldIds(idPrefix: string, path: readonly string[]): FieldIds {
  const base = fieldDomId(idPrefix, path);
  return {
    inputId: base,
    labelId: `${base}-label`,
    descriptionId: `${base}-description`,
    errorId: `${base}-error`,
  };
}
