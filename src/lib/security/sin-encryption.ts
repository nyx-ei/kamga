/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import { createCipheriv, randomBytes } from 'node:crypto';

import { env } from '@/lib/env/server-env';

function encryptionKey(): Buffer {
  const key = Buffer.from(env.SIN_ENCRYPTION_KEY, 'base64');

  if (key.length === 32) {
    return key;
  }

  const fallbackKey = Buffer.from(env.SIN_ENCRYPTION_KEY, 'utf8');

  if (fallbackKey.length === 32) {
    return fallbackKey;
  }

  throw new Error('SIN_ENCRYPTION_KEY must decode to 32 bytes.');
}

export function encryptSin(sin: string): { encryptedSinHex: string; ivHex: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(sin, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedSinHex: Buffer.concat([encrypted, authTag]).toString('hex'),
    ivHex: iv.toString('hex')
  };
}
