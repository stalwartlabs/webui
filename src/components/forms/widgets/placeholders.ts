/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { StringFormat } from '@/types/schema';

export function formatPlaceholder(format: StringFormat): string | undefined {
  switch (format) {
    case 'ipAddress':
      return '192.168.1.1';
    case 'ipNetwork':
      return '192.168.1.0/24';
    case 'socketAddress':
      return '127.0.0.1:8080';
    case 'emailAddress':
      return 'user@example.com';
    case 'uri':
      return 'https://example.com';
    case 'localTime':
      return 'HH:MM';
    case 'localDate':
      return 'YYYY-MM-DD';
    default:
      return undefined;
  }
}

export function inputTypeFor(format: StringFormat): 'email' | 'url' | 'text' {
  return format === 'emailAddress' ? 'email' : format === 'uri' ? 'url' : 'text';
}
