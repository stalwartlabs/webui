/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FingerprintPattern, Loader2, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFormContext } from '@/components/forms/formContext';
import { getAccountId, jmapCall, jmapGetOne } from '@/services/jmap/client';
import { JmapMethodError } from '@/services/errors';
import type { WidgetProps } from '@/components/forms/widgets/types';
import type { FieldTypeObject } from '@/types/schema';

interface PasskeyRegistrationValue {
  clientDataJson?: string;
  attestationObject?: string;
}

interface CredentialDescriptorJson {
  type: 'public-key';
  id: string;
}

interface CreationOptionsJson {
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: { type: 'public-key'; alg: number }[];
  timeout: number;
  excludeCredentials: CredentialDescriptorJson[];
  authenticatorSelection: AuthenticatorSelectionCriteria;
  attestation: AttestationConveyancePreference;
}

interface RegistrationOptionsResponse {
  accountId: string;
  publicKey: CreationOptionsJson;
}

type PublicKeyCredentialStatic = {
  parseCreationOptionsFromJSON?: (options: CreationOptionsJson) => PublicKeyCredentialCreationOptions;
};

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseCreationOptions(options: CreationOptionsJson): PublicKeyCredentialCreationOptions {
  const parse = (window.PublicKeyCredential as unknown as PublicKeyCredentialStatic).parseCreationOptionsFromJSON;
  if (typeof parse === 'function') return parse(options);
  return {
    rp: options.rp,
    user: { ...options.user, id: fromBase64Url(options.user.id) },
    challenge: fromBase64Url(options.challenge),
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout,
    excludeCredentials: options.excludeCredentials.map((credential) => ({
      type: credential.type,
      id: fromBase64Url(credential.id),
    })),
    authenticatorSelection: options.authenticatorSelection,
    attestation: options.attestation,
  };
}

function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials?.create;
}

function isRegistered(value: unknown): boolean {
  const registration = value as PasskeyRegistrationValue | null | undefined;
  return !!registration?.clientDataJson && !!registration.attestationObject;
}

export function PasskeyRegistrationField({ value, onChange, readOnly }: WidgetProps<FieldTypeObject>) {
  const { t } = useTranslation();
  const { mode } = useFormContext();
  const secretId = useId();
  const otpId = useId();
  const [currentSecret, setCurrentSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isActive = mode === 'create' && !readOnly;

  useEffect(() => {
    if (!isActive) return;
    const controller = new AbortController();
    jmapGetOne('x:AccountPassword', 'singleton', undefined, { signal: controller.signal })
      .then((password) => {
        const otpAuth = password?.otpAuth as { otpUrl?: string | null } | undefined;
        setOtpRequired(!!otpAuth?.otpUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOtpRequired(true);
      });
    return () => controller.abort();
  }, [isActive]);

  if (!isActive) return null;

  if (!isPasskeySupported()) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('passkey.unsupported', 'This browser does not support passkeys.')}
      </p>
    );
  }

  if (isRegistered(value)) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted p-4 text-sm">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{t('passkey.ready', 'Passkey created. Save to add it to your account.')}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          {t('passkey.createAgain', 'Create again')}
        </Button>
      </div>
    );
  }

  const createPasskey = async () => {
    setError(null);
    if (!currentSecret) {
      setError(t('passkey.secretRequired', 'Enter your current password to create a passkey.'));
      return;
    }
    const code = otpCode.trim();
    if (otpRequired && !code) {
      setError(t('passkey.otpRequired', 'Enter your current authenticator code to create a passkey.'));
      return;
    }

    setWaiting(true);
    try {
      const options = await jmapCall<RegistrationOptionsResponse>('x:Passkey/registrationOptions', {
        accountId: getAccountId('x:Passkey'),
        currentSecret,
        ...(code ? { otpCode: code } : {}),
      });
      const credential = await navigator.credentials.create({ publicKey: parseCreationOptions(options.publicKey) });
      if (!(credential instanceof PublicKeyCredential)) throw new Error('No passkey was returned');
      const response = credential.response as AuthenticatorAttestationResponse;
      setCurrentSecret('');
      setOtpCode('');
      onChange({
        clientDataJson: toBase64Url(response.clientDataJSON),
        attestationObject: toBase64Url(response.attestationObject),
      });
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) return;
      if (err instanceof DOMException && err.name === 'InvalidStateError') {
        setError(t('passkey.alreadyRegistered', 'This device already holds a passkey for your account.'));
      } else if (err instanceof JmapMethodError && err.description) {
        setError(err.description);
      } else {
        console.error('Passkey registration failed', err);
        setError(t('passkey.createFailed', 'The passkey could not be created. Please try again.'));
      }
    } finally {
      setWaiting(false);
    }
  };

  const submitOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!waiting) void createPasskey();
    }
  };

  return (
    <div className="space-y-4 rounded-xl bg-muted p-4">
      <p className="text-xs text-muted-foreground">
        {t(
          'passkey.createPrompt',
          'Confirm your password, then follow the prompt from your browser to create a passkey on this device or a security key.',
        )}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={secretId} className="text-sm font-medium">
          {t('passkey.currentSecretLabel', 'Current password')}
        </Label>
        <Input
          id={secretId}
          type="password"
          autoComplete="current-password"
          value={currentSecret}
          onChange={(e) => setCurrentSecret(e.target.value)}
          onKeyDown={submitOnEnter}
          disabled={waiting}
          className="max-w-sm"
        />
      </div>
      {otpRequired && (
        <div className="space-y-1.5">
          <Label htmlFor={otpId} className="text-sm font-medium">
            {t('otp.currentCodeLabel', 'Current code')}
          </Label>
          <Input
            id={otpId}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\s+/g, ''))}
            onKeyDown={submitOnEnter}
            disabled={waiting}
            maxLength={10}
            className="font-mono tracking-widest text-center max-w-[12rem]"
          />
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end">
        <Button type="button" size="sm" onClick={() => void createPasskey()} disabled={waiting}>
          {waiting ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <FingerprintPattern aria-hidden="true" />
          )}
          {waiting ? t('passkey.waiting', 'Waiting for your passkey') : t('passkey.create', 'Create passkey')}
        </Button>
      </div>
    </div>
  );
}
