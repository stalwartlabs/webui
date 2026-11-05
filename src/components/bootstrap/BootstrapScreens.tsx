/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopyButton } from '@/components/common/CopyButton';
import { DefaultLogo } from '@/components/common/Logo';
import type { Fields } from '@/types/schema';

export function WizardShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-16 items-center bg-background/80 px-6 backdrop-blur-md">
        <DefaultLogo />
      </header>
      <main className="flex-1 overflow-auto px-4 pb-10 pt-4 sm:px-6">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}

export function ProgressIndicator({ total, current }: { total: number; current: number }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={t('bootstrap.stepOf', 'Step {{current}} of {{total}}', { current: current + 1, total })}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300 ease-bento',
            i === current ? 'w-8 bg-primary' : i < current ? 'w-4 bg-primary/45' : 'w-4 bg-muted-strong',
          )}
        />
      ))}
    </div>
  );
}

export function SuccessScreen({
  extras,
  fields,
  labelsByName,
}: {
  extras: Record<string, unknown>;
  fields: Fields;
  labelsByName: Map<string, string>;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(extras).filter(([k, v]) => {
    if (k === 'id' || k === 'blobId' || k === '@type') return false;
    return typeof v === 'string' && v.length > 0;
  }) as [string, string][];

  const hasCredentials = entries.length > 0;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col items-start gap-4 px-1 pb-2 pt-3">
        <span className="grid size-11 place-items-center rounded-[13px] bg-success-soft text-success">
          <Check className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="page-title">{t('bootstrap.complete', 'Setup complete')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {hasCredentials
              ? t(
                  'bootstrap.credentialsCreated',
                  'Your administrator account has been created. Write these down now: the password will not be shown again.',
                )
              : t('bootstrap.configuredSuccessfully', 'Stalwart has been configured successfully.')}
          </p>
        </div>
      </div>

      {hasCredentials && (
        <section className="tile divide-y divide-border px-5 sm:px-6">
          {entries.map(([key, value]) => {
            const field = fields.properties[key];
            const label = labelsByName.get(key) ?? field?.description?.split('\n')[0] ?? key;
            return (
              <div key={key} className="space-y-2 py-4">
                <div className="text-[13.5px] font-semibold">{label}</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 select-all break-all rounded-xl bg-muted px-3 py-2.5 font-mono text-sm">
                    {value}
                  </code>
                  <CopyButton value={value} label={label} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="rounded-xl bg-info-soft p-4 text-info">
        <p className="text-sm">
          <span className="font-medium">{t('bootstrap.nextStepLabel', 'Next step:')}</span>{' '}
          {hasCredentials
            ? t(
                'bootstrap.nextStepBody',
                'restart Stalwart for the new configuration to take effect. Once restarted, sign in with the credentials above to continue administering your server.',
              )
            : t(
                'bootstrap.nextStepBodyNoCredentials',
                'restart Stalwart for the new configuration to take effect. No administrator account was created because accounts come from the external directory. Once restarted, sign in with the recovery administrator set in STALWART_RECOVERY_ADMIN and assign an administrator role to a directory account.',
              )}
        </p>
      </div>
    </div>
  );
}
