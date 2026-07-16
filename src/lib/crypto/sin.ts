/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '@/lib/env/server-env';

const SIN_AUTH_TAG_BYTES = 16;
const SIN_IV_BYTES = 12;

function sinEncryptionKey(): Buffer {
  if (!/^[\da-f]{64}$/i.test(env.SIN_ENCRYPTION_KEY)) {
    throw new Error('SIN_ENCRYPTION_KEY must be a 32-byte hex string.');
  }

  const key = Buffer.from(env.SIN_ENCRYPTION_KEY, 'hex');

  if (key.length !== 32) {
    throw new Error('SIN_ENCRYPTION_KEY must decode to 32 bytes.');
  }

  return key;
}

export function encryptSIN(sin: string): { encryptedSinHex: string; ivHex: string } {
  const iv = randomBytes(SIN_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', sinEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(sin, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedSinHex: Buffer.concat([encrypted, authTag]).toString('hex'),
    ivHex: iv.toString('hex')
  };
}

export function decryptSIN(encrypted: Buffer, iv: Buffer): string {
  if (iv.length !== SIN_IV_BYTES || encrypted.length <= SIN_AUTH_TAG_BYTES) {
    throw new Error('Invalid encrypted SIN payload.');
  }

  const encryptedBody = encrypted.subarray(0, encrypted.length - SIN_AUTH_TAG_BYTES);
  const authTag = encrypted.subarray(encrypted.length - SIN_AUTH_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', sinEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedBody), decipher.final()]).toString('utf8');
}
