/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz792013';

export function intToBase32(input: number | string): string {
  let n: bigint;
  try {
    n = BigInt(typeof input === 'number' ? Math.floor(input) : input);
  } catch {
    return String(input);
  }
  if (n === 0n) return 'a';
  const chars: string[] = [];
  while (n > 0n) {
    chars.push(BASE32_ALPHABET[Number(n % 32n)]);
    n = n / 32n;
  }
  return chars.reverse().join('');
}

export function isIdKey(key: string): boolean {
  return key === 'id' || key.endsWith('Id');
}

export function isPortKey(key: string): boolean {
  return key === 'port' || key.endsWith('Port');
}

export type TraceEventKind = 'error' | 'span' | 'info';

const ERROR_MARKERS = ['error', 'failed', 'invalid', 'reject'];

export function traceEventKind(eventType: string): TraceEventKind {
  if (ERROR_MARKERS.some((marker) => eventType.includes(marker))) return 'error';
  if (eventType.endsWith('-start') || eventType.endsWith('-end')) return 'span';
  return 'info';
}

export function traceDurationMs(firstTimestamp: string, lastTimestamp: string): number | null {
  const ms = new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();
  return Number.isFinite(ms) ? ms : null;
}
