/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/hooks/use-toast';
import { dismissSievepadWarning, isSievepadWarningDismissed, openInSievepad } from '@/lib/sievepad';
import { useFormContext } from '@/components/forms/formContext';
import type { WidgetProps } from '@/components/forms/widgets/types';

interface SievepadButtonProps {
  scriptName: string;
  source: string;
}

export function SievepadButton({ scriptName, source }: SievepadButtonProps) {
  const { t } = useTranslation();
  const [warningOpen, setWarningOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const open = () => {
    openInSievepad(scriptName || t('sievepad.defaultName', 'Sieve script'), source).catch(() => {
      toast({ title: t('sievepad.failed', 'Failed to open Sievepad.'), variant: 'destructive' });
    });
  };

  const handleClick = () => {
    if (isSievepadWarningDismissed()) {
      open();
    } else {
      setDontShowAgain(false);
      setWarningOpen(true);
    }
  };

  const handleContinue = () => {
    if (dontShowAgain) dismissSievepadWarning();
    open();
  };

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={handleClick} disabled={!source.trim()}>
          <Bug aria-hidden="true" />
          {t('sievepad.debug', 'Debug')}
        </Button>
      </div>
      <ConfirmDialog
        open={warningOpen}
        onOpenChange={setWarningOpen}
        title={t('sievepad.warningTitle', 'Debug in Sievepad')}
        description={t(
          'sievepad.warningDescription',
          'A new tab will open sievepad.com with a copy of this script. Sievepad compiles and runs the script entirely in your browser: nothing is uploaded to or stored on any server.',
        )}
        confirmLabel={t('common.continue')}
        onConfirm={handleContinue}
      >
        <div className="flex items-center gap-2.5 rounded-xl bg-muted px-3.5 py-3">
          <Checkbox
            id="sievepad-dont-show-again"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
          />
          <Label htmlFor="sievepad-dont-show-again" className="text-sm font-normal">
            {t('sievepad.dontShowAgain', "Don't show this again")}
          </Label>
        </div>
      </ConfirmDialog>
    </>
  );
}

export function SievepadRowAddon({ value }: WidgetProps) {
  const { recordLabel } = useFormContext();
  return <SievepadButton scriptName={recordLabel} source={typeof value === 'string' ? value : ''} />;
}
