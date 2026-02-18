import crypto from 'node:crypto';
import { ENCRYPTION_ALGORITHM, SCRYPT_KEY_LENGTH, SCRYPT_SALT } from '../constants.js';
import type { EncryptedPayload } from '../types/config.js';
import { EncryptionError } from '../utils/error.js';

export function generateRandomKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function deriveKeyFromPassphrase(passphrase: string): string {
  const key = crypto.scryptSync(passphrase, SCRYPT_SALT, SCRYPT_KEY_LENGTH);
  return key.toString('hex');
}

export function encrypt(plaintext: string, keyHex: string): EncryptedPayload {
  try {
    const key = Buffer.from(keyHex, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv) as crypto.CipherGCM;

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const tag = cipher.getAuthTag();

    return {
      encrypted: true,
      algorithm: ENCRYPTION_ALGORITHM,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext,
    };
  } catch (err) {
    throw new EncryptionError('Failed to encrypt data', err instanceof Error ? err : undefined);
  }
}

export function decrypt(payload: EncryptedPayload, keyHex: string): string {
  try {
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(tag);

    let plaintext = decipher.update(payload.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch (err) {
    throw new EncryptionError('Failed to decrypt data. Check your encryption key.', err instanceof Error ? err : undefined);
  }
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.encrypted === true &&
    typeof obj.algorithm === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.tag === 'string' &&
    typeof obj.ciphertext === 'string'
  );
}
